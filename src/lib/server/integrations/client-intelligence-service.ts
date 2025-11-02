/**
 * Client Intelligence Service
 *
 * Generates embeddings and stores Linear data and interactions in per-client Pinecone indexes.
 * Integrates with:
 * - pinecone-manager.ts (multi-index management)
 * - embedding-service.ts (OpenAI embeddings)
 * - interaction importers (data sources)
 *
 * Handles:
 * - Linear projects → embeddings → client index
 * - Linear issues → embeddings → client index
 * - Interactions (comments, meetings) → embeddings → client index
 */

import { OpenAI } from 'openai';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import {
	linearProjects,
	linearIssues,
	interactions,
	linearTeamMappings
} from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { pineconeManager } from './pinecone-manager';

interface EmbeddingResult {
	processed: number;
	skipped: number;
	errors: string[];
}

/**
 * Client Intelligence Service
 */
export class ClientIntelligenceService {
	private openai: OpenAI;

	constructor(private userId: string) {
		this.openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY || ''
		});
	}

	/**
	 * Generate embedding for content using OpenAI
	 */
	private async generateEmbedding(content: string): Promise<number[]> {
		try {
			const response = await this.openai.embeddings.create({
				model: 'text-embedding-3-small',
				input: content.substring(0, 8000) // OpenAI limit
			});
			return response.data[0].embedding;
		} catch (error) {
			console.error('[Client Intelligence] Error generating embedding:', error);
			throw error;
		}
	}

	/**
	 * Generate unique Pinecone ID
	 */
	private generatePineconeId(type: string, id: string): string {
		return `${type}_${id}_${Date.now()}`;
	}

	/**
	 * Store Linear project in Pinecone
	 */
	async storeProject(projectId: string): Promise<void> {
		try {
			const project = await db.query.linearProjects.findFirst({
				where: and(
					eq(linearProjects.id, projectId),
					eq(linearProjects.userId, this.userId)
				)
			});

			if (!project) {
				throw new Error(`Project ${projectId} not found`);
			}

			// Skip if already stored
			if (project.pineconeId) {
				console.log(`[Client Intelligence] Project ${project.name} already stored in Pinecone`);
				return;
			}

			// Get client index for this team
			const teamMapping = await db.query.linearTeamMappings.findFirst({
				where: and(
					eq(linearTeamMappings.userId, this.userId),
					eq(linearTeamMappings.linearTeamId, project.linearTeamId)
				)
			});

			if (!teamMapping || !teamMapping.linearTeamName) {
				throw new Error(`Team mapping not found for team ${project.linearTeamId}`);
			}

			const index = await pineconeManager.getClientIndex(
				this.userId,
				project.linearTeamId,
				teamMapping.linearTeamName
			);

			// Create embedding content
			const content = `
				Project: ${project.name}
				Description: ${project.description || 'No description'}
				State: ${project.state}
				Lead: ${project.lead || 'Unassigned'}
				Lead Email: ${project.leadEmail || 'N/A'}
				Start Date: ${project.startDate?.toISOString() || 'Not set'}
				Target Date: ${project.targetDate?.toISOString() || 'Not set'}
			`.trim();

			// Generate embedding
			const embedding = await this.generateEmbedding(content);

			// Store in Pinecone
			const pineconeId = this.generatePineconeId('project', project.id);

			await index.upsert([{
				id: pineconeId,
				values: embedding,
				metadata: {
					type: 'project',
					projectId: project.id,
					linearProjectId: project.linearProjectId,
					linearTeamId: project.linearTeamId,
					name: project.name,
					description: (project.description || '').substring(0, 500),
					state: project.state,
					lead: project.lead || '',
					leadEmail: project.leadEmail || '',
					startDate: project.startDate?.toISOString() || '',
					targetDate: project.targetDate?.toISOString() || '',
					userId: this.userId,
					timestamp: new Date().toISOString()
				}
			}]);

			// Update database record
			await db
				.update(linearProjects)
				.set({ pineconeId, updatedAt: new Date() })
				.where(eq(linearProjects.id, project.id));

			console.log(`[Client Intelligence] Stored project ${project.name} in Pinecone`);
		} catch (error) {
			const err = error as Error;
			console.error('[Client Intelligence] Failed to store project:', err);
			throw err;
		}
	}

	/**
	 * Store Linear issue in Pinecone
	 */
	async storeIssue(issueId: string): Promise<void> {
		try {
			const issue = await db.query.linearIssues.findFirst({
				where: eq(linearIssues.id, issueId),
				with: {
					project: true
				}
			});

			if (!issue) {
				throw new Error(`Issue ${issueId} not found`);
			}

			// Skip if already stored
			if (issue.pineconeId) {
				console.log(`[Client Intelligence] Issue ${issue.identifier} already stored in Pinecone`);
				return;
			}

			// Get team mapping
			const teamMapping = await db.query.linearTeamMappings.findFirst({
				where: and(
					eq(linearTeamMappings.userId, this.userId),
					eq(linearTeamMappings.linearTeamId, issue.project.linearTeamId)
				)
			});

			if (!teamMapping) {
				throw new Error(`Team mapping not found for team ${issue.project.linearTeamId}`);
			}

			const index = await pineconeManager.getClientIndex(
				this.userId,
				issue.project.linearTeamId,
				teamMapping.linearTeamName
			);

			// Create embedding content
			const labels = issue.labels && Array.isArray(issue.labels)
				? issue.labels.map((l: any) => l.name).join(', ')
				: '';

			const content = `
				Issue: ${issue.identifier} - ${issue.title}
				Description: ${issue.description || 'No description'}
				Status: ${issue.status} (${issue.statusType})
				Priority: ${issue.priorityLabel}
				Assignee: ${issue.assignee || 'Unassigned'}
				Assignee Email: ${issue.assigneeEmail || 'N/A'}
				Estimate: ${issue.estimate || 'Not estimated'}
				Due Date: ${issue.dueDate?.toISOString() || 'Not set'}
				Labels: ${labels}
				URL: ${issue.url}
			`.trim();

			// Generate embedding
			const embedding = await this.generateEmbedding(content);

			// Store in Pinecone
			const pineconeId = this.generatePineconeId('issue', issue.id);

			await index.upsert([{
				id: pineconeId,
				values: embedding,
				metadata: {
					type: 'issue',
					issueId: issue.id,
					linearIssueId: issue.linearIssueId,
					linearProjectId: issue.linearProjectId,
					linearTeamId: issue.project.linearTeamId,
					identifier: issue.identifier,
					title: issue.title,
					description: (issue.description || '').substring(0, 500),
					status: issue.status,
					statusType: issue.statusType,
					priority: issue.priority,
					priorityLabel: issue.priorityLabel,
					assignee: issue.assignee || '',
					assigneeEmail: issue.assigneeEmail || '',
					url: issue.url,
					userId: this.userId,
					timestamp: new Date().toISOString()
				}
			}]);

			// Update database record
			await db
				.update(linearIssues)
				.set({ pineconeId, updatedAt: new Date() })
				.where(eq(linearIssues.id, issue.id));

			console.log(`[Client Intelligence] Stored issue ${issue.identifier} in Pinecone`);
		} catch (error) {
			const err = error as Error;
			console.error('[Client Intelligence] Failed to store issue:', err);
			throw err;
		}
	}

	/**
	 * Store interaction in Pinecone
	 */
	async storeInteraction(interactionId: string): Promise<void> {
		try {
			const interaction = await db.query.interactions.findFirst({
				where: and(
					eq(interactions.id, interactionId),
					eq(interactions.userId, this.userId)
				)
			});

			if (!interaction) {
				throw new Error(`Interaction ${interactionId} not found`);
			}

			// Skip if already stored
			if (interaction.pineconeStored) {
				console.log(`[Client Intelligence] Interaction ${interaction.title} already stored in Pinecone`);
				return;
			}

			// Get team ID from metadata
			const linearTeamId = interaction.metadata?.linearTeamId as string | undefined;

			if (!linearTeamId) {
				console.warn(`[Client Intelligence] Interaction ${interactionId} has no linearTeamId in metadata`);
				return;
			}

			// Get team mapping
			const teamMapping = await db.query.linearTeamMappings.findFirst({
				where: and(
					eq(linearTeamMappings.userId, this.userId),
					eq(linearTeamMappings.linearTeamId, linearTeamId)
				)
			});

			if (!teamMapping) {
				throw new Error(`Team mapping not found for team ${linearTeamId}`);
			}

			const index = await pineconeManager.getClientIndex(
				this.userId,
				linearTeamId,
				teamMapping.linearTeamName
			);

			// Create embedding content
			const participants = interaction.participants && Array.isArray(interaction.participants)
				? interaction.participants.map((p: any) => p.name).join(', ')
				: '';

			const tags = interaction.tags && Array.isArray(interaction.tags)
				? interaction.tags.join(', ')
				: '';

			const content = `
				${interaction.title}
				Type: ${interaction.interactionType}
				Content: ${interaction.content}
				Participants: ${participants}
				Tags: ${tags}
				Sentiment: ${interaction.sentiment || 'Not analyzed'}
				Priority: ${interaction.priority}
				Date: ${interaction.interactionDate.toISOString()}
			`.trim();

			// Generate embedding
			const embedding = await this.generateEmbedding(content);

			// Store in Pinecone
			const pineconeId = this.generatePineconeId('interaction', interaction.id);

			await index.upsert([{
				id: pineconeId,
				values: embedding,
				metadata: {
					type: 'interaction',
					interactionId: interaction.id,
					interactionType: interaction.interactionType,
					linearTeamId,
					title: interaction.title,
					content: interaction.content.substring(0, 500),
					sourceId: interaction.sourceId,
					sourceUrl: interaction.sourceUrl || '',
					sentiment: interaction.sentiment || '',
					priority: interaction.priority,
					tags: tags,
					interactionDate: interaction.interactionDate.toISOString(),
					userId: this.userId,
					timestamp: new Date().toISOString()
				}
			}]);

			// Update database record
			await db
				.update(interactions)
				.set({
					pineconeStored: true,
					pineconeId,
					updatedAt: new Date()
				})
				.where(eq(interactions.id, interaction.id));

			console.log(`[Client Intelligence] Stored interaction ${interaction.title} in Pinecone`);
		} catch (error) {
			const err = error as Error;
			console.error('[Client Intelligence] Failed to store interaction:', err);
			throw error;
		}
	}

	/**
	 * Store all projects for a team in Pinecone
	 */
	async storeAllProjectsForTeam(linearTeamId: string): Promise<EmbeddingResult> {
		const result: EmbeddingResult = {
			processed: 0,
			skipped: 0,
			errors: []
		};

		try {
			const projects = await db.query.linearProjects.findMany({
				where: and(
					eq(linearProjects.userId, this.userId),
					eq(linearProjects.linearTeamId, linearTeamId)
				)
			});

			for (const project of projects) {
				try {
					if (project.pineconeId) {
						result.skipped++;
						continue;
					}

					await this.storeProject(project.id);
					result.processed++;
				} catch (error) {
					const err = error as Error;
					result.errors.push(`Project ${project.name}: ${err.message}`);
				}
			}

			console.log(`[Client Intelligence] Team ${linearTeamId}: ${result.processed} projects stored`);
		} catch (error) {
			const err = error as Error;
			result.errors.push(`Failed to store projects: ${err.message}`);
		}

		return result;
	}

	/**
	 * Store all issues for a project in Pinecone
	 */
	async storeAllIssuesForProject(linearProjectId: string): Promise<EmbeddingResult> {
		const result: EmbeddingResult = {
			processed: 0,
			skipped: 0,
			errors: []
		};

		try {
			const project = await db.query.linearProjects.findFirst({
				where: eq(linearProjects.id, linearProjectId),
				with: {
					issues: true
				}
			});

			if (!project) {
				throw new Error(`Project ${linearProjectId} not found`);
			}

			for (const issue of project.issues) {
				try {
					if (issue.pineconeId) {
						result.skipped++;
						continue;
					}

					await this.storeIssue(issue.id);
					result.processed++;
				} catch (error) {
					const err = error as Error;
					result.errors.push(`Issue ${issue.identifier}: ${err.message}`);
				}
			}

			console.log(`[Client Intelligence] Project ${project.name}: ${result.processed} issues stored`);
		} catch (error) {
			const err = error as Error;
			result.errors.push(`Failed to store issues: ${err.message}`);
		}

		return result;
	}

	/**
	 * Store all unstored interactions for a team
	 */
	async storeAllInteractionsForTeam(linearTeamId: string): Promise<EmbeddingResult> {
		const result: EmbeddingResult = {
			processed: 0,
			skipped: 0,
			errors: []
		};

		try {
			// Get all interactions for this team that aren't stored yet
			const allInteractions = await db.query.interactions.findMany({
				where: and(
					eq(interactions.userId, this.userId),
					eq(interactions.pineconeStored, false)
				)
			});

			// Filter by team ID in metadata
			const teamInteractions = allInteractions.filter(i =>
				i.metadata?.linearTeamId === linearTeamId
			);

			for (const interaction of teamInteractions) {
				try {
					await this.storeInteraction(interaction.id);
					result.processed++;
				} catch (error) {
					const err = error as Error;
					result.errors.push(`Interaction ${interaction.title}: ${err.message}`);
				}
			}

			console.log(`[Client Intelligence] Team ${linearTeamId}: ${result.processed} interactions stored`);
		} catch (error) {
			const err = error as Error;
			result.errors.push(`Failed to store interactions: ${err.message}`);
		}

		return result;
	}
}

/**
 * Create client intelligence service for a user
 */
export function createClientIntelligenceService(userId: string): ClientIntelligenceService {
	return new ClientIntelligenceService(userId);
}

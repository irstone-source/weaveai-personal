/**
 * Client RAG (Retrieval Augmented Generation) Service
 *
 * Provides semantic search across client-specific Pinecone indexes
 * for context-aware chat responses.
 *
 * Usage in chat API:
 * 1. Detect client context from conversation
 * 2. Query relevant client index
 * 3. Include results as context in LLM prompt
 */

import { OpenAI } from 'openai';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { linearTeamMappings, clientProfiles } from '$lib/server/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { pineconeManager } from './pinecone-manager';

export interface RAGContext {
	type: 'project' | 'issue' | 'interaction';
	id: string;
	title: string;
	content: string;
	metadata: Record<string, any>;
	relevanceScore: number;
	source: string; // e.g., "Linear Project", "Meeting Transcript"
}

export interface RAGQuery {
	query: string;
	clientId?: string; // Linear team ID or client profile ID
	filters?: {
		types?: ('project' | 'issue' | 'interaction')[];
		dateRange?: { start: Date; end: Date };
		priority?: string[];
		status?: string[];
	};
	topK?: number;
}

export interface RAGResult {
	contexts: RAGContext[];
	clientName: string;
	indexName: string;
	totalResults: number;
}

/**
 * Client RAG Service
 */
export class ClientRAGService {
	private openai: OpenAI;

	constructor(private userId: string) {
		this.openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY || ''
		});
	}

	/**
	 * Generate embedding for query
	 */
	private async generateQueryEmbedding(query: string): Promise<number[]> {
		try {
			const response = await this.openai.embeddings.create({
				model: 'text-embedding-3-small',
				input: query
			});
			return response.data[0].embedding;
		} catch (error) {
			console.error('[Client RAG] Error generating embedding:', error);
			throw error;
		}
	}

	/**
	 * Build Pinecone filter from query options
	 */
	private buildPineconeFilter(filters?: RAGQuery['filters']): Record<string, any> {
		const filter: Record<string, any> = {};

		if (!filters) return filter;

		// Filter by type
		if (filters.types && filters.types.length > 0) {
			filter.type = { $in: filters.types };
		}

		// Filter by date range
		if (filters.dateRange) {
			filter.$and = [
				{ timestamp: { $gte: filters.dateRange.start.toISOString() } },
				{ timestamp: { $lte: filters.dateRange.end.toISOString() } }
			];
		}

		// Filter by priority
		if (filters.priority && filters.priority.length > 0) {
			filter.priorityLabel = { $in: filters.priority };
		}

		// Filter by status
		if (filters.status && filters.status.length > 0) {
			filter.status = { $in: filters.status };
		}

		return filter;
	}

	/**
	 * Format Pinecone result as RAG context
	 */
	private formatContext(match: any): RAGContext {
		const metadata = match.metadata || {};
		const type = metadata.type || 'unknown';

		let title = '';
		let content = '';
		let source = '';

		switch (type) {
			case 'project':
				title = metadata.name || 'Untitled Project';
				content = metadata.description || '';
				source = 'Linear Project';
				break;

			case 'issue':
				title = `${metadata.identifier}: ${metadata.title}` || 'Untitled Issue';
				content = metadata.description || '';
				source = 'Linear Issue';
				break;

			case 'interaction':
				title = metadata.title || 'Untitled Interaction';
				content = metadata.content || '';
				source = this.getInteractionSource(metadata.interactionType);
				break;

			default:
				title = 'Unknown';
				content = '';
				source = 'Unknown';
		}

		return {
			type: type as any,
			id: metadata[`${type}Id`] || match.id,
			title,
			content: content.substring(0, 500), // Limit content length
			metadata,
			relevanceScore: match.score || 0,
			source
		};
	}

	/**
	 * Get human-readable source for interaction type
	 */
	private getInteractionSource(interactionType: string): string {
		const mapping: Record<string, string> = {
			'linear_comment': 'Linear Comment',
			'linear_issue_update': 'Linear Update',
			'fathom_meeting': 'Fathom Meeting',
			'google_meet': 'Google Meet',
			'webrtc_meeting': 'Meeting Recording',
			'slack_thread': 'Slack Thread',
			'email': 'Email',
			'manual_note': 'Manual Note'
		};

		return mapping[interactionType] || 'Interaction';
	}

	/**
	 * Query client context by Linear team ID
	 */
	async queryByLinearTeam(
		linearTeamId: string,
		query: string,
		options?: Partial<RAGQuery>
	): Promise<RAGResult> {
		try {
			// Get team mapping
			const teamMapping = await db.query.linearTeamMappings.findFirst({
				where: and(
					eq(linearTeamMappings.userId, this.userId),
					eq(linearTeamMappings.linearTeamId, linearTeamId)
				)
			});

			if (!teamMapping) {
				throw new Error(`Team mapping not found for ${linearTeamId}`);
			}

			// Get Pinecone index
			const index = await pineconeManager.getClientIndex(
				this.userId,
				linearTeamId,
				teamMapping.linearTeamName
			);

			// Generate query embedding
			const queryEmbedding = await this.generateQueryEmbedding(query);

			// Build filter
			const filter = this.buildPineconeFilter(options?.filters);

			// Query Pinecone
			const results = await index.query({
				vector: queryEmbedding,
				topK: options?.topK || 10,
				includeMetadata: true,
				filter
			});

			// Format results
			const contexts = results.matches.map(match => this.formatContext(match));

			return {
				contexts,
				clientName: teamMapping.linearTeamName,
				indexName: teamMapping.pineconeIndexName || '',
				totalResults: results.matches.length
			};
		} catch (error) {
			const err = error as Error;
			console.error('[Client RAG] Query failed:', err);
			throw error;
		}
	}

	/**
	 * Query client context by client email (auto-detects Linear team)
	 */
	async queryByClientEmail(
		clientEmail: string,
		query: string,
		options?: Partial<RAGQuery>
	): Promise<RAGResult> {
		try {
			// Find client profile
			const client = await db.query.clientProfiles.findFirst({
				where: eq(clientProfiles.primaryEmail, clientEmail)
			});

			if (!client) {
				throw new Error(`Client not found: ${clientEmail}`);
			}

			// Find associated Linear team by searching interactions
			const interaction = await db.query.interactions.findFirst({
				where: and(
					eq(interactions.userId, this.userId),
					eq(interactions.clientProfileId, client.id)
				)
			});

			if (!interaction || !interaction.metadata?.linearTeamId) {
				throw new Error(`No Linear team found for client ${clientEmail}`);
			}

			const linearTeamId = interaction.metadata.linearTeamId as string;

			return this.queryByLinearTeam(linearTeamId, query, options);
		} catch (error) {
			const err = error as Error;
			console.error('[Client RAG] Query by client email failed:', err);
			throw error;
		}
	}

	/**
	 * Query all available client contexts (multi-client search)
	 */
	async queryAllClients(
		query: string,
		options?: Partial<RAGQuery>
	): Promise<RAGResult[]> {
		try {
			// Get all team mappings for user
			const teamMappings = await db.query.linearTeamMappings.findMany({
				where: and(
					eq(linearTeamMappings.userId, this.userId),
					eq(linearTeamMappings.syncEnabled, true)
				)
			});

			// Query each client index
			const results = await Promise.all(
				teamMappings.map(mapping =>
					this.queryByLinearTeam(mapping.linearTeamId, query, options)
				)
			);

			return results.filter(r => r.contexts.length > 0);
		} catch (error) {
			const err = error as Error;
			console.error('[Client RAG] Multi-client query failed:', err);
			throw error;
		}
	}

	/**
	 * Format contexts for LLM prompt
	 */
	formatContextsForPrompt(contexts: RAGContext[]): string {
		if (contexts.length === 0) {
			return 'No relevant context found.';
		}

		const formatted = contexts.map((ctx, idx) => {
			return `
[${idx + 1}] ${ctx.source}: ${ctx.title}
Relevance: ${(ctx.relevanceScore * 100).toFixed(1)}%
${ctx.content}
			`.trim();
		}).join('\n\n---\n\n');

		return `
Relevant Context from Client Data:

${formatted}
		`.trim();
	}

	/**
	 * Smart client detection from conversation context
	 */
	async detectClientFromConversation(
		conversationHistory: Array<{ role: string; content: string }>
	): Promise<string | null> {
		try {
			// Extract potential client identifiers from conversation
			const allContent = conversationHistory
				.map(m => m.content)
				.join(' ')
				.toLowerCase();

			// Get all team mappings
			const teamMappings = await db.query.linearTeamMappings.findMany({
				where: eq(linearTeamMappings.userId, this.userId)
			});

			// Find team mentioned in conversation
			for (const mapping of teamMappings) {
				const teamName = mapping.linearTeamName.toLowerCase();
				if (allContent.includes(teamName)) {
					return mapping.linearTeamId;
				}
			}

			// Check for email mentions
			const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
			const emails = allContent.match(emailRegex);

			if (emails && emails.length > 0) {
				for (const email of emails) {
					try {
						const result = await this.queryByClientEmail(email, '', { topK: 1 });
						if (result.contexts.length > 0) {
							// Extract team ID from result
							const teamMapping = await db.query.linearTeamMappings.findFirst({
								where: eq(linearTeamMappings.pineconeIndexName, result.indexName)
							});
							return teamMapping?.linearTeamId || null;
						}
					} catch (err) {
						// Continue to next email
						continue;
					}
				}
			}

			return null;
		} catch (error) {
			console.error('[Client RAG] Client detection failed:', error);
			return null;
		}
	}
}

/**
 * Create RAG service for a user
 */
export function createClientRAGService(userId: string): ClientRAGService {
	return new ClientRAGService(userId);
}

/**
 * Helper function to enhance chat messages with client context
 */
export async function enhanceChatWithClientContext(
	userId: string,
	userMessage: string,
	conversationHistory: Array<{ role: string; content: string }>,
	options?: {
		clientId?: string;
		topK?: number;
		filters?: RAGQuery['filters'];
	}
): Promise<{ enhancedPrompt: string; contexts: RAGContext[] }> {
	const ragService = createClientRAGService(userId);

	// Detect or use provided client ID
	let clientId = options?.clientId;

	if (!clientId) {
		clientId = await ragService.detectClientFromConversation([
			...conversationHistory,
			{ role: 'user', content: userMessage }
		]);
	}

	// If no client detected, return original message
	if (!clientId) {
		return {
			enhancedPrompt: userMessage,
			contexts: []
		};
	}

	// Query client context
	const result = await ragService.queryByLinearTeam(clientId, userMessage, {
		topK: options?.topK || 5,
		filters: options?.filters
	});

	// Format context for prompt
	const contextStr = ragService.formatContextsForPrompt(result.contexts);

	// Enhanced prompt
	const enhancedPrompt = `
${contextStr}

---

User Query: ${userMessage}

Please provide a response based on the above context from ${result.clientName}'s project data.
	`.trim();

	return {
		enhancedPrompt,
		contexts: result.contexts
	};
}

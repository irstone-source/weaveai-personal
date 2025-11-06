/**
 * Linear Sync Service
 *
 * Handles initial sync and incremental updates of Linear data:
 * - Teams → Team Mappings (auto-create on first sync)
 * - Projects → Database + Pinecone embeddings
 * - Issues → Database + Pinecone embeddings
 * - Comments → Interactions table
 *
 * Supports both:
 * - Full sync (initial setup)
 * - Incremental sync (webhook-triggered or scheduled)
 */

import { randomUUID } from 'crypto';
import { db } from '$lib/server/db';
import {
	linearIntegrations,
	linearTeamMappings,
	linearProjects,
	linearIssues
} from '$lib/server/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { linearGraphQLRequest, getLinearTeams, getLinearProjects, getLinearIssues } from './linear';
import { pineconeManager } from './pinecone-manager';

export interface SyncResult {
	success: boolean;
	stats: {
		teamsCreated: number;
		teamsUpdated: number;
		projectsCreated: number;
		projectsUpdated: number;
		issuesCreated: number;
		issuesUpdated: number;
	};
	errors: string[];
}

export interface SyncOptions {
	fullSync?: boolean; // If true, sync all data; if false, only sync changes since lastSyncAt
	createPineconeIndexes?: boolean; // Auto-create Pinecone indexes for new teams
	generateEmbeddings?: boolean; // Generate and store embeddings (Phase 6 - will implement later)
}

/**
 * Linear Sync Service
 */
export class LinearSyncService {
	constructor(
		private userId: string,
		private integrationId: string,
		private accessToken: string
	) {}

	/**
	 * Perform full sync of all Linear data
	 */
	async fullSync(options: SyncOptions = {}): Promise<SyncResult> {
		const result: SyncResult = {
			success: true,
			stats: {
				teamsCreated: 0,
				teamsUpdated: 0,
				projectsCreated: 0,
				projectsUpdated: 0,
				issuesCreated: 0,
				issuesUpdated: 0
			},
			errors: []
		};

		try {
			console.log(`[Linear Sync] Starting full sync for user ${this.userId}`);

			// 1. Sync teams (with auto-create team mappings)
			const teamsResult = await this.syncTeams(options.createPineconeIndexes ?? true);
			result.stats.teamsCreated = teamsResult.created;
			result.stats.teamsUpdated = teamsResult.updated;
			result.errors.push(...teamsResult.errors);

			// 2. For each team, sync projects and issues
			const teamMappings = await db.query.linearTeamMappings.findMany({
				where: and(
					eq(linearTeamMappings.userId, this.userId),
					eq(linearTeamMappings.syncEnabled, true)
				)
			});

			for (const mapping of teamMappings) {
				try {
					// Sync projects for this team
					const projectsResult = await this.syncProjectsForTeam(mapping.linearTeamId);
					result.stats.projectsCreated += projectsResult.created;
					result.stats.projectsUpdated += projectsResult.updated;
					result.errors.push(...projectsResult.errors);

					// Sync issues for each project
					const projects = await db.query.linearProjects.findMany({
						where: and(
							eq(linearProjects.userId, this.userId),
							eq(linearProjects.linearTeamId, mapping.linearTeamId)
						)
					});

					for (const project of projects) {
						const issuesResult = await this.syncIssuesForProject(project.linearProjectId);
						result.stats.issuesCreated += issuesResult.created;
						result.stats.issuesUpdated += issuesResult.updated;
						result.errors.push(...issuesResult.errors);
					}

					// Update last sync time for team mapping
					await db
						.update(linearTeamMappings)
						.set({ lastSyncAt: new Date(), updatedAt: new Date() })
						.where(eq(linearTeamMappings.id, mapping.id));

				} catch (error) {
					const err = error as Error;
					console.error(`[Linear Sync] Error syncing team ${mapping.linearTeamId}:`, err);
					result.errors.push(`Team ${mapping.linearTeamName}: ${err.message}`);
				}
			}

			// Update integration sync time
			await db
				.update(linearIntegrations)
				.set({ lastSyncAt: new Date(), updatedAt: new Date() })
				.where(eq(linearIntegrations.id, this.integrationId));

			console.log(`[Linear Sync] Full sync completed:`, result.stats);
			result.success = result.errors.length === 0;

		} catch (error) {
			const err = error as Error;
			console.error('[Linear Sync] Full sync failed:', err);
			result.success = false;
			result.errors.push(err.message);
		}

		return result;
	}

	/**
	 * Sync teams and auto-create team mappings
	 */
	private async syncTeams(createIndexes = true): Promise<{ created: number; updated: number; errors: string[] }> {
		const result = { created: 0, updated: 0, errors: [] as string[] };

		try {
			const teamsData = await getLinearTeams(this.accessToken);
			const teams = teamsData.teams.nodes;

			for (const team of teams) {
				try {
					// Check if mapping exists
					const existing = await db.query.linearTeamMappings.findFirst({
						where: and(
							eq(linearTeamMappings.userId, this.userId),
							eq(linearTeamMappings.linearTeamId, team.id)
						)
					});

					if (existing) {
						// Update existing mapping
						await db
							.update(linearTeamMappings)
							.set({
								linearTeamName: team.name,
								updatedAt: new Date()
							})
							.where(eq(linearTeamMappings.id, existing.id));

						result.updated++;
					} else {
						// Create new mapping (auto-created)
						const newMapping = await db.insert(linearTeamMappings).values({
							id: randomUUID(),
							userId: this.userId,
							linearTeamId: team.id,
							linearTeamName: team.name,
							autoCreated: true,
							syncEnabled: true,
							webhookConfigured: false
						}).returning();

						result.created++;

						// Create Pinecone index for this client
						if (createIndexes && pineconeManager.isInitialized()) {
							try {
								await pineconeManager.createClientIndex(
									this.userId,
									team.id,
									team.name
								);
								console.log(`[Linear Sync] Created Pinecone index for team ${team.name}`);
							} catch (error) {
								const err = error as Error;
								console.warn(`[Linear Sync] Failed to create Pinecone index for team ${team.name}:`, err.message);
								result.errors.push(`Pinecone index creation for ${team.name}: ${err.message}`);
							}
						}
					}
				} catch (error) {
					const err = error as Error;
					result.errors.push(`Team ${team.name}: ${err.message}`);
				}
			}

			console.log(`[Linear Sync] Teams synced: ${result.created} created, ${result.updated} updated`);
		} catch (error) {
			const err = error as Error;
			result.errors.push(`Teams sync failed: ${err.message}`);
		}

		return result;
	}

	/**
	 * Sync projects for a specific team
	 */
	private async syncProjectsForTeam(teamId: string): Promise<{ created: number; updated: number; errors: string[] }> {
		const result = { created: 0, updated: 0, errors: [] as string[] };

		try {
			const projects = await getLinearProjects(this.accessToken, teamId);

			for (const project of projects) {
				try {
					// Check if project exists
					const existing = await db.query.linearProjects.findFirst({
						where: eq(linearProjects.linearProjectId, project.id)
					});

					const projectData = {
						userId: this.userId,
						linearTeamId: teamId,
						linearProjectId: project.id,
						name: project.name,
						description: project.description || null,
						state: project.state,
						lead: project.lead?.name || null,
						leadEmail: project.lead?.email || null,
						startDate: project.startDate ? new Date(project.startDate) : null,
						targetDate: project.targetDate ? new Date(project.targetDate) : null,
						lastSyncedAt: new Date(),
						updatedAt: new Date()
					};

					if (existing) {
						// Update existing project
						await db
							.update(linearProjects)
							.set(projectData)
							.where(eq(linearProjects.id, existing.id));

						result.updated++;
					} else {
						// Create new project
						await db.insert(linearProjects).values({
							id: randomUUID(),
							...projectData,
							createdAt: new Date()
						});

						result.created++;
					}
				} catch (error) {
					const err = error as Error;
					result.errors.push(`Project ${project.name}: ${err.message}`);
				}
			}

			console.log(`[Linear Sync] Projects for team ${teamId}: ${result.created} created, ${result.updated} updated`);
		} catch (error) {
			const err = error as Error;
			result.errors.push(`Projects sync for team ${teamId}: ${err.message}`);
		}

		return result;
	}

	/**
	 * Sync issues for a specific project
	 */
	private async syncIssuesForProject(projectId: string): Promise<{ created: number; updated: number; errors: string[] }> {
		const result = { created: 0, updated: 0, errors: [] as string[] };

		try {
			// Get our internal project record
			const project = await db.query.linearProjects.findFirst({
				where: eq(linearProjects.linearProjectId, projectId)
			});

			if (!project) {
				throw new Error(`Project ${projectId} not found in database`);
			}

			const issues = await getLinearIssues(this.accessToken, projectId);

			for (const issue of issues) {
				try {
					// Check if issue exists
					const existing = await db.query.linearIssues.findFirst({
						where: eq(linearIssues.linearIssueId, issue.id)
					});

					// Generate identifier from URL or construct it
					const identifier = issue.identifier || `${issue.id}`;

					const issueData = {
						linearProjectId: project.id,
						linearIssueId: issue.id,
						identifier,
						title: issue.title,
						description: issue.description || null,
						priority: issue.priority || 0,
						priorityLabel: issue.priorityLabel || 'No priority',
						status: issue.state.name,
						statusType: issue.state.type,
						assignee: issue.assignee?.name || null,
						assigneeEmail: issue.assignee?.email || null,
						estimate: issue.estimate || null,
						dueDate: issue.dueDate ? new Date(issue.dueDate) : null,
						completedAt: issue.completedAt ? new Date(issue.completedAt) : null,
						url: issue.url,
						labels: issue.labels?.nodes || [],
						lastSyncedAt: new Date(),
						updatedAt: new Date()
					};

					if (existing) {
						// Update existing issue
						await db
							.update(linearIssues)
							.set(issueData)
							.where(eq(linearIssues.id, existing.id));

						result.updated++;
					} else {
						// Create new issue
						await db.insert(linearIssues).values({
							id: randomUUID(),
							...issueData,
							createdAt: new Date()
						});

						result.created++;
					}
				} catch (error) {
					const err = error as Error;
					result.errors.push(`Issue ${issue.title}: ${err.message}`);
				}
			}

			console.log(`[Linear Sync] Issues for project ${projectId}: ${result.created} created, ${result.updated} updated`);
		} catch (error) {
			const err = error as Error;
			result.errors.push(`Issues sync for project ${projectId}: ${err.message}`);
		}

		return result;
	}

	/**
	 * Incremental sync - only sync changes since last sync
	 */
	async incrementalSync(since?: Date): Promise<SyncResult> {
		const result: SyncResult = {
			success: true,
			stats: {
				teamsCreated: 0,
				teamsUpdated: 0,
				projectsCreated: 0,
				projectsUpdated: 0,
				issuesCreated: 0,
				issuesUpdated: 0
			},
			errors: []
		};

		try {
			// Get last sync time from integration if not provided
			if (!since) {
				const integration = await db.query.linearIntegrations.findFirst({
					where: eq(linearIntegrations.id, this.integrationId)
				});
				since = integration?.lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24 hours ago
			}

			console.log(`[Linear Sync] Starting incremental sync since ${since.toISOString()}`);

			// For now, perform same as full sync but could be optimized with Linear's updatedAt filters
			// Linear GraphQL API supports filtering by updatedAt in the future
			const fullSyncResult = await this.fullSync({ fullSync: false });
			result.stats = fullSyncResult.stats;
			result.errors = fullSyncResult.errors;
			result.success = fullSyncResult.success;

		} catch (error) {
			const err = error as Error;
			console.error('[Linear Sync] Incremental sync failed:', err);
			result.success = false;
			result.errors.push(err.message);
		}

		return result;
	}

	/**
	 * Sync a single issue (webhook trigger)
	 */
	async syncSingleIssue(issueId: string): Promise<void> {
		console.log(`[Linear Sync] Syncing single issue ${issueId}`);

		// Fetch issue data from Linear
		const query = `
			query($issueId: String!) {
				issue(id: $issueId) {
					id
					identifier
					title
					description
					priority
					priorityLabel
					state {
						id
						name
						type
					}
					assignee {
						id
						name
						email
					}
					estimate
					dueDate
					createdAt
					updatedAt
					completedAt
					url
					labels {
						nodes {
							id
							name
							color
						}
					}
					project {
						id
					}
				}
			}
		`;

		const result = await linearGraphQLRequest(this.accessToken, query, { issueId });
		const issue = result.issue;

		// Find our internal project record
		const project = await db.query.linearProjects.findFirst({
			where: eq(linearProjects.linearProjectId, issue.project.id)
		});

		if (!project) {
			throw new Error(`Project ${issue.project.id} not found`);
		}

		// Check if issue exists
		const existing = await db.query.linearIssues.findFirst({
			where: eq(linearIssues.linearIssueId, issue.id)
		});

		const issueData = {
			linearProjectId: project.id,
			linearIssueId: issue.id,
			identifier: issue.identifier,
			title: issue.title,
			description: issue.description || null,
			priority: issue.priority || 0,
			priorityLabel: issue.priorityLabel || 'No priority',
			status: issue.state.name,
			statusType: issue.state.type,
			assignee: issue.assignee?.name || null,
			assigneeEmail: issue.assignee?.email || null,
			estimate: issue.estimate || null,
			dueDate: issue.dueDate ? new Date(issue.dueDate) : null,
			completedAt: issue.completedAt ? new Date(issue.completedAt) : null,
			url: issue.url,
			labels: issue.labels?.nodes || [],
			lastSyncedAt: new Date(),
			updatedAt: new Date()
		};

		if (existing) {
			await db
				.update(linearIssues)
				.set(issueData)
				.where(eq(linearIssues.id, existing.id));
		} else {
			await db.insert(linearIssues).values({
				id: randomUUID(),
				...issueData,
				createdAt: new Date()
			});
		}

		console.log(`[Linear Sync] Issue ${issue.identifier} synced successfully`);
	}
}

/**
 * Create sync service for a user's Linear integration
 */
export async function createLinearSyncService(userId: string): Promise<LinearSyncService | null> {
	const integration = await db.query.linearIntegrations.findFirst({
		where: eq(linearIntegrations.userId, userId)
	});

	if (!integration || !integration.accessToken) {
		return null;
	}

	return new LinearSyncService(userId, integration.id, integration.accessToken);
}

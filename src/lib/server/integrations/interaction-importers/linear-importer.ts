/**
 * Linear Interaction Importer
 *
 * Converts Linear comments and issue updates into unified interaction records.
 * Used by:
 * - Linear sync service (initial sync)
 * - Linear webhooks (real-time updates)
 */

import { randomUUID } from 'crypto';
import { db } from '$lib/server/db';
import { interactions, linearIssues, linearProjects, linearTeamMappings, clientProfiles } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { linearGraphQLRequest } from '../linear';

interface LinearComment {
	id: string;
	body: string;
	createdAt: string;
	updatedAt: string;
	user: {
		id: string;
		name: string;
		email?: string;
	};
	issue: {
		id: string;
		identifier: string;
		title: string;
		url: string;
	};
}

interface ImportResult {
	imported: number;
	skipped: number;
	errors: string[];
}

/**
 * Linear Interaction Importer
 */
export class LinearInteractionImporter {
	constructor(
		private userId: string,
		private accessToken: string
	) {}

	/**
	 * Import comments for a specific issue
	 */
	async importCommentsForIssue(linearIssueId: string): Promise<ImportResult> {
		const result: ImportResult = {
			imported: 0,
			skipped: 0,
			errors: []
		};

		try {
			// Fetch comments from Linear
			const comments = await this.fetchIssueComments(linearIssueId);

			// Get our internal issue record
			const issue = await db.query.linearIssues.findFirst({
				where: eq(linearIssues.linearIssueId, linearIssueId),
				with: {
					project: {
						with: {
							teamMapping: true
						}
					}
				}
			});

			if (!issue) {
				throw new Error(`Issue ${linearIssueId} not found in database`);
			}

			// Find client profile based on issue assignee email
			let clientProfile = null;
			if (issue.assigneeEmail) {
				clientProfile = await db.query.clientProfiles.findFirst({
					where: eq(clientProfiles.clientEmail, issue.assigneeEmail)
				});
			}

			// Import each comment as an interaction
			for (const comment of comments) {
				try {
					// Check if interaction already exists
					const existing = await db.query.interactions.findFirst({
						where: and(
							eq(interactions.userId, this.userId),
							eq(interactions.sourceId, comment.id)
						)
					});

					if (existing) {
						result.skipped++;
						continue;
					}

					// Create interaction record
					await db.insert(interactions).values({
						id: randomUUID(),
						userId: this.userId,
						projectId: null, // Will link to internal project in future
						clientProfileId: clientProfile?.id || null,
						interactionType: 'linear_comment',
						sourceId: comment.id,
						sourceUrl: comment.issue.url,
						title: `Comment on ${comment.issue.identifier}: ${comment.issue.title}`,
						content: comment.body,
						participants: [
							{
								name: comment.user.name,
								email: comment.user.email,
								role: 'commenter'
							}
						],
						sentiment: null, // Will be set by auto-categorization
						priority: 'none',
						tags: ['linear', 'comment'],
						metadata: {
							linearCommentId: comment.id,
							linearIssueId: comment.issue.id,
							linearIssueIdentifier: comment.issue.identifier,
							linearTeamId: (issue as any).project?.linearTeamId
						},
						pineconeStored: false,
						interactionDate: new Date(comment.createdAt),
						createdAt: new Date(),
						updatedAt: new Date()
					});

					result.imported++;
				} catch (error) {
					const err = error as Error;
					result.errors.push(`Comment ${comment.id}: ${err.message}`);
				}
			}

			console.log(`[Linear Importer] Comments for issue ${linearIssueId}: ${result.imported} imported, ${result.skipped} skipped`);
		} catch (error) {
			const err = error as Error;
			result.errors.push(`Failed to import comments: ${err.message}`);
		}

		return result;
	}

	/**
	 * Import issue status change as an interaction
	 */
	async importIssueUpdate(
		linearIssueId: string,
		updateType: 'status_change' | 'assignment' | 'priority_change',
		oldValue: string,
		newValue: string
	): Promise<void> {
		try {
			// Get issue details
			const issue = await db.query.linearIssues.findFirst({
				where: eq(linearIssues.linearIssueId, linearIssueId),
				with: {
					project: true
				}
			});

			if (!issue) {
				throw new Error(`Issue ${linearIssueId} not found`);
			}

			// Find client profile
			let clientProfile = null;
			if (issue.assigneeEmail) {
				clientProfile = await db.query.clientProfiles.findFirst({
					where: eq(clientProfiles.clientEmail, issue.assigneeEmail)
				});
			}

			// Create descriptive title based on update type
			let title = '';
			let content = '';

			switch (updateType) {
				case 'status_change':
					title = `${issue.identifier} status changed: ${oldValue} → ${newValue}`;
					content = `Issue "${issue.title}" status changed from ${oldValue} to ${newValue}`;
					break;
				case 'assignment':
					title = `${issue.identifier} assigned to ${newValue}`;
					content = `Issue "${issue.title}" was assigned to ${newValue}`;
					break;
				case 'priority_change':
					title = `${issue.identifier} priority changed: ${oldValue} → ${newValue}`;
					content = `Issue "${issue.title}" priority changed from ${oldValue} to ${newValue}`;
					break;
			}

			// Create interaction record
			await db.insert(interactions).values({
				id: randomUUID(),
				userId: this.userId,
				projectId: null,
				clientProfileId: clientProfile?.id || null,
				interactionType: 'linear_issue_update',
				sourceId: `${linearIssueId}_${updateType}_${Date.now()}`,
				sourceUrl: issue.url,
				title,
				content,
				participants: issue.assignee ? [
					{
						name: issue.assignee,
						email: issue.assigneeEmail || undefined,
						role: 'assignee'
					}
				] : [],
				sentiment: null,
				priority: 'none',
				tags: ['linear', 'issue_update', updateType],
					metadata: {
						linearIssueId,
						linearIssueIdentifier: issue.identifier,
						updateType,
						oldValue,
						newValue,
						linearTeamId: (issue as any).project?.linearTeamId
					},
				pineconeStored: false,
				interactionDate: new Date(),
				createdAt: new Date(),
				updatedAt: new Date()
			});

			console.log(`[Linear Importer] Issue update recorded: ${title}`);
		} catch (error) {
			const err = error as Error;
			console.error('[Linear Importer] Failed to import issue update:', err);
			throw err;
		}
	}

	/**
	 * Fetch comments from Linear API
	 */
	private async fetchIssueComments(issueId: string): Promise<LinearComment[]> {
		const query = `
			query($issueId: String!) {
				issue(id: $issueId) {
					comments {
						nodes {
							id
							body
							createdAt
							updatedAt
							user {
								id
								name
								email
							}
							issue {
								id
								identifier
								title
								url
							}
						}
					}
				}
			}
		`;

		const result = await linearGraphQLRequest(this.accessToken, query, { issueId });
		return result.issue.comments.nodes;
	}

	/**
	 * Import all comments for all issues in a project
	 */
	async importAllCommentsForProject(linearProjectId: string): Promise<ImportResult> {
		const totalResult: ImportResult = {
			imported: 0,
			skipped: 0,
			errors: []
		};

		try {
			// Get all issues for this project
			const project = await db.query.linearProjects.findFirst({
				where: eq(linearProjects.linearProjectId, linearProjectId),
				with: {
					issues: true
				}
			});

			if (!project) {
				throw new Error(`Project ${linearProjectId} not found`);
			}

			// Import comments for each issue
			for (const issue of project.issues) {
				const result = await this.importCommentsForIssue(issue.linearIssueId);
				totalResult.imported += result.imported;
				totalResult.skipped += result.skipped;
				totalResult.errors.push(...result.errors);
			}

			console.log(`[Linear Importer] Project ${project.name}: ${totalResult.imported} comments imported`);
		} catch (error) {
			const err = error as Error;
			totalResult.errors.push(`Project import failed: ${err.message}`);
		}

		return totalResult;
	}

	/**
	 * Import all comments for all projects in a team
	 */
	async importAllCommentsForTeam(linearTeamId: string): Promise<ImportResult> {
		const totalResult: ImportResult = {
			imported: 0,
			skipped: 0,
			errors: []
		};

		try {
			// Get all projects for this team
			const projects = await db.query.linearProjects.findMany({
				where: and(
					eq(linearProjects.userId, this.userId),
					eq(linearProjects.linearTeamId, linearTeamId)
				)
			});

			// Import comments for each project
			for (const project of projects) {
				const result = await this.importAllCommentsForProject(project.linearProjectId);
				totalResult.imported += result.imported;
				totalResult.skipped += result.skipped;
				totalResult.errors.push(...result.errors);
			}

			console.log(`[Linear Importer] Team ${linearTeamId}: ${totalResult.imported} total comments imported`);
		} catch (error) {
			const err = error as Error;
			totalResult.errors.push(`Team import failed: ${err.message}`);
		}

		return totalResult;
	}
}

/**
 * Create Linear importer for a user
 */
export async function createLinearImporter(userId: string, accessToken: string): Promise<LinearInteractionImporter> {
	return new LinearInteractionImporter(userId, accessToken);
}

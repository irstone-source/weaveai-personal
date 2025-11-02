/**
 * Linear Mutation Service
 *
 * Provides GraphQL mutations for creating and updating Linear issues.
 * Used by AI tools to take actions in Linear from chat.
 */

import { GraphQLClient, gql } from 'graphql-request';
import { db } from '$lib/server/db';
import { linearIntegrations, linearTeamMappings, linearProjects, linearIssues } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

export interface CreateIssueInput {
	teamId: string;
	title: string;
	description?: string;
	priority?: number; // 0 = None, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
	projectId?: string;
	assigneeId?: string;
	labelIds?: string[];
	stateId?: string;
}

export interface UpdateIssueInput {
	issueId: string;
	title?: string;
	description?: string;
	priority?: number;
	stateId?: string;
	assigneeId?: string;
	labelIds?: string[];
}

export interface CreateCommentInput {
	issueId: string;
	body: string;
}

/**
 * Linear Mutation Service
 */
export class LinearMutationService {
	private client: GraphQLClient;

	constructor(private userId: string, private accessToken: string) {
		this.client = new GraphQLClient(LINEAR_API_URL, {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});
	}

	/**
	 * Create a new issue
	 */
	async createIssue(input: CreateIssueInput): Promise<{
		success: boolean;
		issue?: any;
		error?: string;
	}> {
		try {
			const mutation = gql`
				mutation CreateIssue(
					$teamId: String!
					$title: String!
					$description: String
					$priority: Int
					$projectId: String
					$assigneeId: String
					$labelIds: [String!]
					$stateId: String
				) {
					issueCreate(
						input: {
							teamId: $teamId
							title: $title
							description: $description
							priority: $priority
							projectId: $projectId
							assigneeId: $assigneeId
							labelIds: $labelIds
							stateId: $stateId
						}
					) {
						success
						issue {
							id
							identifier
							title
							description
							url
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
							project {
								id
								name
							}
							labels {
								nodes {
									id
									name
									color
								}
							}
						}
					}
				}
			`;

			const response: any = await this.client.request(mutation, input);

			if (response.issueCreate.success) {
				const issue = response.issueCreate.issue;

				// Cache in database
				await this.cacheIssue(issue);

				return {
					success: true,
					issue: {
						id: issue.id,
						identifier: issue.identifier,
						title: issue.title,
						url: issue.url,
						priority: issue.priorityLabel,
						state: issue.state.name,
						assignee: issue.assignee?.name
					}
				};
			}

			return {
				success: false,
				error: 'Failed to create issue'
			};
		} catch (error) {
			const err = error as Error;
			console.error('[Linear Mutations] Create issue failed:', err);
			return {
				success: false,
				error: err.message
			};
		}
	}

	/**
	 * Update an existing issue
	 */
	async updateIssue(input: UpdateIssueInput): Promise<{
		success: boolean;
		issue?: any;
		error?: string;
	}> {
		try {
			const mutation = gql`
				mutation UpdateIssue(
					$issueId: String!
					$title: String
					$description: String
					$priority: Int
					$stateId: String
					$assigneeId: String
					$labelIds: [String!]
				) {
					issueUpdate(
						id: $issueId
						input: {
							title: $title
							description: $description
							priority: $priority
							stateId: $stateId
							assigneeId: $assigneeId
							labelIds: $labelIds
						}
					) {
						success
						issue {
							id
							identifier
							title
							description
							url
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
							labels {
								nodes {
									id
									name
									color
								}
							}
						}
					}
				}
			`;

			const response: any = await this.client.request(mutation, input);

			if (response.issueUpdate.success) {
				const issue = response.issueUpdate.issue;

				// Update cache
				await this.updateCachedIssue(issue);

				return {
					success: true,
					issue: {
						id: issue.id,
						identifier: issue.identifier,
						title: issue.title,
						url: issue.url,
						priority: issue.priorityLabel,
						state: issue.state.name,
						assignee: issue.assignee?.name
					}
				};
			}

			return {
				success: false,
				error: 'Failed to update issue'
			};
		} catch (error) {
			const err = error as Error;
			console.error('[Linear Mutations] Update issue failed:', err);
			return {
				success: false,
				error: err.message
			};
		}
	}

	/**
	 * Add a comment to an issue
	 */
	async createComment(input: CreateCommentInput): Promise<{
		success: boolean;
		comment?: any;
		error?: string;
	}> {
		try {
			const mutation = gql`
				mutation CreateComment($issueId: String!, $body: String!) {
					commentCreate(input: { issueId: $issueId, body: $body }) {
						success
						comment {
							id
							body
							createdAt
							user {
								id
								name
								email
							}
							issue {
								id
								identifier
								title
							}
						}
					}
				}
			`;

			const response: any = await this.client.request(mutation, input);

			if (response.commentCreate.success) {
				const comment = response.commentCreate.comment;

				return {
					success: true,
					comment: {
						id: comment.id,
						body: comment.body,
						author: comment.user.name,
						issue: comment.issue.identifier
					}
				};
			}

			return {
				success: false,
				error: 'Failed to create comment'
			};
		} catch (error) {
			const err = error as Error;
			console.error('[Linear Mutations] Create comment failed:', err);
			return {
				success: false,
				error: err.message
			};
		}
	}

	/**
	 * Get team states (for status updates)
	 */
	async getTeamStates(teamId: string): Promise<Array<{ id: string; name: string; type: string }>> {
		try {
			const query = gql`
				query GetTeamStates($teamId: String!) {
					team(id: $teamId) {
						states {
							nodes {
								id
								name
								type
							}
						}
					}
				}
			`;

			const response: any = await this.client.request(query, { teamId });
			return response.team.states.nodes;
		} catch (error) {
			console.error('[Linear Mutations] Get team states failed:', error);
			return [];
		}
	}

	/**
	 * Get team members (for assignments)
	 */
	async getTeamMembers(teamId: string): Promise<Array<{ id: string; name: string; email: string }>> {
		try {
			const query = gql`
				query GetTeamMembers($teamId: String!) {
					team(id: $teamId) {
						members {
							nodes {
								id
								name
								email
							}
						}
					}
				}
			`;

			const response: any = await this.client.request(query, { teamId });
			return response.team.members.nodes;
		} catch (error) {
			console.error('[Linear Mutations] Get team members failed:', error);
			return [];
		}
	}

	/**
	 * Get team labels
	 */
	async getTeamLabels(teamId: string): Promise<Array<{ id: string; name: string; color: string }>> {
		try {
			const query = gql`
				query GetTeamLabels($teamId: String!) {
					team(id: $teamId) {
						labels {
							nodes {
								id
								name
								color
							}
						}
					}
				}
			`;

			const response: any = await this.client.request(query, { teamId });
			return response.team.labels.nodes;
		} catch (error) {
			console.error('[Linear Mutations] Get team labels failed:', error);
			return [];
		}
	}

	/**
	 * Cache created issue in database
	 */
	private async cacheIssue(issue: any): Promise<void> {
		try {
			// Find the project
			const project = await db.query.linearProjects.findFirst({
				where: eq(linearProjects.linearProjectId, issue.project?.id)
			});

			if (!project) {
				console.warn(`[Linear Mutations] Project not found for issue ${issue.identifier}`);
				return;
			}

			await db.insert(linearIssues).values({
				linearProjectId: project.id,
				linearIssueId: issue.id,
				identifier: issue.identifier,
				title: issue.title,
				description: issue.description || '',
				status: issue.state.name,
				statusType: issue.state.type,
				priority: issue.priority || 0,
				priorityLabel: issue.priorityLabel || 'None',
				assignee: issue.assignee?.name || null,
				assigneeEmail: issue.assignee?.email || null,
				labels: issue.labels?.nodes || [],
				url: issue.url
			});

			console.log(`[Linear Mutations] Cached issue ${issue.identifier}`);
		} catch (error) {
			console.error('[Linear Mutations] Failed to cache issue:', error);
		}
	}

	/**
	 * Update cached issue in database
	 */
	private async updateCachedIssue(issue: any): Promise<void> {
		try {
			await db
				.update(linearIssues)
				.set({
					title: issue.title,
					description: issue.description || '',
					status: issue.state.name,
					statusType: issue.state.type,
					priority: issue.priority || 0,
					priorityLabel: issue.priorityLabel || 'None',
					assignee: issue.assignee?.name || null,
					assigneeEmail: issue.assignee?.email || null,
					labels: issue.labels?.nodes || []
				})
				.where(eq(linearIssues.linearIssueId, issue.id));

			console.log(`[Linear Mutations] Updated cached issue ${issue.identifier}`);
		} catch (error) {
			console.error('[Linear Mutations] Failed to update cached issue:', error);
		}
	}
}

/**
 * Create Linear mutation service for a user
 */
export async function createLinearMutationService(userId: string): Promise<LinearMutationService | null> {
	try {
		const integration = await db.query.linearIntegrations.findFirst({
			where: eq(linearIntegrations.userId, userId)
		});

		if (!integration || !integration.accessToken) {
			console.error('[Linear Mutations] No Linear integration found for user');
			return null;
		}

		return new LinearMutationService(userId, integration.accessToken);
	} catch (error) {
		console.error('[Linear Mutations] Failed to create service:', error);
		return null;
	}
}

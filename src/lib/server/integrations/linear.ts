/**
 * Linear API Integration Service
 *
 * Handles OAuth authentication and API interactions with Linear
 * Documentation: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 */

import { env } from '$env/dynamic/private';
import { getOAuthSettings } from '$lib/server/admin-settings';

const LINEAR_API_URL = 'https://api.linear.app/graphql';
const LINEAR_OAUTH_URL = 'https://linear.app/oauth/authorize';
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';

export interface LinearConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

/**
 * Generate Linear OAuth authorization URL
 */
export async function getLinearAuthUrl(redirectUri: string, state?: string): Promise<string> {
	// Try to get from database settings first, fallback to env
	const settings = await getOAuthSettings();
	const clientId = settings.linear_client_id || env.LINEAR_CLIENT_ID || process.env.LINEAR_CLIENT_ID;

	if (!clientId) {
		throw new Error('LINEAR_CLIENT_ID not configured. Please configure it in Admin Settings > OAuth Providers');
	}

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'read,write', // Adjust scopes as needed
		...(state && { state })
	});

	return `${LINEAR_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{
	access_token: string;
	token_type: string;
	expires_in: number;
	scope: string[];
}> {
	// Try to get from database settings first, fallback to env
	const settings = await getOAuthSettings();
	const clientId = settings.linear_client_id || env.LINEAR_CLIENT_ID || process.env.LINEAR_CLIENT_ID;
	const clientSecret = settings.linear_client_secret || env.LINEAR_CLIENT_SECRET || process.env.LINEAR_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error('Linear OAuth credentials not configured. Please configure them in Admin Settings > OAuth Providers');
	}

	const response = await fetch(LINEAR_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			code,
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to exchange code for token: ${error}`);
	}

	return response.json();
}

/**
 * Make an authenticated request to Linear GraphQL API
 */
export async function linearGraphQLRequest<T = any>(
	accessToken: string,
	query: string,
	variables?: Record<string, any>
): Promise<T> {
	const response = await fetch(LINEAR_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': accessToken,
		},
		body: JSON.stringify({
			query,
			variables,
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Linear API request failed: ${error}`);
	}

	const result = await response.json();

	if (result.errors) {
		throw new Error(`Linear GraphQL errors: ${JSON.stringify(result.errors)}`);
	}

	return result.data;
}

/**
 * Get current user info from Linear
 */
export async function getLinearUser(accessToken: string) {
	const query = `
		query {
			viewer {
				id
				name
				email
				admin
				organization {
					id
					name
				}
			}
		}
	`;

	return linearGraphQLRequest(accessToken, query);
}

/**
 * Get user's teams
 */
export async function getLinearTeams(accessToken: string) {
	const query = `
		query {
			teams {
				nodes {
					id
					name
					key
					description
				}
			}
		}
	`;

	return linearGraphQLRequest(accessToken, query);
}

/**
 * Get projects for a team
 */
export async function getLinearProjects(accessToken: string, teamId?: string) {
	const query = `
		query($teamId: String) {
			projects(filter: { team: { id: { eq: $teamId } } }) {
				nodes {
					id
					name
					description
					state
					startDate
					targetDate
					createdAt
					updatedAt
					lead {
						id
						name
						email
					}
					teams {
						nodes {
							id
							name
						}
					}
				}
			}
		}
	`;

	const result = await linearGraphQLRequest(accessToken, query, { teamId });
	return result.projects.nodes;
}

/**
 * Get issues for a project
 */
export async function getLinearIssues(accessToken: string, projectId: string) {
	const query = `
		query($projectId: String!) {
			issues(filter: { project: { id: { eq: $projectId } } }) {
				nodes {
					id
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
				}
			}
		}
	`;

	const result = await linearGraphQLRequest(accessToken, query, { projectId });
	return result.issues.nodes;
}

/**
 * Create a comment on an issue
 */
export async function createLinearComment(
	accessToken: string,
	issueId: string,
	body: string
): Promise<any> {
	const mutation = `
		mutation($issueId: String!, $body: String!) {
			commentCreate(input: { issueId: $issueId, body: $body }) {
				success
				comment {
					id
					body
					createdAt
					user {
						name
						email
					}
				}
			}
		}
	`;

	return linearGraphQLRequest(accessToken, mutation, { issueId, body });
}

/**
 * Update issue status
 */
export async function updateLinearIssueStatus(
	accessToken: string,
	issueId: string,
	stateId: string
): Promise<any> {
	const mutation = `
		mutation($issueId: String!, $stateId: String!) {
			issueUpdate(id: $issueId, input: { stateId: $stateId }) {
				success
				issue {
					id
					state {
						id
						name
						type
					}
				}
			}
		}
	`;

	return linearGraphQLRequest(accessToken, mutation, { issueId, stateId });
}

/**
 * Map Linear issue state to our internal status
 */
export function mapLinearStateToStatus(stateType: string): string {
	const mapping: Record<string, string> = {
		'backlog': 'backlog',
		'unstarted': 'todo',
		'started': 'in_progress',
		'completed': 'done',
		'canceled': 'canceled',
	};

	return mapping[stateType.toLowerCase()] || 'todo';
}

/**
 * Map Linear priority to our internal priority
 */
export function mapLinearPriority(priority: number): string {
	// Linear priority: 0 (no priority), 1 (urgent), 2 (high), 3 (medium), 4 (low)
	const mapping: Record<number, string> = {
		0: 'no_priority',
		1: 'urgent',
		2: 'high',
		3: 'medium',
		4: 'low',
	};

	return mapping[priority] || 'no_priority';
}

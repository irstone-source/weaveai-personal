/**
 * Linear AI Tool Definitions
 *
 * Client-safe tool definitions for Linear integration.
 * These are OpenAI function calling schemas only - no implementation.
 */

import type { AITool } from '../types.js';

/**
 * Linear Create Issue Tool
 */
export const linearCreateIssueTool: AITool = {
	type: 'function',
	function: {
		name: 'linear_create_issue',
		description:
			'Create a new issue in Linear. Use this when the user asks to create a task, bug, or issue. Requires team ID (get from context) and user must be authenticated.',
		parameters: {
			type: 'object',
			properties: {
				userId: {
					type: 'string',
					description: 'The authenticated user ID (required for all Linear operations)'
				},
				teamId: {
					type: 'string',
					description: 'The Linear team ID (e.g., "team-abc-123")'
				},
				title: {
					type: 'string',
					description: 'The issue title (short, descriptive)'
				},
				description: {
					type: 'string',
					description: 'Detailed description of the issue (optional)'
				},
				priority: {
					type: 'number',
					description: 'Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low (default: 0)',
					enum: [0, 1, 2, 3, 4]
				},
				projectId: {
					type: 'string',
					description: 'Project ID to assign the issue to (optional)'
				}
			},
			required: ['userId', 'teamId', 'title']
		}
	}
};

/**
 * Linear Update Issue Tool
 */
export const linearUpdateIssueTool: AITool = {
	type: 'function',
	function: {
		name: 'linear_update_issue',
		description:
			'Update an existing Linear issue. Use this when the user asks to change the status, priority, assignee, or other fields of an issue. Requires the issue ID or identifier (e.g., "ENG-123").',
		parameters: {
			type: 'object',
			properties: {
				userId: {
					type: 'string',
					description: 'The authenticated user ID'
				},
				issueId: {
					type: 'string',
					description: 'The issue ID or identifier (e.g., "ENG-123" or full Linear issue ID)'
				},
				title: {
					type: 'string',
					description: 'New title for the issue (optional)'
				},
				description: {
					type: 'string',
					description: 'New description for the issue (optional)'
				},
				priority: {
					type: 'number',
					description: 'New priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low (optional)',
					enum: [0, 1, 2, 3, 4]
				},
				stateId: {
					type: 'string',
					description: 'The state ID to move the issue to (get from linear_get_team_states tool)'
				}
			},
			required: ['userId', 'issueId']
		}
	}
};

/**
 * Linear Add Comment Tool
 */
export const linearAddCommentTool: AITool = {
	type: 'function',
	function: {
		name: 'linear_add_comment',
		description:
			'Add a comment to a Linear issue. Use this when the user asks to comment on or note something about an issue.',
		parameters: {
			type: 'object',
			properties: {
				userId: {
					type: 'string',
					description: 'The authenticated user ID'
				},
				issueId: {
					type: 'string',
					description: 'The issue ID or identifier (e.g., "ENG-123")'
				},
				body: {
					type: 'string',
					description: 'The comment text (supports Markdown)'
				}
			},
			required: ['userId', 'issueId', 'body']
		}
	}
};

/**
 * Linear Get Team States Tool
 */
export const linearGetTeamStatesTool: AITool = {
	type: 'function',
	function: {
		name: 'linear_get_team_states',
		description:
			'Get available workflow states for a Linear team (e.g., "Todo", "In Progress", "Done"). Use this before updating issue status to get the correct state ID.',
		parameters: {
			type: 'object',
			properties: {
				userId: {
					type: 'string',
					description: 'The authenticated user ID'
				},
				teamId: {
					type: 'string',
					description: 'The Linear team ID'
				}
			},
			required: ['userId', 'teamId']
		}
	}
};

/**
 * Linear Get Team Members Tool
 */
export const linearGetTeamMembersTool: AITool = {
	type: 'function',
	function: {
		name: 'linear_get_team_members',
		description:
			'Get team members for a Linear team. Use this before assigning issues to get the correct assignee ID.',
		parameters: {
			type: 'object',
			properties: {
				userId: {
					type: 'string',
					description: 'The authenticated user ID'
				},
				teamId: {
					type: 'string',
					description: 'The Linear team ID'
				}
			},
			required: ['userId', 'teamId']
		}
	}
};

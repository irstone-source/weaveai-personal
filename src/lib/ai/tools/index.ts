import type { AITool } from '../types.js';
import { deepResearchTool, executeDeepResearch } from './deep-research.js';
import { thinkLongerTool, executeThinkLonger } from './think-longer.js';
import {
	linearCreateIssueTool,
	linearUpdateIssueTool,
	linearAddCommentTool,
	linearGetTeamStatesTool,
	linearGetTeamMembersTool
} from './linear-tools-definitions.js';

// Tool registry with all available tools
export const AVAILABLE_TOOLS: Record<string, AITool> = {
	'deep_research': deepResearchTool,
	'think_longer': thinkLongerTool,
	'linear_create_issue': linearCreateIssueTool,
	'linear_update_issue': linearUpdateIssueTool,
	'linear_add_comment': linearAddCommentTool,
	'linear_get_team_states': linearGetTeamStatesTool,
	'linear_get_team_members': linearGetTeamMembersTool
};

// Tool execution parameter types - flexible to accommodate different tool requirements
export type ToolExecutionArgs = Record<string, any>;

// Tool execution function registry
// Note: Linear tool executors are imported directly in server-side API routes
// to avoid leaking server code to the client
export const TOOL_EXECUTORS: Record<string, (args: any) => Promise<string>> = {
	'deep_research': executeDeepResearch,
	'think_longer': executeThinkLonger
};

/**
 * Get all available tools as an array
 */
export function getAllTools(): AITool[] {
	return Object.values(AVAILABLE_TOOLS);
}

/**
 * Get specific tools by name
 */
export function getTools(toolNames: string[]): AITool[] {
	return toolNames
		.map(name => AVAILABLE_TOOLS[name])
		.filter(Boolean);
}

/**
 * Execute a tool by name with arguments
 */
export async function executeTool(name: string, args: ToolExecutionArgs): Promise<string> {
	const executor = TOOL_EXECUTORS[name];
	if (!executor) {
		throw new Error(`Unknown tool: ${name}`);
	}
	
	try {
		return await executor(args);
	} catch (error) {
		// Log error for debugging but don't expose internal details
		console.error(`Tool execution error for ${name}:`, error);
		throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Get display-friendly name for a tool
 */
export function getToolDisplayName(toolName: string): string {
	const displayNames: Record<string, string> = {
		'deep_research': 'Deep Research',
		'think_longer': 'Think Longer',
		'linear_create_issue': 'Linear: Create Issue',
		'linear_update_issue': 'Linear: Update Issue',
		'linear_add_comment': 'Linear: Add Comment',
		'linear_get_team_states': 'Linear: Get Team States',
		'linear_get_team_members': 'Linear: Get Team Members'
	};
	return displayNames[toolName] || toolName;
}

/**
 * Get description for a tool from its definition
 */
export function getToolDescription(toolName: string): string {
	const tool = AVAILABLE_TOOLS[toolName];
	return tool?.function.description || 'No description available';
}
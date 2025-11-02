/**
 * Tool Execution API Route
 *
 * Executes AI tools and returns structured responses.
 * This is the critical missing piece that makes Linear mutation tools functional.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	executeLinearCreateIssue,
	executeLinearUpdateIssue,
	executeLinearAddComment,
	executeLinearGetTeamStates,
	executeLinearGetTeamMembers
} from '$lib/ai/tools/linear-tools.js';

interface ToolExecutionRequest {
	toolName: string;
	args: any;
}

interface ToolExecutionResponse {
	success: boolean;
	result: string;
	error?: string;
}

// Map tool names to their executor functions
const TOOL_EXECUTORS: Record<string, (args: any) => Promise<string>> = {
	'linear_create_issue': executeLinearCreateIssue,
	'linear_update_issue': executeLinearUpdateIssue,
	'linear_add_comment': executeLinearAddComment,
	'linear_get_team_states': executeLinearGetTeamStates,
	'linear_get_team_members': executeLinearGetTeamMembers
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse request body
		const body: ToolExecutionRequest = await request.json();
		const { toolName, args } = body;

		console.log('[Tool Execute] Executing tool:', toolName, 'with args:', JSON.stringify(args, null, 2));

		// Validate tool name
		if (!toolName || typeof toolName !== 'string') {
			return json<ToolExecutionResponse>({
				success: false,
				result: '',
				error: 'Tool name is required'
			}, { status: 400 });
		}

		// Get executor function
		const executor = TOOL_EXECUTORS[toolName];
		if (!executor) {
			return json<ToolExecutionResponse>({
				success: false,
				result: '',
				error: `Unknown tool: ${toolName}. Available tools: ${Object.keys(TOOL_EXECUTORS).join(', ')}`
			}, { status: 400 });
		}

		// Execute tool
		const result = await executor(args);

		console.log('[Tool Execute] Tool execution successful:', toolName);
		console.log('[Tool Execute] Result:', result);

		return json<ToolExecutionResponse>({
			success: true,
			result
		});

	} catch (error) {
		console.error('[Tool Execute] Execution error:', error);

		return json<ToolExecutionResponse>({
			success: false,
			result: '',
			error: error instanceof Error ? error.message : 'Unknown error during tool execution'
		}, { status: 500 });
	}
};

// GET endpoint to list available tools
export const GET: RequestHandler = async () => {
	const tools = Object.keys(TOOL_EXECUTORS).map(name => ({
		name,
		available: true
	}));

	return json({
		success: true,
		tools,
		count: tools.length
	});
};

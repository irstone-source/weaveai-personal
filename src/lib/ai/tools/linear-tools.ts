/**
 * Linear AI Tool Executors (Server-Side Only)
 *
 * Server-side implementations for Linear tool execution.
 * These are imported server-side only for API endpoints.
 */

import { createLinearMutationService } from '$lib/server/integrations/linear-mutations.js';

// Type definitions for executor arguments

interface LinearCreateIssueArgs {
	userId: string;
	teamId: string;
	title: string;
	description?: string;
	priority?: number;
	projectId?: string;
}

interface LinearUpdateIssueArgs {
	userId: string;
	issueId: string;
	title?: string;
	description?: string;
	priority?: number;
	stateId?: string;
}

interface LinearAddCommentArgs {
	userId: string;
	issueId: string;
	body: string;
}

interface LinearGetTeamStatesArgs {
	userId: string;
	teamId: string;
}

interface LinearGetTeamMembersArgs {
	userId: string;
	teamId: string;
}

// Executor functions

export async function executeLinearCreateIssue(args: LinearCreateIssueArgs): Promise<string> {
	try {
		const mutationService = await createLinearMutationService(args.userId);
		if (!mutationService) {
			return 'Error: Linear integration not found. Please connect Linear first.';
		}

		const result = await mutationService.createIssue({
			teamId: args.teamId,
			title: args.title,
			description: args.description,
			priority: args.priority || 0,
			projectId: args.projectId
		});

		if (result.success && result.issue) {
			return `✅ Created issue ${result.issue.identifier}: ${result.issue.title}\n` +
				   `Priority: ${result.issue.priority}\n` +
				   `Status: ${result.issue.state}\n` +
				   `URL: ${result.issue.url}`;
		}

		return `❌ Failed to create issue: ${result.error || 'Unknown error'}`;
	} catch (error) {
		console.error('[Linear Tools] Create issue failed:', error);
		return `❌ Error creating issue: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

export async function executeLinearUpdateIssue(args: LinearUpdateIssueArgs): Promise<string> {
	try {
		const mutationService = await createLinearMutationService(args.userId);
		if (!mutationService) {
			return 'Error: Linear integration not found.';
		}

		const result = await mutationService.updateIssue({
			issueId: args.issueId,
			title: args.title,
			description: args.description,
			priority: args.priority,
			stateId: args.stateId
		});

		if (result.success && result.issue) {
			return `✅ Updated issue ${result.issue.identifier}\n` +
				   `Title: ${result.issue.title}\n` +
				   `Priority: ${result.issue.priority}\n` +
				   `Status: ${result.issue.state}\n` +
				   `URL: ${result.issue.url}`;
		}

		return `❌ Failed to update issue: ${result.error || 'Unknown error'}`;
	} catch (error) {
		console.error('[Linear Tools] Update issue failed:', error);
		return `❌ Error updating issue: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

export async function executeLinearAddComment(args: LinearAddCommentArgs): Promise<string> {
	try {
		const mutationService = await createLinearMutationService(args.userId);
		if (!mutationService) {
			return 'Error: Linear integration not found.';
		}

		const result = await mutationService.createComment({
			issueId: args.issueId,
			body: args.body
		});

		if (result.success && result.comment) {
			return `✅ Added comment to ${result.comment.issue}\n` +
				   `Author: ${result.comment.author}\n` +
				   `Comment: ${result.comment.body.substring(0, 100)}${result.comment.body.length > 100 ? '...' : ''}`;
		}

		return `❌ Failed to add comment: ${result.error || 'Unknown error'}`;
	} catch (error) {
		console.error('[Linear Tools] Add comment failed:', error);
		return `❌ Error adding comment: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

export async function executeLinearGetTeamStates(args: LinearGetTeamStatesArgs): Promise<string> {
	try {
		const mutationService = await createLinearMutationService(args.userId);
		if (!mutationService) {
			return 'Error: Linear integration not found.';
		}

		const states = await mutationService.getTeamStates(args.teamId);

		if (states.length === 0) {
			return 'No workflow states found for this team.';
		}

		let output = `📋 Workflow states for team ${args.teamId}:\n\n`;
		for (const state of states) {
			output += `- **${state.name}** (ID: ${state.id}, Type: ${state.type})\n`;
		}

		return output;
	} catch (error) {
		console.error('[Linear Tools] Get team states failed:', error);
		return `❌ Error getting team states: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

export async function executeLinearGetTeamMembers(args: LinearGetTeamMembersArgs): Promise<string> {
	try {
		const mutationService = await createLinearMutationService(args.userId);
		if (!mutationService) {
			return 'Error: Linear integration not found.';
		}

		const members = await mutationService.getTeamMembers(args.teamId);

		if (members.length === 0) {
			return 'No team members found for this team.';
		}

		let output = `👥 Team members for team ${args.teamId}:\n\n`;
		for (const member of members) {
			output += `- **${member.name}** (${member.email}) - ID: ${member.id}\n`;
		}

		return output;
	} catch (error) {
		console.error('[Linear Tools] Get team members failed:', error);
		return `❌ Error getting team members: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

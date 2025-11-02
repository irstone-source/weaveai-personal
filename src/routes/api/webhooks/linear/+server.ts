/**
 * Linear Webhook Receiver - Full Database Sync
 *
 * Receives webhook events from Linear and syncs data to database in real-time.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import crypto from 'crypto';
import { db } from '$lib/server/db/index.js';
import { linearIntegrations, linearIssues, linearProjects, interactions } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

type LinearWebhookEvent = {
	action: 'create' | 'update' | 'remove';
	type: 'Issue' | 'Comment' | 'Project' | 'Label';
	createdAt: string;
	data: any;
	url: string;
	organizationId: string;
	webhookTimestamp: number;
	webhookId: string;
};

function verifyWebhookSignature(
	payload: string,
	signature: string | null,
	secret: string
): boolean {
	if (!signature) return false;
	const hmac = crypto.createHmac('sha256', secret);
	hmac.update(payload);
	const expectedSignature = hmac.digest('hex');
	return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

async function handleIssueEvent(event: LinearWebhookEvent, userId: string) {
	const issueData = event.data;

	console.log('[Linear Webhook] Processing Issue:', event.action, issueData.identifier || issueData.id);

	if (event.action === 'remove') {
		await db.delete(linearIssues).where(eq(linearIssues.linearIssueId, issueData.id));
		console.log('[Linear Webhook] Deleted issue:', issueData.id);
		return;
	}

	// Check if issue already exists
	const existing = await db.query.linearIssues.findFirst({
		where: eq(linearIssues.linearIssueId, issueData.id)
	});

	// Find or create the project first (required foreign key)
	let linearProjectId: string | null = null;
	if (issueData.project?.id) {
		const project = await db.query.linearProjects.findFirst({
			where: eq(linearProjects.linearProjectId, issueData.project.id)
		});
		if (project) {
			linearProjectId = project.id;
		}
	}

	// Allow issues without projects (linearProjectId can now be null)
	if (!linearProjectId) {
		console.log('[Linear Webhook] Issue has no project, will insert with null project_id');
	}

	const issueRecord = {
		linearProjectId: linearProjectId || null,
		linearIssueId: issueData.id,
		identifier: issueData.identifier,
		title: issueData.title,
		description: issueData.description || null,
		priority: issueData.priority || 0,
		priorityLabel: issueData.priorityLabel || 'No priority',
		status: issueData.state?.name || 'Unknown',
		statusType: issueData.state?.type || 'unstarted',
		assignee: issueData.assignee?.name || null,
		assigneeEmail: issueData.assignee?.email || null,
		estimate: issueData.estimate || null,
		dueDate: issueData.dueDate ? new Date(issueData.dueDate) : null,
		completedAt: issueData.completedAt ? new Date(issueData.completedAt) : null,
		url: issueData.url || '',
		labels: issueData.labels || [],
		lastSyncedAt: new Date(),
		createdAt: issueData.createdAt ? new Date(issueData.createdAt) : new Date(),
		updatedAt: new Date()
	};

	if (existing) {
		await db.update(linearIssues).set(issueRecord).where(eq(linearIssues.id, existing.id));
		console.log('[Linear Webhook] Updated issue:', issueData.identifier);
	} else {
		await db.insert(linearIssues).values(issueRecord);
		console.log('[Linear Webhook] Created issue:', issueData.identifier);
	}
}

async function handleCommentEvent(event: LinearWebhookEvent, userId: string) {
	const commentData = event.data;

	console.log('[Linear Webhook] Processing Comment:', event.action, commentData.id);

	if (event.action === 'remove') {
		await db.delete(interactions).where(eq(interactions.sourceId, commentData.id));
		console.log('[Linear Webhook] Deleted comment:', commentData.id);
		return;
	}

	// Find the issue to link to
	const issue = await db.query.linearIssues.findFirst({
		where: eq(linearIssues.linearIssueId, commentData.issue?.id)
	});

	if (!issue) {
		console.warn('[Linear Webhook] Issue not found for comment:', commentData.issue?.id);
		return;
	}

	const existing = await db.query.interactions.findFirst({
		where: eq(interactions.sourceId, commentData.id)
	});

	const interactionRecord = {
		userId,
		interactionType: 'linear_comment' as const,
		sourceId: commentData.id,
		sourceUrl: commentData.url || null,
		title: `Comment on ${issue.identifier}`,
		content: commentData.body || '',
		participants: commentData.user ? [{
			name: commentData.user.name || 'Unknown',
			email: commentData.user.email
		}] : [],
		metadata: {
			linearIssueId: issue.linearIssueId,
			authorId: commentData.user?.id,
			editedAt: commentData.editedAt
		},
		interactionDate: commentData.createdAt ? new Date(commentData.createdAt) : new Date(),
		createdAt: commentData.createdAt ? new Date(commentData.createdAt) : new Date(),
		updatedAt: new Date()
	};

	if (existing) {
		await db.update(interactions).set(interactionRecord).where(eq(interactions.id, existing.id));
		console.log('[Linear Webhook] Updated comment');
	} else {
		await db.insert(interactions).values(interactionRecord);
		console.log('[Linear Webhook] Created comment');
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const rawBody = await request.text();
		const signature = request.headers.get('linear-signature');
		const event: LinearWebhookEvent = JSON.parse(rawBody);

		console.log('[Linear Webhook] Received:', event.type, event.action);

		// Multi-tenant: Extract teamId from the event data
		// Issues have team.id, comments have issue.team.id
		let teamId: string | null = null;

		if (event.type === 'Issue' && event.data?.team?.id) {
			teamId = event.data.team.id;
		} else if (event.type === 'Comment' && event.data?.issue?.team?.id) {
			teamId = event.data.issue.team.id;
		} else if (event.data?.team?.id) {
			// Fallback: try direct team reference
			teamId = event.data.team.id;
		}

		console.log('[Linear Webhook] Team ID:', teamId);

		// Find the specific integration for this team (multi-tenant routing)
		const integration = teamId
			? await db.query.linearIntegrations.findFirst({
					where: eq(linearIntegrations.teamId, teamId)
			  })
			: await db.query.linearIntegrations.findFirst(); // Fallback to any integration

		if (!integration) {
			console.warn('[Linear Webhook] No integration found for team:', teamId || 'unknown');
			return json({ error: 'Team integration not found' }, { status: 404 });
		}

		console.log('[Linear Webhook] Routing to integration:', integration.teamName, `(${integration.teamId})`);

		// Verify webhook signature
		if (integration.webhookSecret) {
			const isValid = verifyWebhookSignature(rawBody, signature, integration.webhookSecret);
			if (!isValid) {
				console.error('[Linear Webhook] Invalid signature');
				return json({ error: 'Invalid signature' }, { status: 401 });
			}
		}

		// Handle events with full database synchronization
		if (event.type === 'Issue') {
			await handleIssueEvent(event, integration.userId);
		} else if (event.type === 'Comment') {
			await handleCommentEvent(event, integration.userId);
		} else {
			console.log('[Linear Webhook] Unhandled event type:', event.type);
		}

		return json({ success: true, received: true, team: integration.teamName });

	} catch (error) {
		console.error('[Linear Webhook] Error:', error);
		return json(
			{
				error: 'Webhook processing failed',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async () => {
	return json({
		status: 'ok',
		service: 'Linear Webhook Receiver',
		timestamp: new Date().toISOString()
	});
};

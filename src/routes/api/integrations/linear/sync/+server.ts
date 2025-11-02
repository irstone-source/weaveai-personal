/**
 * Linear Sync API Endpoint
 * Syncs Linear issues to projects table
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLinearProjects, getLinearIssues, mapLinearStateToStatus, mapLinearPriority } from '$lib/server/integrations/linear';
import { db } from '$lib/server/db';
import { linearIntegrations, projects } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ locals }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Get Linear integration for user
		const integration = await db.query.linearIntegrations.findFirst({
			where: eq(linearIntegrations.userId, locals.user.id)
		});

		if (!integration) {
			throw error(404, 'Linear integration not found. Please connect Linear first.');
		}

		// Fetch projects from Linear
		const linearProjects = await getLinearProjects(integration.accessToken, integration.teamId);

		let syncedCount = 0;
		let errors: string[] = [];

		// Sync each project and its issues
		for (const linearProject of linearProjects) {
			try {
				// Fetch issues for this project
				const issues = await getLinearIssues(integration.accessToken, linearProject.id);

				// Sync each issue to projects table
				for (const issue of issues) {
					try {
						// Map Linear data to our schema
						const projectData = {
							userId: locals.user.id,
							externalId: issue.id,
							externalSource: 'linear',
							title: issue.title,
							description: issue.description || null,
							status: mapLinearStateToStatus(issue.state.type),
							priority: mapLinearPriority(issue.priority),
							dueDate: issue.dueDate ? new Date(issue.dueDate) : null,
							createdAt: new Date(issue.createdAt),
							updatedAt: new Date(issue.updatedAt)
						};

						// Check if project already exists
						const existing = await db.query.projects.findFirst({
							where: (projects, { and, eq }) =>
								and(
									eq(projects.externalId, issue.id),
									eq(projects.userId, locals.user.id)
								)
						});

						if (existing) {
							// Update existing project
							await db.update(projects)
								.set({
									...projectData,
									updatedAt: new Date()
								})
								.where(eq(projects.id, existing.id));
						} else {
							// Insert new project
							await db.insert(projects).values(projectData);
						}

						syncedCount++;
					} catch (issueError) {
						console.error(`Error syncing issue ${issue.id}:`, issueError);
						errors.push(`Issue ${issue.title}: ${issueError instanceof Error ? issueError.message : 'Unknown error'}`);
					}
				}
			} catch (projectError) {
				console.error(`Error syncing project ${linearProject.id}:`, projectError);
				errors.push(`Project ${linearProject.name}: ${projectError instanceof Error ? projectError.message : 'Unknown error'}`);
			}
		}

		// Update last sync timestamp
		await db.update(linearIntegrations)
			.set({
				lastSyncAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(linearIntegrations.id, integration.id));

		return json({
			success: true,
			syncedCount,
			errors: errors.length > 0 ? errors : undefined,
			message: `Successfully synced ${syncedCount} issues from Linear`
		});

	} catch (err) {
		console.error('Linear sync error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to sync Linear issues');
	}
};

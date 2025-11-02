import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { linearTeamMappings, linearProjects, linearIssues, interactions } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * GET /api/linear/teams
 *
 * Returns all Linear team mappings for the authenticated user with statistics
 */
export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Get all team mappings
		const teams = await db.query.linearTeamMappings.findMany({
			where: eq(linearTeamMappings.userId, userId),
			orderBy: (teams, { desc }) => [desc(teams.lastSyncAt)]
		});

		// Get statistics for each team
		const teamsWithStats = await Promise.all(
			teams.map(async (team) => {
				// Count projects
				const projectCount = await db
					.select({ count: sql<number>`count(*)` })
					.from(linearProjects)
					.where(
						and(
							eq(linearProjects.userId, userId),
							eq(linearProjects.linearTeamId, team.linearTeamId)
						)
					);

				// Count issues
				const issueCount = await db
					.select({ count: sql<number>`count(*)` })
					.from(linearIssues)
					.where(
						sql`${linearIssues.linearProjectId} IN (
							SELECT id FROM ${linearProjects}
							WHERE ${linearProjects.userId} = ${userId}
							AND ${linearProjects.linearTeamId} = ${team.linearTeamId}
						)`
					);

				// Count interactions
				const interactionCount = await db
					.select({ count: sql<number>`count(*)` })
					.from(interactions)
					.where(
						and(
							eq(interactions.userId, userId),
							sql`${interactions.metadata}->>'linearTeamId' = ${team.linearTeamId}`
						)
					);

				// Count vectors stored (issues + projects with pineconeId)
				const vectorCount = await db
					.select({ count: sql<number>`count(*)` })
					.from(linearProjects)
					.where(
						and(
							eq(linearProjects.userId, userId),
							eq(linearProjects.linearTeamId, team.linearTeamId),
							sql`${linearProjects.pineconeId} IS NOT NULL`
						)
					);

				const issueVectorCount = await db
					.select({ count: sql<number>`count(*)` })
					.from(linearIssues)
					.where(
						and(
							sql`${linearIssues.linearProjectId} IN (
								SELECT id FROM ${linearProjects}
								WHERE ${linearProjects.userId} = ${userId}
								AND ${linearProjects.linearTeamId} = ${team.linearTeamId}
							)`,
							sql`${linearIssues.pineconeId} IS NOT NULL`
						)
					);

				const interactionVectorCount = await db
					.select({ count: sql<number>`count(*)` })
					.from(interactions)
					.where(
						and(
							eq(interactions.userId, userId),
							eq(interactions.pineconeStored, true),
							sql`${interactions.metadata}->>'linearTeamId' = ${team.linearTeamId}`
						)
					);

				return {
					id: team.id,
					linearTeamId: team.linearTeamId,
					linearTeamName: team.linearTeamName,
					projectId: team.projectId,
					syncEnabled: team.syncEnabled,
					autoCreated: team.autoCreated,
					pineconeIndexName: team.pineconeIndexName,
					lastSyncAt: team.lastSyncAt,
					stats: {
						projects: Number(projectCount[0]?.count || 0),
						issues: Number(issueCount[0]?.count || 0),
						interactions: Number(interactionCount[0]?.count || 0),
						vectors:
							Number(vectorCount[0]?.count || 0) +
							Number(issueVectorCount[0]?.count || 0) +
							Number(interactionVectorCount[0]?.count || 0)
					}
				};
			})
		);

		return json({
			teams: teamsWithStats,
			total: teamsWithStats.length
		});

	} catch (err) {
		const teamError = err as Error;
		console.error('[Teams API] Error fetching teams:', teamError);
		throw error(500, 'Failed to fetch teams');
	}
};

/**
 * PATCH /api/linear/teams/:teamId
 *
 * Update team mapping settings
 */
export const PATCH: RequestHandler = async ({ locals, request }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { teamId, syncEnabled, projectId } = body;

		if (!teamId) {
			throw error(400, 'Team ID is required');
		}

		// Verify team belongs to user
		const team = await db.query.linearTeamMappings.findFirst({
			where: and(
				eq(linearTeamMappings.userId, userId),
				eq(linearTeamMappings.id, teamId)
			)
		});

		if (!team) {
			throw error(404, 'Team not found');
		}

		// Build update object
		const updates: any = {
			updatedAt: new Date()
		};

		if (typeof syncEnabled === 'boolean') {
			updates.syncEnabled = syncEnabled;
		}

		if (projectId !== undefined) {
			updates.projectId = projectId || null;
		}

		// Update team
		await db
			.update(linearTeamMappings)
			.set(updates)
			.where(eq(linearTeamMappings.id, teamId));

		// Fetch updated team
		const updatedTeam = await db.query.linearTeamMappings.findFirst({
			where: eq(linearTeamMappings.id, teamId)
		});

		return json({
			success: true,
			team: updatedTeam
		});

	} catch (err) {
		const updateError = err as Error;
		console.error('[Teams API] Error updating team:', updateError);
		throw error(500, updateError.message || 'Failed to update team');
	}
};

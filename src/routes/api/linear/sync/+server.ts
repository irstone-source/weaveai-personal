import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createLinearSyncService } from '$lib/server/integrations/linear-sync';
import { createLinearImporter } from '$lib/server/integrations/interaction-importers/linear-importer';
import { createMeetingImporter } from '$lib/server/integrations/interaction-importers/meeting-importer';
import { createClientIntelligenceService } from '$lib/server/integrations/client-intelligence-service';
import { db } from '$lib/server/db';
import { linearIntegrations, linearTeamMappings, linearProjects } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/linear/sync
 *
 * Triggers a full sync pipeline:
 * 1. Sync Linear data (teams, projects, issues)
 * 2. Import interactions (comments, meetings)
 * 3. Generate embeddings and store in Pinecone
 *
 * Query params:
 * - type: 'full' | 'incremental' | 'embeddings-only' (default: 'full')
 * - teamId: Optional - sync specific team only
 */
export const POST: RequestHandler = async ({ locals, url }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	const syncType = url.searchParams.get('type') || 'full';
	const teamId = url.searchParams.get('teamId');

	try {
		const result = {
			sync: null as any,
			interactions: null as any,
			embeddings: null as any,
			success: true,
			errors: [] as string[]
		};

		// Check if user has Linear integration
		const integration = await db.query.linearIntegrations.findFirst({
			where: eq(linearIntegrations.userId, userId)
		});

		if (!integration) {
			throw error(404, 'Linear integration not found. Please connect Linear first.');
		}

		if (!integration.accessToken) {
			throw error(400, 'Linear access token missing');
		}

		// Step 1: Sync Linear data
		if (syncType === 'full' || syncType === 'incremental') {
			console.log(`[Sync API] Starting ${syncType} sync for user ${userId}`);

			const syncService = await createLinearSyncService(userId);

			if (syncType === 'full') {
				result.sync = await syncService.fullSync({
					createPineconeIndexes: true
				});
			} else {
				result.sync = await syncService.incrementalSync();
			}

			console.log('[Sync API] Sync completed:', result.sync.stats);
			result.errors.push(...result.sync.errors);
		}

		// Step 2: Import interactions
		if (syncType === 'full') {
			console.log('[Sync API] Importing interactions...');

			const interactionResults = {
				linearComments: { imported: 0, skipped: 0, errors: [] as string[] },
				meetings: { imported: 0, skipped: 0, errors: [] as string[] }
			};

			// Get teams to process
			const teams = teamId
				? await db.query.linearTeamMappings.findMany({
						where: and(
							eq(linearTeamMappings.userId, userId),
							eq(linearTeamMappings.linearTeamId, teamId)
						)
				  })
				: await db.query.linearTeamMappings.findMany({
						where: and(
							eq(linearTeamMappings.userId, userId),
							eq(linearTeamMappings.syncEnabled, true)
						)
				  });

			// Import Linear comments
			const linearImporter = await createLinearImporter(userId, integration.accessToken);

			for (const team of teams) {
				try {
					const importResult = await linearImporter.importAllCommentsForTeam(team.linearTeamId);
					interactionResults.linearComments.imported += importResult.imported;
					interactionResults.linearComments.skipped += importResult.skipped;
					interactionResults.linearComments.errors.push(...importResult.errors);
				} catch (err) {
					const error = err as Error;
					interactionResults.linearComments.errors.push(
						`Team ${team.linearTeamName}: ${error.message}`
					);
				}
			}

			// Import meetings
			const meetingImporter = createMeetingImporter(userId);
			const meetingResult = await meetingImporter.importAllUnimportedMeetings();

			interactionResults.meetings.imported = meetingResult.imported;
			interactionResults.meetings.skipped = meetingResult.skipped;
			interactionResults.meetings.errors = meetingResult.errors;

			result.interactions = interactionResults;
			result.errors.push(...interactionResults.linearComments.errors);
			result.errors.push(...interactionResults.meetings.errors);

			console.log('[Sync API] Interactions imported:', interactionResults);
		}

		// Step 3: Generate embeddings
		if (syncType === 'full' || syncType === 'embeddings-only') {
			console.log('[Sync API] Generating embeddings...');

			const embeddingResults = {
				projects: { processed: 0, skipped: 0, errors: [] as string[] },
				issues: { processed: 0, skipped: 0, errors: [] as string[] },
				interactions: { processed: 0, skipped: 0, errors: [] as string[] }
			};

			const intelligence = createClientIntelligenceService(userId);

			// Get teams to process
			const teams = teamId
				? await db.query.linearTeamMappings.findMany({
						where: and(
							eq(linearTeamMappings.userId, userId),
							eq(linearTeamMappings.linearTeamId, teamId)
						)
				  })
				: await db.query.linearTeamMappings.findMany({
						where: and(
							eq(linearTeamMappings.userId, userId),
							eq(linearTeamMappings.syncEnabled, true)
						)
				  });

			for (const team of teams) {
				try {
					// Store projects
					const projectResult = await intelligence.storeAllProjectsForTeam(team.linearTeamId);
					embeddingResults.projects.processed += projectResult.processed;
					embeddingResults.projects.skipped += projectResult.skipped;
					embeddingResults.projects.errors.push(...projectResult.errors);

					// Store issues for each project
					const projects = await db.query.linearProjects.findMany({
						where: and(
							eq(linearProjects.userId, userId),
							eq(linearProjects.linearTeamId, team.linearTeamId)
						)
					});

					for (const project of projects) {
						const issueResult = await intelligence.storeAllIssuesForProject(project.id);
						embeddingResults.issues.processed += issueResult.processed;
						embeddingResults.issues.skipped += issueResult.skipped;
						embeddingResults.issues.errors.push(...issueResult.errors);
					}

					// Store interactions
					const interactionResult = await intelligence.storeAllInteractionsForTeam(
						team.linearTeamId
					);
					embeddingResults.interactions.processed += interactionResult.processed;
					embeddingResults.interactions.skipped += interactionResult.skipped;
					embeddingResults.interactions.errors.push(...interactionResult.errors);

				} catch (err) {
					const error = err as Error;
					embeddingResults.projects.errors.push(`Team ${team.linearTeamName}: ${error.message}`);
				}
			}

			result.embeddings = embeddingResults;
			result.errors.push(...embeddingResults.projects.errors);
			result.errors.push(...embeddingResults.issues.errors);
			result.errors.push(...embeddingResults.interactions.errors);

			console.log('[Sync API] Embeddings generated:', embeddingResults);
		}

		result.success = result.errors.length === 0;

		return json({
			...result,
			message: result.success ? 'Sync completed successfully' : 'Sync completed with errors'
		});

	} catch (err) {
		const syncError = err as Error;
		console.error('[Sync API] Error:', syncError);

		throw error(500, syncError.message || 'Sync failed');
	}
};

/**
 * GET /api/linear/sync
 *
 * Get sync status
 */
export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	try {
		const integration = await db.query.linearIntegrations.findFirst({
			where: eq(linearIntegrations.userId, userId)
		});

		if (!integration) {
			return json({
				connected: false,
				lastSync: null,
				teams: []
			});
		}

		const teams = await db.query.linearTeamMappings.findMany({
			where: eq(linearTeamMappings.userId, userId)
		});

		return json({
			connected: true,
			lastSync: integration.lastSyncedAt,
			syncMode: integration.syncMode,
			autoSyncEnabled: integration.autoSyncEnabled,
			teams: teams.map(t => ({
				id: t.linearTeamId,
				name: t.linearTeamName,
				syncEnabled: t.syncEnabled,
				lastSync: t.lastSyncAt,
				pineconeIndex: t.pineconeIndexName
			}))
		});

	} catch (err) {
		const statusError = err as Error;
		console.error('[Sync API] Status error:', statusError);
		throw error(500, 'Failed to get sync status');
	}
};

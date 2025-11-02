/**
 * Linear Sync Scheduled Jobs
 *
 * Automated sync jobs for Linear intelligence platform.
 * These jobs can be triggered by:
 * 1. Vercel Cron (vercel.json configuration)
 * 2. External cron service (GitHub Actions, etc.)
 * 3. Manual API calls
 */

import { db } from '$lib/server/db';
import { linearIntegrations } from '$lib/server/db/schema';
import { isNotNull } from 'drizzle-orm';
import { createLinearSyncService } from '../integrations/linear-sync';
import { createLinearImporter } from '../integrations/interaction-importers/linear-importer';
import { createMeetingImporter } from '../integrations/interaction-importers/meeting-importer';
import { createClientIntelligenceService } from '../integrations/client-intelligence-service';

interface JobResult {
	success: boolean;
	usersProcessed: number;
	errors: string[];
	duration: number;
}

/**
 * Incremental sync job - runs every 6 hours
 * Syncs only changed data since last sync
 */
export async function incrementalSyncJob(): Promise<JobResult> {
	const startTime = Date.now();
	const result: JobResult = {
		success: true,
		usersProcessed: 0,
		errors: [],
		duration: 0
	};

	try {
		console.log('[Cron] Starting incremental sync job...');

		// Get all users with Linear integration
		const integrations = await db.query.linearIntegrations.findMany({
			where: isNotNull(linearIntegrations.accessToken)
		});

		console.log(`[Cron] Found ${integrations.length} users with Linear integrations`);

		for (const integration of integrations) {
			try {
				const syncService = await createLinearSyncService(integration.userId);
				const syncResult = await syncService.incrementalSync();

				console.log(
					`[Cron] User ${integration.userId}: ${syncResult.stats.projectsUpdated} projects, ${syncResult.stats.issuesUpdated} issues updated`
				);

				result.usersProcessed++;
			} catch (error) {
				const err = error as Error;
				result.errors.push(`User ${integration.userId}: ${err.message}`);
				console.error(`[Cron] Error syncing user ${integration.userId}:`, err);
			}
		}

		result.duration = Date.now() - startTime;
		console.log(
			`[Cron] Incremental sync completed in ${result.duration}ms. ${result.usersProcessed} users processed, ${result.errors.length} errors.`
		);
	} catch (error) {
		result.success = false;
		result.errors.push((error as Error).message);
		result.duration = Date.now() - startTime;
		console.error('[Cron] Incremental sync job failed:', error);
	}

	return result;
}

/**
 * Import meetings job - runs daily
 * Imports new meeting transcripts from all sources
 */
export async function importMeetingsJob(): Promise<JobResult> {
	const startTime = Date.now();
	const result: JobResult = {
		success: true,
		usersProcessed: 0,
		errors: [],
		duration: 0
	};

	try {
		console.log('[Cron] Starting meeting import job...');

		// Get all users with Linear integration (meetings are linked to Linear teams)
		const integrations = await db.query.linearIntegrations.findMany({
			where: isNotNull(linearIntegrations.accessToken)
		});

		for (const integration of integrations) {
			try {
				const meetingImporter = createMeetingImporter(integration.userId);
				const importResult = await meetingImporter.importAllUnimportedMeetings();

				console.log(
					`[Cron] User ${integration.userId}: ${importResult.imported} meetings imported`
				);

				result.usersProcessed++;
			} catch (error) {
				const err = error as Error;
				result.errors.push(`User ${integration.userId}: ${err.message}`);
				console.error(`[Cron] Error importing meetings for user ${integration.userId}:`, err);
			}
		}

		result.duration = Date.now() - startTime;
		console.log(
			`[Cron] Meeting import completed in ${result.duration}ms. ${result.usersProcessed} users processed, ${result.errors.length} errors.`
		);
	} catch (error) {
		result.success = false;
		result.errors.push((error as Error).message);
		result.duration = Date.now() - startTime;
		console.error('[Cron] Meeting import job failed:', error);
	}

	return result;
}

/**
 * Full sync backup job - runs weekly (Sunday 2am)
 * Complete re-sync to catch any missed changes
 */
export async function fullSyncBackupJob(): Promise<JobResult> {
	const startTime = Date.now();
	const result: JobResult = {
		success: true,
		usersProcessed: 0,
		errors: [],
		duration: 0
	};

	try {
		console.log('[Cron] Starting full sync backup job...');

		const integrations = await db.query.linearIntegrations.findMany({
			where: isNotNull(linearIntegrations.accessToken)
		});

		for (const integration of integrations) {
			try {
				// Full sync
				const syncService = await createLinearSyncService(integration.userId);
				const syncResult = await syncService.fullSync({
					createPineconeIndexes: false // Don't create new indexes, assume they exist
				});

				console.log(
					`[Cron] User ${integration.userId}: Full sync completed - ${syncResult.stats.projectsCreated} projects, ${syncResult.stats.issuesCreated} issues`
				);

				result.usersProcessed++;
			} catch (error) {
				const err = error as Error;
				result.errors.push(`User ${integration.userId}: ${err.message}`);
				console.error(`[Cron] Error in full sync for user ${integration.userId}:`, err);
			}
		}

		result.duration = Date.now() - startTime;
		console.log(
			`[Cron] Full sync backup completed in ${result.duration}ms. ${result.usersProcessed} users processed, ${result.errors.length} errors.`
		);
	} catch (error) {
		result.success = false;
		result.errors.push((error as Error).message);
		result.duration = Date.now() - startTime;
		console.error('[Cron] Full sync backup job failed:', error);
	}

	return result;
}

/**
 * Generate embeddings for new data - runs every 6 hours
 * Processes any new projects/issues/interactions that don't have embeddings yet
 */
export async function generateEmbeddingsJob(): Promise<JobResult> {
	const startTime = Date.now();
	const result: JobResult = {
		success: true,
		usersProcessed: 0,
		errors: [],
		duration: 0
	};

	try {
		console.log('[Cron] Starting embedding generation job...');

		const integrations = await db.query.linearIntegrations.findMany({
			where: isNotNull(linearIntegrations.accessToken)
		});

		for (const integration of integrations) {
			try {
				const intelligence = createClientIntelligenceService(integration.userId);

				// Get all teams for this user
				const teams = await db.query.linearTeamMappings.findMany({
					where: (teams, { eq, and }) =>
						and(eq(teams.userId, integration.userId), eq(teams.syncEnabled, true))
				});

				for (const team of teams) {
					try {
						// Generate embeddings for this team's data
						const projectResult = await intelligence.storeAllProjectsForTeam(
							team.linearTeamId
						);
						const issueResult = await intelligence.storeAllIssuesForProject(team.id);
						const interactionResult = await intelligence.storeAllInteractionsForTeam(
							team.linearTeamId
						);

						console.log(
							`[Cron] Team ${team.linearTeamName}: ${projectResult.processed} projects, ${issueResult.processed} issues, ${interactionResult.processed} interactions embedded`
						);
					} catch (error) {
						const err = error as Error;
						result.errors.push(`Team ${team.linearTeamName}: ${err.message}`);
					}
				}

				result.usersProcessed++;
			} catch (error) {
				const err = error as Error;
				result.errors.push(`User ${integration.userId}: ${err.message}`);
				console.error(`[Cron] Error generating embeddings for user ${integration.userId}:`, err);
			}
		}

		result.duration = Date.now() - startTime;
		console.log(
			`[Cron] Embedding generation completed in ${result.duration}ms. ${result.usersProcessed} users processed, ${result.errors.length} errors.`
		);
	} catch (error) {
		result.success = false;
		result.errors.push((error as Error).message);
		result.duration = Date.now() - startTime;
		console.error('[Cron] Embedding generation job failed:', error);
	}

	return result;
}

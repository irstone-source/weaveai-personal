import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	incrementalSyncJob,
	importMeetingsJob,
	fullSyncBackupJob,
	generateEmbeddingsJob
} from '$lib/server/cron/linear-sync-jobs';
import { env } from '$env/dynamic/private';

/**
 * POST /api/cron/linear-sync
 *
 * Cron endpoint for scheduled Linear sync jobs
 * Protected by CRON_SECRET environment variable
 *
 * Query params:
 * - job: 'incremental' | 'meetings' | 'full-backup' | 'embeddings'
 */
export const POST: RequestHandler = async ({ request, url }) => {
	// Verify cron secret for security
	const authHeader = request.headers.get('authorization');
	const cronSecret = env.CRON_SECRET || env.VERCEL_CRON_SECRET;

	if (cronSecret) {
		if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
			throw error(401, 'Unauthorized');
		}
	} else {
		console.warn('[Cron API] No CRON_SECRET configured - this endpoint is unprotected!');
	}

	const jobType = url.searchParams.get('job') || 'incremental';

	try {
		let result;

		switch (jobType) {
			case 'incremental':
				result = await incrementalSyncJob();
				break;

			case 'meetings':
				result = await importMeetingsJob();
				break;

			case 'full-backup':
				result = await fullSyncBackupJob();
				break;

			case 'embeddings':
				result = await generateEmbeddingsJob();
				break;

			default:
				throw error(400, `Invalid job type: ${jobType}`);
		}

		return json({
			success: result.success,
			job: jobType,
			usersProcessed: result.usersProcessed,
			errors: result.errors,
			duration: result.duration,
			timestamp: new Date().toISOString()
		});
	} catch (err) {
		const cronError = err as Error;
		console.error(`[Cron API] ${jobType} job failed:`, cronError);

		throw error(500, cronError.message || `${jobType} job failed`);
	}
};

/**
 * GET /api/cron/linear-sync
 *
 * Health check endpoint
 */
export const GET: RequestHandler = async () => {
	return json({
		status: 'ok',
		availableJobs: ['incremental', 'meetings', 'full-backup', 'embeddings'],
		message: 'Linear sync cron endpoint is ready'
	});
};

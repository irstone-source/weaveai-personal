/**
 * Fathom Meeting Import API Endpoint
 *
 * Handles bulk import of historical Fathom meetings
 * Supports date range filtering and progress tracking
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	fathomIntegrations,
	meetings,
	meetingTranscripts,
	meetingInsights
} from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import {
	fetchAllMeetings,
	getMeetingTranscript,
	getMeetingSummary,
	getDateRange,
	getCustomDateRange,
	type FathomMeeting,
	type FathomTranscript,
	type FathomSummary
} from '$lib/server/integrations/fathom';
import { adminSettingsService } from '$lib/server/admin-settings';

// ============================================================================
// Types
// ============================================================================

interface ImportRequest {
	days?: number;
	startDate?: string;
	endDate?: string;
	includeTranscripts?: boolean;
	includeSummaries?: boolean;
}

interface ImportProgress {
	status: 'in_progress' | 'completed' | 'failed';
	total: number;
	imported: number;
	failed: number;
	errors: string[];
}

// ============================================================================
// POST /api/integrations/fathom/import
// Import historical meetings
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Authentication check
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Unauthorized');
		}

		const userId = session.user.id;

		// Parse request body
		const body: ImportRequest = await request.json();
		const {
			days = 30,
			startDate,
			endDate,
			includeTranscripts = true,
			includeSummaries = true
		} = body;

		// Get Fathom API key from admin settings
		const fathomApiKey = await adminSettingsService.getSetting('fathom_api_key');

		if (!fathomApiKey) {
			throw error(400, 'Fathom API key not configured. Please configure it in admin settings.');
		}

		// Determine date range
		const dateRange = startDate && endDate
			? getCustomDateRange(new Date(startDate), new Date(endDate))
			: getDateRange(days);

		// Fetch all meetings from Fathom
		console.log(`[Fathom Import] Fetching meetings for user ${userId} from ${dateRange.start_date} to ${dateRange.end_date}`);

		const fathomMeetings = await fetchAllMeetings(fathomApiKey, {
			start_date: dateRange.start_date,
			end_date: dateRange.end_date,
			limit: 100
		});

		console.log(`[Fathom Import] Found ${fathomMeetings.length} meetings`);

		// Import progress tracking
		const progress: ImportProgress = {
			status: 'in_progress',
			total: fathomMeetings.length,
			imported: 0,
			failed: 0,
			errors: []
		};

		// Import each meeting
		for (const fathomMeeting of fathomMeetings) {
			try {
				await importMeeting({
					userId,
					fathomApiKey,
					fathomMeeting,
					includeTranscripts,
					includeSummaries
				});

				progress.imported++;
				console.log(`[Fathom Import] Imported meeting ${progress.imported}/${progress.total}: ${fathomMeeting.title}`);

			} catch (err) {
				progress.failed++;
				const errorMsg = err instanceof Error ? err.message : String(err);
				progress.errors.push(`Failed to import "${fathomMeeting.title}": ${errorMsg}`);
				console.error(`[Fathom Import] Error importing meeting ${fathomMeeting.id}:`, err);
			}
		}

		// Update progress status
		progress.status = progress.failed === progress.total ? 'failed' : 'completed';

		console.log(`[Fathom Import] Completed: ${progress.imported} imported, ${progress.failed} failed`);

		return json({
			success: true,
			progress,
			message: `Successfully imported ${progress.imported} of ${progress.total} meetings`
		});

	} catch (err) {
		console.error('[Fathom Import] Error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, err instanceof Error ? err.message : 'Failed to import Fathom meetings');
	}
};

// ============================================================================
// Helper: Import Single Meeting
// ============================================================================

async function importMeeting({
	userId,
	fathomApiKey,
	fathomMeeting,
	includeTranscripts,
	includeSummaries
}: {
	userId: string;
	fathomApiKey: string;
	fathomMeeting: FathomMeeting;
	includeTranscripts: boolean;
	includeSummaries: boolean;
}): Promise<void> {

	// Check if meeting already exists
	const [existingMeeting] = await db
		.select()
		.from(meetings)
		.where(
			and(
				eq(meetings.userId, userId),
				eq(meetings.fathomMeetingId, fathomMeeting.id)
			)
		)
		.limit(1);

	if (existingMeeting) {
		console.log(`[Fathom Import] Meeting ${fathomMeeting.id} already exists, skipping`);
		return;
	}

	// Create meeting record
	const [meeting] = await db
		.insert(meetings)
		.values({
			userId,
			fathomMeetingId: fathomMeeting.id,
			title: fathomMeeting.title,
			startTime: new Date(fathomMeeting.start_time),
			endTime: new Date(fathomMeeting.end_time),
			duration: fathomMeeting.duration,
			recordedBy: fathomMeeting.recorded_by.name,
			meetingUrl: fathomMeeting.recording_url,
			videoUrl: fathomMeeting.video_url,
			attendees: fathomMeeting.calendar_invitees || [],
			hasTranscript: false,
			hasInsights: false,
			isProcessed: false,
			processingStatus: 'pending',
			metadata: {
				platform: fathomMeeting.platform,
				teamIds: fathomMeeting.team_ids,
				...fathomMeeting.metadata
			}
		})
		.returning();

	// Import transcript if requested
	if (includeTranscripts) {
		try {
			const transcript = await getMeetingTranscript(fathomApiKey, fathomMeeting.id);
			await importTranscript(meeting.id, transcript);

			// Update meeting to mark transcript as available
			await db
				.update(meetings)
				.set({ hasTranscript: true })
				.where(eq(meetings.id, meeting.id));

		} catch (err) {
			console.warn(`[Fathom Import] No transcript available for meeting ${fathomMeeting.id}`);
		}
	}

	// Import summary if requested
	if (includeSummaries) {
		try {
			const summary = await getMeetingSummary(fathomApiKey, fathomMeeting.id);
			await importSummary(meeting.id, summary);

			// Update meeting to mark insights as available
			await db
				.update(meetings)
				.set({ hasInsights: true })
				.where(eq(meetings.id, meeting.id));

		} catch (err) {
			console.warn(`[Fathom Import] No summary available for meeting ${fathomMeeting.id}`);
		}
	}
}

// ============================================================================
// Helper: Import Transcript
// ============================================================================

async function importTranscript(
	meetingId: string,
	transcript: FathomTranscript
): Promise<void> {
	await db
		.insert(meetingTranscripts)
		.values({
			meetingId,
			fullTranscript: transcript.full_transcript,
			segments: transcript.segments || [],
			summary: transcript.full_transcript.slice(0, 500), // First 500 chars as preview
			keywords: transcript.keywords || [],
			actionItems: [],
			isChunked: false,
			chunksStored: 0
		});
}

// ============================================================================
// Helper: Import Summary (as Insights)
// ============================================================================

async function importSummary(
	meetingId: string,
	summary: FathomSummary
): Promise<void> {

	// Store the main summary as an insight
	await db
		.insert(meetingInsights)
		.values({
			meetingId,
			insightType: 'summary',
			content: summary.summary,
			importance: 8,
			category: 'general',
			metadata: {}
		});

	// Store each action item as a separate insight
	for (const actionItem of summary.action_items || []) {
		await db
			.insert(meetingInsights)
			.values({
				meetingId,
				insightType: 'action_item',
				content: actionItem.text,
				speaker: actionItem.assignee,
				importance: 9,
				category: 'action',
				metadata: {
					dueDate: actionItem.due_date
				}
			});
	}

	// Store key points as insights
	for (const keyPoint of summary.key_points || []) {
		await db
			.insert(meetingInsights)
			.values({
				meetingId,
				insightType: 'key_point',
				content: keyPoint,
				importance: 7,
				category: 'general',
				metadata: {}
			});
	}
}

// ============================================================================
// GET /api/integrations/fathom/import
// Get import status/statistics
// ============================================================================

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// Authentication check
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Unauthorized');
		}

		const userId = session.user.id;

		// Get meeting statistics
		const userMeetings = await db
			.select()
			.from(meetings)
			.where(eq(meetings.userId, userId));

		const stats = {
			totalMeetings: userMeetings.length,
			withTranscripts: userMeetings.filter(m => m.hasTranscript).length,
			withInsights: userMeetings.filter(m => m.hasInsights).length,
			processed: userMeetings.filter(m => m.isProcessed).length,
			pending: userMeetings.filter(m => m.processingStatus === 'pending').length,
			oldestMeeting: userMeetings.length > 0
				? new Date(Math.min(...userMeetings.map(m => m.startTime.getTime())))
				: null,
			newestMeeting: userMeetings.length > 0
				? new Date(Math.max(...userMeetings.map(m => m.startTime.getTime())))
				: null
		};

		return json({
			success: true,
			stats
		});

	} catch (err) {
		console.error('[Fathom Import] Error getting stats:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to get import statistics');
	}
};

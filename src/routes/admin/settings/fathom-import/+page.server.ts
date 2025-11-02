import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { meetings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();

	if (!session?.user) {
		throw redirect(302, '/auth/signin');
	}

	// Check if user is admin
	if (!session.user.isAdmin) {
		throw redirect(302, '/');
	}

	const userId = session.user.id;

	// Get meeting statistics (handle case where meetings table doesn't exist yet)
	let stats = {
		totalMeetings: 0,
		withTranscripts: 0,
		withInsights: 0,
		processed: 0,
		pending: 0,
		oldestMeeting: null,
		newestMeeting: null
	};

	try {
		const userMeetings = await db
			.select()
			.from(meetings)
			.where(eq(meetings.userId, userId));

		stats = {
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
	} catch (error) {
		console.error('[Fathom Import] Failed to load meeting statistics:', error);
		// Return default stats if table doesn't exist yet
	}

	return {
		stats
	};
};

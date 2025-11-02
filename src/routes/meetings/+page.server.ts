import { db } from '$lib/server/db';
import { meetings } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();

	if (!session?.user?.id) {
		return {
			meetings: [],
			stats: {
				total: 0,
				withTranscripts: 0,
				withInsights: 0
			}
		};
	}

	try {
		// Load meetings for current user
		const userMeetings = await db
			.select()
			.from(meetings)
			.where(eq(meetings.userId, session.user.id))
			.orderBy(desc(meetings.startTime));

		// Calculate statistics
		const stats = {
			total: userMeetings.length,
			withTranscripts: userMeetings.filter(m => m.hasTranscript).length,
			withInsights: userMeetings.filter(m => m.hasInsights).length
		};

		return {
			meetings: userMeetings,
			stats
		};
	} catch (error) {
		console.error('Error loading meetings:', error);
		return {
			meetings: [],
			stats: {
				total: 0,
				withTranscripts: 0,
				withInsights: 0
			}
		};
	}
};

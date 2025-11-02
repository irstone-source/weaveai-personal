import { db } from '$lib/server/db';
import { meetings, meetingTranscripts, meetingInsights } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = await locals.auth();

	if (!session?.user?.id) {
		throw error(401, 'Unauthorized');
	}

	const meetingId = params.id;

	try {
		// Load meeting
		const meeting = await db
			.select()
			.from(meetings)
			.where(
				and(
					eq(meetings.id, meetingId),
					eq(meetings.userId, session.user.id)
				)
			)
			.limit(1);

		if (meeting.length === 0) {
			throw error(404, 'Meeting not found');
		}

		// Load transcript if available
		let transcript = null;
		if (meeting[0].hasTranscript) {
			const transcriptData = await db
				.select()
				.from(meetingTranscripts)
				.where(eq(meetingTranscripts.meetingId, meetingId))
				.limit(1);

			transcript = transcriptData.length > 0 ? transcriptData[0] : null;
		}

		// Load insights if available
		let insights: any[] = [];
		if (meeting[0].hasInsights) {
			insights = await db
				.select()
				.from(meetingInsights)
				.where(eq(meetingInsights.meetingId, meetingId));
		}

		// Group insights by type
		const groupedInsights = {
			decisions: insights.filter(i => i.insightType === 'decision'),
			actionItems: insights.filter(i => i.insightType === 'action_item'),
			risks: insights.filter(i => i.insightType === 'risk'),
			opportunities: insights.filter(i => i.insightType === 'opportunity'),
			keyPoints: insights.filter(i => i.insightType === 'key_point'),
			questions: insights.filter(i => i.insightType === 'question')
		};

		return {
			meeting: meeting[0],
			transcript,
			insights: groupedInsights
		};
	} catch (err) {
		console.error('Error loading meeting:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to load meeting');
	}
};

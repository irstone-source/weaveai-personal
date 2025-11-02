import { db } from '$lib/server/db';
import { meetings, meetingInsights } from '$lib/server/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();

	if (!session?.user?.id) {
		return {
			stats: {
				totalInsights: 0,
				decisions: 0,
				actionItems: 0,
				risks: 0,
				opportunities: 0,
				keyPoints: 0,
				questions: 0
			},
			recentInsights: [],
			insightsByMeeting: []
		};
	}

	try {
		// Get all user meetings
		const userMeetings = await db
			.select({ id: meetings.id })
			.from(meetings)
			.where(eq(meetings.userId, session.user.id));

		const meetingIds = userMeetings.map(m => m.id);

		if (meetingIds.length === 0) {
			return {
				stats: {
					totalInsights: 0,
					decisions: 0,
					actionItems: 0,
					risks: 0,
					opportunities: 0,
					keyPoints: 0,
					questions: 0
				},
				recentInsights: [],
				insightsByMeeting: []
			};
		}

		// Get all insights for user's meetings
		const allInsights = await db
			.select()
			.from(meetingInsights)
			.where(sql`${meetingInsights.meetingId} IN ${sql.raw(`(${meetingIds.map(() => '?').join(', ')})`)}`)
			.orderBy(desc(meetingInsights.createdAt));

		// Calculate statistics
		const stats = {
			totalInsights: allInsights.length,
			decisions: allInsights.filter(i => i.insightType === 'decision').length,
			actionItems: allInsights.filter(i => i.insightType === 'action_item').length,
			risks: allInsights.filter(i => i.insightType === 'risk').length,
			opportunities: allInsights.filter(i => i.insightType === 'opportunity').length,
			keyPoints: allInsights.filter(i => i.insightType === 'key_point').length,
			questions: allInsights.filter(i => i.insightType === 'question').length
		};

		// Get recent insights with meeting details
		const recentInsights = await db
			.select({
				insight: meetingInsights,
				meeting: meetings
			})
			.from(meetingInsights)
			.innerJoin(meetings, eq(meetingInsights.meetingId, meetings.id))
			.where(eq(meetings.userId, session.user.id))
			.orderBy(desc(meetingInsights.createdAt))
			.limit(20);

		// Group insights by meeting
		const insightsGrouped: Record<string, any> = {};
		allInsights.forEach(insight => {
			if (!insightsGrouped[insight.meetingId]) {
				insightsGrouped[insight.meetingId] = {
					meetingId: insight.meetingId,
					insights: [],
					decisions: 0,
					actionItems: 0,
					risks: 0,
					opportunities: 0
				};
			}
			insightsGrouped[insight.meetingId].insights.push(insight);

			if (insight.insightType === 'decision') insightsGrouped[insight.meetingId].decisions++;
			if (insight.insightType === 'action_item') insightsGrouped[insight.meetingId].actionItems++;
			if (insight.insightType === 'risk') insightsGrouped[insight.meetingId].risks++;
			if (insight.insightType === 'opportunity') insightsGrouped[insight.meetingId].opportunities++;
		});

		// Get meeting details for grouped insights
		const insightsByMeeting = await Promise.all(
			Object.values(insightsGrouped).map(async (group: any) => {
				const meeting = await db
					.select()
					.from(meetings)
					.where(eq(meetings.id, group.meetingId))
					.limit(1);

				return {
					...group,
					meeting: meeting[0] || null
				};
			})
		);

		// Sort by meeting date
		insightsByMeeting.sort((a, b) => {
			const dateA = a.meeting?.startTime ? new Date(a.meeting.startTime).getTime() : 0;
			const dateB = b.meeting?.startTime ? new Date(b.meeting.startTime).getTime() : 0;
			return dateB - dateA;
		});

		return {
			stats,
			recentInsights,
			insightsByMeeting
		};
	} catch (error) {
		console.error('Error loading insights:', error);
		return {
			stats: {
				totalInsights: 0,
				decisions: 0,
				actionItems: 0,
				risks: 0,
				opportunities: 0,
				keyPoints: 0,
				questions: 0
			},
			recentInsights: [],
			insightsByMeeting: []
		};
	}
};

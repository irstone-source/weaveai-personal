import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index.js';
import { chats, users, subscriptions, paymentHistory } from '$lib/server/db/schema.js';
import { eq, sql, gte } from 'drizzle-orm';
import { isDemoModeEnabled } from '$lib/constants/demo-mode.js';
import type { 
  AnalyticsApiResponse, 
  AnalyticsDataPoint, 
  RateLimitInfo,
  DailyChatCount,
  PeriodChatCount,
  DailyUserCount,
  DailySubscriptionCount,
  DailyRevenueCount
} from '$lib/types/analytics.js';
import { getRateLimitConfig, getAnalyticsPeriodDays, getMaxAnalyticsPeriodDays } from '$lib/config/analytics.js';

// Simple in-memory rate limiting for analytics (production should use Redis)
const rateLimitMap = new Map<string, RateLimitInfo>();

function checkRateLimit(userId: string): boolean {
	const config = getRateLimitConfig();
	const now = Date.now();
	const userLimit = rateLimitMap.get(userId);
	
	if (!userLimit || now > userLimit.resetTime) {
		// Reset or create new limit window
		rateLimitMap.set(userId, { count: 1, resetTime: now + config.windowMs });
		return true;
	}
	
	if (userLimit.count >= config.maxRequests) {
		return false; // Rate limit exceeded
	}
	
	userLimit.count++;
	return true;
}

export const GET: RequestHandler = async ({ locals }) => {
	// Check if user is authenticated and is admin
	const session = await locals.auth();
	if (!session?.user?.id) {
		return error(401, 'Unauthorized');
	}

	// Apply rate limiting
	if (!checkRateLimit(session.user.id)) {
		return error(429, 'Too Many Requests - Rate limit exceeded');
	}

	// Check if user is admin
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, session.user.id));

	if (!user?.isAdmin) {
		return error(403, 'Forbidden - Admin access required');
	}

	try {
		// Input validation and sanitization using centralized configuration
		const DEFAULT_PERIOD_DAYS = getAnalyticsPeriodDays();
		const MAX_PERIOD_DAYS = getMaxAnalyticsPeriodDays();
		
		// Validate period (when query params are added in the future)
		let periodDays = DEFAULT_PERIOD_DAYS;
		
		// Ensure period is within safe bounds
		if (periodDays < 1 || periodDays > MAX_PERIOD_DAYS) {
			return error(400, `Period must be between 1 and ${MAX_PERIOD_DAYS} days`);
		}

		// Get chat analytics for the specified period
		const periodDaysAgo = new Date();
		periodDaysAgo.setDate(periodDaysAgo.getDate() - periodDays);
		const periodDaysAgoString = periodDaysAgo.toISOString();

		// Validate date calculations
		if (isNaN(periodDaysAgo.getTime())) {
			return error(400, 'Invalid date calculation');
		}

		// Query to get daily chat counts
		// Note: Ensure idx_chats_created_at index exists for optimal performance
		const dailyChatCounts: DailyChatCount[] = await db
			.select({
				date: sql<string>`DATE(${chats.createdAt})`.as('date'),
				count: sql<number>`COUNT(*)::int`.as('count'),
			})
			.from(chats)
			.where(sql`${chats.createdAt} >= ${periodDaysAgoString}`)
			.groupBy(sql`DATE(${chats.createdAt})`)
			.orderBy(sql`DATE(${chats.createdAt})`);

		// Query to get daily user registrations
		const dailyUserCounts: DailyUserCount[] = await db
			.select({
				date: sql<string>`DATE(${users.createdAt})`.as('date'),
				count: sql<number>`COUNT(*)::int`.as('count'),
			})
			.from(users)
			.where(sql`${users.createdAt} >= ${periodDaysAgoString}`)
			.groupBy(sql`DATE(${users.createdAt})`)
			.orderBy(sql`DATE(${users.createdAt})`);

		// Get baseline active subscriptions count before the analytics period
		// Count all currently active subscriptions (including those that won't auto-renew)
		const [baselineActiveSubscriptions] = await db
			.select({
				count: sql<number>`COUNT(*)::int`.as('count'),
			})
			.from(subscriptions)
			.where(sql`${subscriptions.createdAt} < ${periodDaysAgoString} 
				AND (${subscriptions.status} = 'active' OR ${subscriptions.status} = 'trialing')
				AND (${subscriptions.endedAt} IS NULL OR ${subscriptions.endedAt} > CURRENT_DATE)
				AND ${subscriptions.currentPeriodEnd} > CURRENT_DATE`);

		// Query to get daily new active subscriptions  
		// Count all new subscriptions that are currently active (including those that won't auto-renew)
		const dailyNewSubscriptions = await db
			.select({
				date: sql<string>`DATE(${subscriptions.createdAt})`.as('date'),
				count: sql<number>`COUNT(*)::int`.as('count'),
			})
			.from(subscriptions)
			.where(sql`${subscriptions.createdAt} >= ${periodDaysAgoString} 
				AND (${subscriptions.status} = 'active' OR ${subscriptions.status} = 'trialing')
				AND (${subscriptions.endedAt} IS NULL OR ${subscriptions.endedAt} > CURRENT_DATE)
				AND ${subscriptions.currentPeriodEnd} > CURRENT_DATE`)
			.groupBy(sql`DATE(${subscriptions.createdAt})`)
			.orderBy(sql`DATE(${subscriptions.createdAt})`);

		// Query to get daily ended subscriptions
		// Count subscriptions that became inactive each day (either ended or period expired)
		const dailyEndedSubscriptions = await db
			.select({
				date: sql<string>`COALESCE(DATE(${subscriptions.endedAt}), DATE(${subscriptions.currentPeriodEnd}))`.as('date'),
				count: sql<number>`COUNT(*)::int`.as('count'),
			})
			.from(subscriptions)
			.where(sql`
				(
					(${subscriptions.endedAt} >= ${periodDaysAgoString} AND ${subscriptions.endedAt} IS NOT NULL)
					OR 
					(${subscriptions.cancelAtPeriodEnd} = true 
						AND ${subscriptions.currentPeriodEnd} >= ${periodDaysAgoString}
						AND ${subscriptions.currentPeriodEnd} <= CURRENT_DATE)
				)
			`)
			.groupBy(sql`COALESCE(DATE(${subscriptions.endedAt}), DATE(${subscriptions.currentPeriodEnd}))`)
			.orderBy(sql`COALESCE(DATE(${subscriptions.endedAt}), DATE(${subscriptions.currentPeriodEnd}))`);

		// Create a map for quick lookups and calculate net changes per day
		const subscriptionChangesMap = new Map<string, number>();

		// Add new subscriptions
		dailyNewSubscriptions.forEach(row => {
			subscriptionChangesMap.set(row.date, (subscriptionChangesMap.get(row.date) || 0) + row.count);
		});

		// Subtract ended subscriptions  
		dailyEndedSubscriptions.forEach(row => {
			subscriptionChangesMap.set(row.date, (subscriptionChangesMap.get(row.date) || 0) - row.count);
		});

		// Convert map to the format expected by the rest of the code
		const dailySubscriptionCounts: DailySubscriptionCount[] = Array.from(subscriptionChangesMap.entries()).map(([date, count]) => ({
			date,
			count
		})).sort((a, b) => a.date.localeCompare(b.date));

		// Query to get daily revenue from successful payments
		const dailyRevenueCounts: DailyRevenueCount[] = await db
			.select({
				date: sql<string>`DATE(${paymentHistory.paidAt})`.as('date'),
				revenue: sql<number>`SUM(${paymentHistory.amount})::int`.as('revenue'),
			})
			.from(paymentHistory)
			.where(sql`
				${paymentHistory.paidAt} >= ${periodDaysAgoString} 
				AND ${paymentHistory.status} = 'succeeded'
				AND ${paymentHistory.paidAt} IS NOT NULL
			`)
			.groupBy(sql`DATE(${paymentHistory.paidAt})`)
			.orderBy(sql`DATE(${paymentHistory.paidAt})`);

		// Validate database query results
		if (!Array.isArray(dailyChatCounts) || !Array.isArray(dailyUserCounts) || !Array.isArray(dailySubscriptionCounts) || !Array.isArray(dailyRevenueCounts)) {
			throw new Error('Invalid database response format');
		}

		// Fill in missing dates with 0 counts and calculate cumulative totals
		const analyticsData: AnalyticsDataPoint[] = [];
		const currentDate = new Date(periodDaysAgo);
		const today = new Date();
		
		// Get total users registered before our period for cumulative calculation
		const [previousTotalUsers] = await db
			.select({
				count: sql<number>`COUNT(*)::int`.as('count'),
			})
			.from(users)
			.where(sql`${users.createdAt} < ${periodDaysAgoString}`);
		
		let cumulativeUsers = previousTotalUsers?.count || 0;
		let cumulativeActiveSubscriptions = baselineActiveSubscriptions?.count || 0;

		while (currentDate <= today) {
			const dateStr = currentDate.toISOString().split('T')[0];
			const existingChatData = dailyChatCounts.find(d => d.date === dateStr);
			const existingUserData = dailyUserCounts.find(d => d.date === dateStr);
			const existingSubscriptionData = dailySubscriptionCounts.find(d => d.date === dateStr);
			const existingRevenueData = dailyRevenueCounts.find(d => d.date === dateStr);
			
			// Validate individual data points
			const chatCount = existingChatData?.count || 0;
			const userCount = existingUserData?.count || 0;
			const subscriptionNetChange = existingSubscriptionData?.count || 0; // This is now net change (new - canceled)
			const revenueAmount = existingRevenueData?.revenue || 0; // Revenue in cents
			
			if (typeof chatCount !== 'number' || chatCount < 0 || 
				typeof userCount !== 'number' || userCount < 0 ||
				typeof revenueAmount !== 'number' || revenueAmount < 0) {
				throw new Error('Invalid analytics data');
			}
			
			// Add daily registrations to cumulative total
			cumulativeUsers += userCount;
			
			// Apply daily subscription net change to cumulative active subscriptions
			cumulativeActiveSubscriptions += subscriptionNetChange;
			
			// Ensure active subscriptions never go below 0
			if (cumulativeActiveSubscriptions < 0) {
				cumulativeActiveSubscriptions = 0;
			}
			
			analyticsData.push({
				date: new Date(currentDate),
				chats: chatCount,
				totalUsers: cumulativeUsers,
				activeSubscriptions: cumulativeActiveSubscriptions,
				revenue: revenueAmount, // Store in cents for precision
			});

			currentDate.setDate(currentDate.getDate() + 1);
		}

		// Validate final data array
		if (analyticsData.length === 0) {
			throw new Error('No analytics data generated');
		}

		// Calculate totals for the period
		const totalChats = analyticsData.reduce((sum, day) => sum + day.chats, 0);
		const totalRevenue = analyticsData.reduce((sum, day) => sum + day.revenue, 0);
		const currentTotalUsers = analyticsData[analyticsData.length - 1]?.totalUsers || 0;
		const currentTotalActiveSubscriptions = analyticsData[analyticsData.length - 1]?.activeSubscriptions || 0;

		// Calculate percentage change from previous period
		const previousPeriodStart = new Date(periodDaysAgo);
		previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);
		const previousPeriodStartString = previousPeriodStart.toISOString();

		// Validate previous period date calculation
		if (isNaN(previousPeriodStart.getTime())) {
			throw new Error('Invalid previous period date calculation');
		}

		const previousPeriodCounts: PeriodChatCount[] = await db
			.select({
				count: sql<number>`COUNT(*)::int`.as('count'),
			})
			.from(chats)
			.where(
				sql`${chats.createdAt} >= ${previousPeriodStartString} AND ${chats.createdAt} < ${periodDaysAgoString}`
			);

		const previousPeriodTotal = previousPeriodCounts[0]?.count || 0;
		
		// Validate previous period total
		if (typeof previousPeriodTotal !== 'number' || previousPeriodTotal < 0) {
			throw new Error('Invalid previous period total');
		}
		
		const percentageChange = previousPeriodTotal > 0 
			? ((totalChats - previousPeriodTotal) / previousPeriodTotal) * 100 
			: totalChats > 0 ? 100 : 0;

		// Calculate previous period revenue for comparison
		const [previousPeriodRevenue] = await db
			.select({
				revenue: sql<number>`COALESCE(SUM(${paymentHistory.amount}), 0)::int`.as('revenue'),
			})
			.from(paymentHistory)
			.where(sql`
				${paymentHistory.paidAt} >= ${previousPeriodStartString} 
				AND ${paymentHistory.paidAt} < ${periodDaysAgoString}
				AND ${paymentHistory.status} = 'succeeded'
				AND ${paymentHistory.paidAt} IS NOT NULL
			`);

		const previousPeriodRevenueTotal = previousPeriodRevenue?.revenue || 0;
		const revenuePercentageChange = previousPeriodRevenueTotal > 0 
			? ((totalRevenue - previousPeriodRevenueTotal) / previousPeriodRevenueTotal) * 100 
			: totalRevenue > 0 ? 100 : 0;

		// Validate percentage change calculations
		if (typeof percentageChange !== 'number' || !isFinite(percentageChange) ||
			typeof revenuePercentageChange !== 'number' || !isFinite(revenuePercentageChange)) {
			throw new Error('Invalid percentage change calculation');
		}

		const response: AnalyticsApiResponse = {
			success: true,
			data: analyticsData,
			totalChats,
			totalUsers: currentTotalUsers,
			totalActiveSubscriptions: currentTotalActiveSubscriptions,
			totalRevenue,
			percentageChange: Math.round(percentageChange * 10) / 10, // Round to 1 decimal place
			revenuePercentageChange: Math.round(revenuePercentageChange * 10) / 10, // Round to 1 decimal place
		};

		return json(response);
	} catch (err) {
		// Log error safely without exposing sensitive information
		console.error('Analytics API Error:', {
			message: err instanceof Error ? err.message : 'Unknown error',
			timestamp: new Date().toISOString(),
			userId: session.user.id
		});
		return error(500, 'Failed to fetch analytics data');
	}
};
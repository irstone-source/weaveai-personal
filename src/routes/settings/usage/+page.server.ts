import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { UsageTrackingService } from '$lib/server/usage-tracking.js';
import { StripeService } from '$lib/server/stripe.js';

export const load = (async ({ parent }) => {
	// Get session from parent settings layout
	const { session } = await parent();
	if (!session?.user?.id) {
		redirect(302, '/auth/signin');
	}

	try {
		// Get subscription information first to determine plan tier
		const subscriptionData = await StripeService.getActiveSubscription(session.user.id);
		const planTier = subscriptionData?.plan?.tier || 'free';

		// Get usage summary and model statistics for the current user
		const [usageSummary, modelUsageStatistics] = await Promise.all([
			UsageTrackingService.getUsageSummary(session.user.id, planTier),
			UsageTrackingService.getModelUsageStatistics(session.user.id)
		]);
		
		// Calculate billing period info based on subscription or calendar month
		const now = new Date();
		let currentPeriod;
		
		if (subscriptionData?.subscription) {
			// Use subscription billing period for paid users
			const periodStart = new Date(subscriptionData.subscription.currentPeriodStart);
			const periodEnd = new Date(subscriptionData.subscription.currentPeriodEnd);
			const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
			
			currentPeriod = {
				start: periodStart.toLocaleDateString('en-US', { 
					year: 'numeric', 
					month: 'long', 
					day: 'numeric' 
				}),
				end: periodEnd.toLocaleDateString('en-US', { 
					year: 'numeric', 
					month: 'long', 
					day: 'numeric' 
				}),
				daysRemaining,
				month: periodStart.getMonth() + 1,
				year: periodStart.getFullYear()
			};
		} else {
			// Use 12-hour periods for free users
			currentPeriod = UsageTrackingService.getFreePlanPeriod();
		}

		return {
			usageSummary,
			modelUsageStatistics,
			subscription: subscriptionData,
			currentPeriod,
			planTier
		};
	} catch (error) {
		console.error('Error loading usage data:', error);
		
		// Return default data on error (fallback to 12-hour periods for free users)
		const now = new Date();
		const currentMonth = now.getMonth() + 1;
		const currentYear = now.getFullYear();

		return {
			usageSummary: {
				text: { used: 0, limit: null, percentage: 0 },
				image: { used: 0, limit: null, percentage: 0 },
				video: { used: 0, limit: null, percentage: 0 },
				month: currentMonth,
				year: currentYear
			},
			modelUsageStatistics: [],
			subscription: null,
			currentPeriod: UsageTrackingService.getFreePlanPeriod(),
			planTier: 'free'
		};
	}
}) satisfies PageServerLoad;
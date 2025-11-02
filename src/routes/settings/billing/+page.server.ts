import type { PageServerLoad } from './$types';
import { StripeService } from '$lib/server/stripe.js';
import { db } from '$lib/server/db/index.js';
import { users, paymentHistory, usageTracking } from '$lib/server/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
	// Get session and user data from parent settings layout
	const { session, user } = await parent();
	
	if (!session?.user?.id) {
		return {
			user: null,
			subscription: null,
			paymentHistory: [],
			currentUsage: null,
		};
	}

	try {
		// Get user data
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, session.user.id));

		// Get active subscription with plan details (will be null for free users)
		const subscriptionData = await StripeService.getActiveSubscription(session.user.id);

		// Get payment history (last 10 payments)
		const payments = await db
			.select()
			.from(paymentHistory)
			.where(eq(paymentHistory.userId, session.user.id))
			.orderBy(desc(paymentHistory.createdAt))
			.limit(10);

		// Get current month usage
		const currentDate = new Date();
		const currentMonth = currentDate.getMonth() + 1;
		const currentYear = currentDate.getFullYear();
		
		const [usage] = await db
			.select()
			.from(usageTracking)
			.where(
				and(
					eq(usageTracking.userId, session.user.id),
					eq(usageTracking.month, currentMonth),
					eq(usageTracking.year, currentYear)
				)
			);

		return {
			user,
			subscription: subscriptionData,
			paymentHistory: payments.map(payment => ({
				id: payment.id,
				description: payment.description || 'Subscription payment',
				amount: `$${(payment.amount / 100).toFixed(2)}`,
				date: payment.createdAt.toLocaleDateString(),
				status: payment.status,
			})),
			currentUsage: usage ? {
				textGeneration: usage.textGenerationCount,
				imageGeneration: usage.imageGenerationCount,
				videoGeneration: usage.videoGenerationCount,
			} : {
				textGeneration: 0,
				imageGeneration: 0,
				videoGeneration: 0,
			},
		};
	} catch (error) {
		console.error('Error loading billing data:', error);
		return {
			user: null,
			subscription: null,
			paymentHistory: [],
			currentUsage: null,
		};
	}
};
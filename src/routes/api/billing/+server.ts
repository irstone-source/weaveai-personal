import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StripeService } from '$lib/server/stripe.js';
import { db } from '$lib/server/db/index.js';
import { users, paymentHistory, usageTracking } from '$lib/server/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const session = await locals.auth();
		
		if (!session?.user?.id) {
			return error(401, 'Unauthorized');
		}

		// Get user data
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, session.user.id));

		if (!user) {
			return error(404, 'User not found');
		}

		// Get active subscription with plan details
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

		return json({
			success: true,
			data: {
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
			}
		});

	} catch (err) {
		console.error('Error fetching billing data:', err);
		return error(500, 'Failed to fetch billing data');
	}
};
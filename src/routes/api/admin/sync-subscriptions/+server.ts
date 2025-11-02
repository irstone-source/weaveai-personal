import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripe } from '$lib/server/stripe.js';
import { db } from '$lib/server/db/index.js';
import { users, subscriptions, pricingPlans } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

export const POST: RequestHandler = async ({ locals }) => {
	// Only allow in development or if user is authenticated as admin
	if (!dev) {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return error(401, 'Unauthorized');
		}

		// Check if user is admin
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, session.user.id));

		if (!user?.isAdmin) {
			return error(403, 'Forbidden - Admin access required');
		}
	}

	// Check demo mode - block modifications
	if (isDemoModeEnabled()) {
		return json({
			error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED,
			type: 'demo_mode_restriction'
		}, { status: 403 });
	}

	try {
		// Get all users with Stripe customer IDs
		const usersWithStripe = await db
			.select()
			.from(users)
			.where(eq(users.stripeCustomerId, users.stripeCustomerId)); // Get users who have a Stripe customer ID

		let syncedCount = 0;

		for (const user of usersWithStripe) {
			if (!user.stripeCustomerId) continue;

			try {
				// Get active subscriptions from Stripe for this customer
				const stripe = await getStripe();
				const stripeSubscriptions = await stripe.subscriptions.list({
					customer: user.stripeCustomerId,
					status: 'active',
				});

				if (stripeSubscriptions.data.length > 0) {
					const stripeSubscription = stripeSubscriptions.data[0]; // Get the first active subscription
					
					// Get plan details from Stripe price
					const priceId = stripeSubscription.items.data[0]?.price.id;
					if (!priceId) continue;

					const [plan] = await db
						.select()
						.from(pricingPlans)
						.where(eq(pricingPlans.stripePriceId, priceId));

					if (!plan) {
						console.log(`No pricing plan found for price ID: ${priceId}`);
						continue;
					}

					// Check if subscription already exists in our database
					const [existingSubscription] = await db
						.select()
						.from(subscriptions)
						.where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id));

					if (!existingSubscription) {
						// Create subscription record
						await db.insert(subscriptions).values({
							userId: user.id,
							stripeSubscriptionId: stripeSubscription.id,
							stripePriceId: priceId,
							planTier: plan.tier,
							status: stripeSubscription.status as any,
							currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
							currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
							cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
							canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
							endedAt: stripeSubscription.ended_at ? new Date(stripeSubscription.ended_at * 1000) : null,
						});
					}

					// Update user subscription status
					await db
						.update(users)
						.set({
							subscriptionStatus: stripeSubscription.status as any,
							planTier: plan.tier,
						})
						.where(eq(users.id, user.id));

					syncedCount++;
					console.log(`Synced subscription for user ${user.id}: ${plan.name} plan`);
				}
			} catch (err) {
				console.error(`Error syncing subscription for user ${user.id}:`, err);
			}
		}

		return json({
			success: true,
			message: `Synced ${syncedCount} subscriptions`,
			syncedCount,
		});
	} catch (err) {
		console.error('Error syncing subscriptions:', err);
		return error(500, 'Failed to sync subscriptions');
	}
};
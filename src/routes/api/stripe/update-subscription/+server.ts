import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StripeService } from '$lib/server/stripe.js';
import { isValidPriceId } from '$lib/server/pricing-plans-seeder.js';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = await locals.auth();
		
		if (!session?.user?.id) {
			return error(401, 'Unauthorized');
		}

		const { priceId } = await request.json();

		if (!priceId || typeof priceId !== 'string') {
			return error(400, 'Price ID is required');
		}

		// Validate that the price ID exists in our pricing plans database
		// This prevents users from passing arbitrary Stripe price IDs and supports both monthly and yearly plans
		const isValid = await isValidPriceId(priceId);
		if (!isValid) {
			return error(400, 'Invalid price ID');
		}

		// Check if user has an active subscription
		const activeSubscription = await StripeService.getActiveSubscription(session.user.id);
		
		if (!activeSubscription) {
			// No existing subscription - redirect to checkout for new subscription
			return json({
				success: false,
				requiresCheckout: true,
				message: 'No active subscription found. Please use checkout flow for new subscriptions.',
			});
		}

		// Check if they're trying to "upgrade" to the same plan
		if (activeSubscription.subscription.stripePriceId === priceId) {
			return json({
				success: false,
				message: 'You are already subscribed to this plan.',
			});
		}

		// Update the subscription plan
		const { subscription: updatedSubscription, wasUpdated } = await StripeService.updateSubscriptionPlan(
			session.user.id, 
			priceId
		);

		if (!wasUpdated) {
			return json({
				success: false,
				message: 'Subscription is already using this plan.',
			});
		}

		// Calculate proration amount from the latest invoice
		let prorationAmount = 0;
		try {
			// Get the latest invoice to show proration details
			const { getStripe } = await import('$lib/server/stripe.js');
			const stripe = await getStripe();
			const invoices = await stripe.invoices.list({
				customer: updatedSubscription.customer as string,
				subscription: updatedSubscription.id,
				limit: 1,
			});
			
			if (invoices.data.length > 0) {
				const latestInvoice = invoices.data[0];
				prorationAmount = latestInvoice.amount_paid || 0;
			}
		} catch (invoiceError) {
			console.warn('Could not fetch latest invoice for proration details:', invoiceError);
		}

		return json({
			success: true,
			message: 'Subscription updated successfully!',
			subscription: {
				id: updatedSubscription.id,
				status: updatedSubscription.status,
				current_period_end: (updatedSubscription as any).current_period_end,
				proration_amount: prorationAmount,
			},
			// Add freshness indicators for race condition handling
			updateTimestamp: Date.now(),
			expectedPriceId: priceId,
		});

	} catch (err) {
		console.error('Error updating subscription:', err);
		
		// Provide more specific error messages based on the error type
		let errorMessage = 'Failed to update subscription';
		if (err instanceof Error) {
			if (err.message.includes('No active subscription')) {
				errorMessage = 'No active subscription found';
			} else if (err.message.includes('subscription item')) {
				errorMessage = 'Invalid subscription configuration';
			} else {
				errorMessage = err.message;
			}
		}
		
		return error(500, errorMessage);
	}
};
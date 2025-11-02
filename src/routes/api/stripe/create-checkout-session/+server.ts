import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StripeService } from '$lib/server/stripe.js';
import { isValidPriceId } from '$lib/server/pricing-plans-seeder.js';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request, locals, url }) => {
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

		const origin = url.origin;
		const successUrl = `${origin}/settings/billing?session_id={CHECKOUT_SESSION_ID}`;
		const cancelUrl = `${origin}/settings/billing?canceled=true`;

		const checkoutSession = await StripeService.createCheckoutSession({
			userId: session.user.id,
			priceId,
			successUrl,
			cancelUrl,
		});

		return json({
			clientSecret: checkoutSession.client_secret,
			sessionId: checkoutSession.id,
		});

	} catch (err) {
		console.error('Error creating checkout session:', err);
		return error(500, 'Failed to create checkout session');
	}
};
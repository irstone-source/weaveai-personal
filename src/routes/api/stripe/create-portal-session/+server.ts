import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StripeService } from '$lib/server/stripe.js';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ locals, url }) => {
	try {
		const session = await locals.auth();
		
		if (!session?.user?.id) {
			return error(401, 'Unauthorized');
		}

		// Get user's Stripe customer ID
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, session.user.id));

		if (!user) {
			return error(404, 'User not found');
		}

		if (!user.stripeCustomerId) {
			return error(400, 'No Stripe customer found. Please subscribe to a plan first.');
		}

		const origin = url.origin;
		const returnUrl = `${origin}/settings/billing`;

		const portalSession = await StripeService.createPortalSession(
			user.stripeCustomerId,
			returnUrl
		);

		return json({
			url: portalSession.url,
		});

	} catch (err) {
		console.error('Error creating portal session:', err);
		return error(500, 'Failed to create portal session');
	}
};
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StripeService } from '$lib/server/stripe.js';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const session = await locals.auth();
		
		if (!session?.user?.id) {
			return error(401, 'Unauthorized');
		}

		// Get user data to check for Stripe customer ID
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, session.user.id));

		if (!user) {
			return error(404, 'User not found');
		}

		// Get payment method data if user has Stripe customer ID
		let paymentMethod = null;
		if (user.stripeCustomerId) {
			paymentMethod = await StripeService.getCustomerDefaultPaymentMethod(user.stripeCustomerId);
		}

		return json({
			success: true,
			data: {
				paymentMethod,
			}
		});

	} catch (err) {
		console.error('Error fetching payment method data:', err);
		return error(500, 'Failed to fetch payment method data');
	}
};
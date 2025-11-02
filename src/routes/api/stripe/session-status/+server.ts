import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripe } from '$lib/server/stripe.js';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const session = await locals.auth();
		
		if (!session?.user?.id) {
			return error(401, 'Unauthorized');
		}

		const sessionId = url.searchParams.get('session_id');

		if (!sessionId) {
			return error(400, 'Session ID is required');
		}

		// Retrieve the checkout session from Stripe
		const stripe = await getStripe();
		const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

		// Verify that this session belongs to the authenticated user
		const customerId = checkoutSession.customer as string;
		if (customerId) {
			const customer = await stripe.customers.retrieve(customerId);
			
			if (customer.deleted) {
				return error(404, 'Customer not found');
			}

			const sessionUserId = customer.metadata?.userId;
			if (sessionUserId !== session.user.id) {
				return error(403, 'Access denied');
			}
		}

		return json({
			status: checkoutSession.status,
			customer_email: checkoutSession.customer_details?.email,
			payment_status: checkoutSession.payment_status,
			subscription_id: checkoutSession.subscription,
			amount_total: checkoutSession.amount_total,
			currency: checkoutSession.currency,
		});

	} catch (err) {
		console.error('Error retrieving session status:', err);
		return error(500, 'Failed to retrieve session status');
	}
};
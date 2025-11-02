import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripe, StripeService } from '$lib/server/stripe.js';
import { getStripeWebhookSecret } from '$lib/server/settings-store.js';
import { env } from '$env/dynamic/private';
import type Stripe from 'stripe';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		return error(400, 'Missing stripe-signature header');
	}

	// Get webhook secret from database settings, fallback to environment variable
	const dbWebhookSecret = await getStripeWebhookSecret();
	const webhookSecret = dbWebhookSecret || env.STRIPE_WEBHOOK_SECRET;

	if (!webhookSecret) {
		console.error('Stripe webhook secret not configured in database settings or environment variables');
		return error(500, 'Webhook secret not configured');
	}

	let event: Stripe.Event;

	try {
		// Verify webhook signature
		const stripe = await getStripe();
		event = stripe.webhooks.constructEvent(
			body,
			signature,
			webhookSecret
		);
	} catch (err) {
		console.error('Webhook signature verification failed:', err);
		return error(400, 'Invalid signature');
	}

	console.log(`Received webhook: ${event.type}`);

	try {
		// Handle the event
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session;
				console.log('Checkout session completed:', session.id);
				
				// Handle setting payment method as default for the customer
				await StripeService.handleCheckoutSessionCompleted(session);
				
				// The subscription will be handled by the customer.subscription.created event
				// This event is mainly for one-time payments or initial setup
				break;
			}

			case 'customer.subscription.created': {
				const subscription = event.data.object as Stripe.Subscription;
				console.log('Subscription created:', subscription.id);
				await StripeService.handleSubscriptionCreated(subscription);
				break;
			}

			case 'customer.subscription.updated': {
				const subscription = event.data.object as Stripe.Subscription;
				console.log('Subscription updated:', subscription.id);
				await StripeService.handleSubscriptionUpdated(subscription);
				break;
			}

			case 'customer.subscription.deleted': {
				const subscription = event.data.object as Stripe.Subscription;
				console.log('Subscription deleted:', subscription.id);
				await StripeService.handleSubscriptionDeleted(subscription);
				break;
			}

			case 'invoice.payment_succeeded': {
				const invoice = event.data.object as Stripe.Invoice;
				console.log('Invoice payment succeeded:', invoice.id);
				await StripeService.handleInvoicePaymentSucceeded(invoice);
				break;
			}

			case 'invoice.payment_failed': {
				const invoice = event.data.object as Stripe.Invoice;
				console.log('Invoice payment failed:', invoice.id);
				await StripeService.handleInvoicePaymentFailed(invoice);
				break;
			}

			case 'customer.subscription.trial_will_end': {
				const subscription = event.data.object as Stripe.Subscription;
				console.log('Subscription trial will end:', subscription.id);
				// TODO: Send notification email to user about trial ending
				break;
			}

			case 'payment_method.attached': {
				const paymentMethod = event.data.object as Stripe.PaymentMethod;
				console.log('Payment method attached:', paymentMethod.id);
				// Payment method attached to customer - no action needed
				break;
			}

			default:
				console.log(`Unhandled event type: ${event.type}`);
		}

		return json({ received: true });

	} catch (err) {
		console.error(`Error handling webhook ${event.type}:`, err);
		return error(500, 'Webhook handler failed');
	}
};
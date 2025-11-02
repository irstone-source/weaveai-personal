import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { db } from './db/index.js';
import { users, subscriptions, pricingPlans, paymentHistory } from './db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getStripeSecretKey } from './settings-store.js';

// Cache for the Stripe instance to avoid creating it repeatedly
let stripeInstance: Stripe | null = null;
let lastSecretKey: string | null = null;

// Get Stripe instance with database settings
async function getStripeInstance(): Promise<Stripe> {
	try {
		// Get secret key from database settings first, fallback to environment variable
		const dbSecretKey = await getStripeSecretKey();
		const secretKey = dbSecretKey || env.STRIPE_SECRET_KEY;

		if (!secretKey) {
			throw new Error('Stripe secret key not configured in database settings or environment variables');
		}

		// Return cached instance if secret key hasn't changed
		if (stripeInstance && lastSecretKey === secretKey) {
			return stripeInstance;
		}

		// Create new Stripe instance
		stripeInstance = new Stripe(secretKey, {
			apiVersion: '2025-08-27.basil',
			typescript: true,
		});
		lastSecretKey = secretKey;

		console.log('Stripe instance initialized with', dbSecretKey ? 'database settings' : 'environment variable');
		return stripeInstance;
	} catch (error) {
		console.error('Failed to initialize Stripe instance:', error);
		// Fallback to environment variable if database fails
		if (env.STRIPE_SECRET_KEY) {
			console.log('Falling back to environment variable for Stripe');
			if (!stripeInstance || lastSecretKey !== env.STRIPE_SECRET_KEY) {
				stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
					apiVersion: '2025-08-27.basil',
					typescript: true,
				});
				lastSecretKey = env.STRIPE_SECRET_KEY;
			}
			return stripeInstance;
		}
		throw new Error('Stripe secret key not available in database settings or environment variables');
	}
}

// Export dynamic stripe getter - all methods should use this instead of the old static export
export async function getStripe(): Promise<Stripe> {
	return await getStripeInstance();
}

export interface CreateCustomerParams {
	email: string;
	name?: string;
	userId: string;
}

export interface CreateCheckoutSessionParams {
	userId: string;
	priceId: string;
	successUrl: string;
	cancelUrl: string;
}

export interface SubscriptionWithPlan {
	subscription: typeof subscriptions.$inferSelect;
	plan?: typeof pricingPlans.$inferSelect;
}

export interface PaymentMethodInfo {
	type: 'card' | 'paypal';
	// Card-specific fields
	brand?: string;
	last4?: string;
	expMonth?: number;
	expYear?: number;
	// PayPal-specific fields
	payerEmail?: string;
	payerName?: string;
}

export class StripeService {
	static async createCustomer({ email, name, userId }: CreateCustomerParams): Promise<Stripe.Customer> {
		try {
			const stripe = await getStripe();
			const customer = await stripe.customers.create({
				email,
				name,
				metadata: {
					userId,
				},
			});

			// Update user with Stripe customer ID
			await db
				.update(users)
				.set({ stripeCustomerId: customer.id })
				.where(eq(users.id, userId));

			return customer;
		} catch (error) {
			console.error('Error creating Stripe customer:', error);
			throw new Error('Failed to create customer');
		}
	}

	static async getOrCreateCustomer(userId: string): Promise<string> {
		try {
			// Get user from database
			const [user] = await db.select().from(users).where(eq(users.id, userId));
			
			if (!user) {
				throw new Error('User not found');
			}

			// Return existing customer ID if available
			if (user.stripeCustomerId) {
				return user.stripeCustomerId;
			}

			// Create new customer
			const customer = await this.createCustomer({
				email: user.email!,
				name: user.name || undefined,
				userId,
			});

			return customer.id;
		} catch (error) {
			console.error('Error getting or creating customer:', error);
			throw new Error('Failed to get or create customer');
		}
	}

	static async createCheckoutSession({
		userId,
		priceId,
		successUrl,
		cancelUrl,
	}: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
		try {
			const customerId = await this.getOrCreateCustomer(userId);
			const stripe = await getStripe();

			const session = await stripe.checkout.sessions.create({
				ui_mode: 'embedded',
				customer: customerId,
				line_items: [
					{
						price: priceId,
						quantity: 1,
					},
				],
				mode: 'subscription',
				return_url: successUrl,
				// automatic_tax: { enabled: true }, // Disabled for development - enable when business address is configured
				metadata: {
					userId,
				},
			});

			return session;
		} catch (error) {
			console.error('Error creating checkout session:', error);
			throw new Error('Failed to create checkout session');
		}
	}

	static async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
		try {
			const stripe = await getStripe();
			const session = await stripe.billingPortal.sessions.create({
				customer: customerId,
				return_url: returnUrl,
			});

			return session;
		} catch (error) {
			console.error('Error creating portal session:', error);
			throw new Error('Failed to create portal session');
		}
	}

	static async getActiveSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
		try {
			// First check if user has free plan - free users don't have Stripe subscriptions
			const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
			
			if (user?.planTier === 'free') {
				// For free users, return null - they don't have Stripe subscriptions
				return null;
			}

			// Get active subscription (including cancelled ones that are still active until period end)
			const [subscription] = await db
				.select()
				.from(subscriptions)
				.where(
					and(
						eq(subscriptions.userId, userId),
						eq(subscriptions.status, 'active') // Status is 'active' even for cancelled subscriptions until period ends
					)
				);

			if (!subscription) {
				return null;
			}

			// Get pricing plan details
			const [plan] = await db
				.select()
				.from(pricingPlans)
				.where(eq(pricingPlans.stripePriceId, subscription.stripePriceId));

			return {
				subscription,
				plan,
			};
		} catch (error) {
			console.error('Error getting active subscription:', error);
			return null;
		}
	}

	static async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
		try {
			console.log('Processing subscription created:', subscription.id);
			
			const customerId = subscription.customer as string;
			const stripe = await getStripe();
			const customer = await stripe.customers.retrieve(customerId);
			
			if (customer.deleted) {
				throw new Error('Customer was deleted');
			}

			const userId = customer.metadata?.userId;
			if (!userId) {
				throw new Error('User ID not found in customer metadata');
			}

			// Get plan details from Stripe price
			const priceId = subscription.items.data[0]?.price.id;
			if (!priceId) {
				throw new Error('Price ID not found in subscription');
			}

			const [plan] = await db
				.select()
				.from(pricingPlans)
				.where(eq(pricingPlans.stripePriceId, priceId));

			if (!plan) {
				throw new Error(`Pricing plan not found for price ID: ${priceId}`);
			}

			// Validate and convert timestamps safely
			const validateTimestamp = (timestamp: number | null | undefined, fieldName: string): Date => {
				// Handle undefined/null/invalid timestamps
				if (timestamp === undefined || timestamp === null || isNaN(Number(timestamp)) || Number(timestamp) <= 0) {
					console.warn(`Invalid timestamp for ${fieldName}:`, timestamp);
					// For subscription periods, use fallback logic from Stripe subscription object
					if (fieldName.includes('periodStart')) {
						// Use subscription start_date or current time
						return subscription.start_date ? new Date(subscription.start_date * 1000) : new Date();
					} else if (fieldName.includes('periodEnd')) {
						// Calculate end based on start + billing cycle, or fallback to 30 days
						const startTime = subscription.start_date ? subscription.start_date * 1000 : Date.now();
						return new Date(startTime + (30 * 24 * 60 * 60 * 1000)); // 30 days from start
					}
					return new Date(); // Other fields default to current time
				}
				return new Date(Number(timestamp) * 1000);
			};

			// Create subscription record with comprehensive validation
			const subscriptionData = {
				userId,
				stripeSubscriptionId: subscription.id,
				stripePriceId: priceId,
				planTier: plan.tier,
				status: subscription.status as any,
				currentPeriodStart: validateTimestamp((subscription as any).current_period_start, 'periodStart'),
				currentPeriodEnd: validateTimestamp((subscription as any).current_period_end, 'periodEnd'),
				cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
				canceledAt: subscription.canceled_at ? validateTimestamp(subscription.canceled_at, 'canceledAt') : null,
				endedAt: subscription.ended_at ? validateTimestamp(subscription.ended_at, 'endedAt') : null,
			};

			// Use upsert operation to handle race conditions
			console.log('Inserting/updating subscription with data:', subscriptionData);
			try {
				await db.insert(subscriptions).values(subscriptionData)
					.onConflictDoUpdate({
						target: subscriptions.stripeSubscriptionId,
						set: {
							status: subscriptionData.status,
							currentPeriodStart: subscriptionData.currentPeriodStart,
							currentPeriodEnd: subscriptionData.currentPeriodEnd,
							cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
							canceledAt: subscriptionData.canceledAt,
							endedAt: subscriptionData.endedAt,
							updatedAt: new Date(),
						}
					});
			} catch (error) {
				console.error('Failed to insert/update subscription:', error);
				throw error;
			}

			// Update user subscription status
			await db
				.update(users)
				.set({
					subscriptionStatus: subscription.status as any,
					planTier: plan.tier,
				})
				.where(eq(users.id, userId));

			console.log('Successfully processed subscription created for user:', userId);

		} catch (error) {
			console.error('Error handling subscription created:', error);
			console.error('Subscription data:', JSON.stringify(subscription, null, 2));
			// Don't throw - we want webhook to return 200
		}
	}

	static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
		try {
			console.log('Processing subscription updated:', subscription.id);

			// Validate and convert timestamps safely
			const validateTimestamp = (timestamp: number | null | undefined, fieldName: string): Date => {
				// Handle undefined/null/invalid timestamps
				if (timestamp === undefined || timestamp === null || isNaN(Number(timestamp)) || Number(timestamp) <= 0) {
					console.warn(`Invalid timestamp for ${fieldName}:`, timestamp);
					// For subscription periods, use fallback logic from Stripe subscription object
					if (fieldName.includes('periodStart')) {
						// Use subscription start_date or current time
						return subscription.start_date ? new Date(subscription.start_date * 1000) : new Date();
					} else if (fieldName.includes('periodEnd')) {
						// Calculate end based on start + billing cycle, or fallback to 30 days
						const startTime = subscription.start_date ? subscription.start_date * 1000 : Date.now();
						return new Date(startTime + (30 * 24 * 60 * 60 * 1000)); // 30 days from start
					}
					return new Date(); // Other fields default to current time
				}
				return new Date(Number(timestamp) * 1000);
			};

			// Update subscription record with comprehensive validation
			const updateData = {
				status: subscription.status as any,
				currentPeriodStart: validateTimestamp((subscription as any).current_period_start, 'periodStart'),
				currentPeriodEnd: validateTimestamp((subscription as any).current_period_end, 'periodEnd'),
				cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
				canceledAt: subscription.canceled_at ? validateTimestamp(subscription.canceled_at, 'canceledAt') : null,
				endedAt: subscription.ended_at ? validateTimestamp(subscription.ended_at, 'endedAt') : null,
				updatedAt: new Date(),
			};

			// Get customer info for user status update
			const customerId = subscription.customer as string;
			const stripe = await getStripe();
			const customer = await stripe.customers.retrieve(customerId);
			
			if (customer.deleted) {
				throw new Error('Customer was deleted');
			}

			const userId = customer.metadata?.userId;
			if (!userId) {
				throw new Error('User ID not found in customer metadata');
			}

			// Get plan details for tier update and change tracking
			const priceId = subscription.items.data[0]?.price.id;
			let planTier = null;
			let newPlanData = {};
			
			if (priceId) {
				const [plan] = await db
					.select()
					.from(pricingPlans)
					.where(eq(pricingPlans.stripePriceId, priceId));
				
				if (plan) {
					planTier = plan.tier;
					
					// Check if this is a plan change (different price ID than what's in DB)
					const [currentSub] = await db
						.select({ stripePriceId: subscriptions.stripePriceId, planTier: subscriptions.planTier })
						.from(subscriptions)
						.where(eq(subscriptions.stripeSubscriptionId, subscription.id));
					
					if (currentSub && currentSub.stripePriceId !== priceId) {
						// This is a plan change - track the previous plan tier
						newPlanData = {
							stripePriceId: priceId,
							planTier: plan.tier,
							previousPlanTier: currentSub.planTier,
							planChangedAt: new Date(),
						};
						console.log(`Plan change detected: ${currentSub.planTier} -> ${plan.tier}`);
					} else if (currentSub && currentSub.planTier !== plan.tier) {
						// Update plan tier if it changed but price ID is the same (shouldn't happen but just in case)
						newPlanData = {
							stripePriceId: priceId,
							planTier: plan.tier,
							planChangedAt: new Date(),
						};
					} else {
						// No plan change, just update price ID if needed
						newPlanData = {
							stripePriceId: priceId,
							planTier: plan.tier,
						};
					}
				}
			}

			// Try to update existing subscription first
			console.log('Updating subscription with data:', { ...updateData, ...newPlanData });
			const updateResult = await db
				.update(subscriptions)
				.set({ ...updateData, ...newPlanData })
				.where(eq(subscriptions.stripeSubscriptionId, subscription.id));

			if (updateResult.length === 0) {
				console.warn(`Subscription ${subscription.id} not found in database for update. Attempting to create it now.`);
				
				// Create the missing subscription record using already fetched plan data
				if (!priceId) {
					throw new Error('Price ID not found in subscription');
				}
				
				if (!planTier) {
					throw new Error(`Pricing plan not found for price ID: ${priceId}`);
				}

				// Create the missing subscription record
				await db.insert(subscriptions).values({
					userId,
					stripeSubscriptionId: subscription.id,
					stripePriceId: priceId,
					planTier: planTier,
					...updateData,
				});
				
				console.log('Created missing subscription record for:', subscription.id);
			}
			
			console.log('Subscription update/create completed for:', subscription.id);

			// Update user subscription status and plan tier
			await db
				.update(users)
				.set({
					subscriptionStatus: subscription.status as any,
					planTier: planTier,
				})
				.where(eq(users.id, userId));

			console.log('Successfully processed subscription updated for user:', userId);

		} catch (error) {
			console.error('Error handling subscription updated:', error);
			console.error('Subscription data:', JSON.stringify(subscription, null, 2));
			// Don't throw - we want webhook to return 200
		}
	}

	static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
		try {
			// Update subscription record
			await db
				.update(subscriptions)
				.set({
					status: 'canceled',
					endedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(subscriptions.stripeSubscriptionId, subscription.id));

			// Update user subscription status
			const customerId = subscription.customer as string;
			const stripe = await getStripe();
			const customer = await stripe.customers.retrieve(customerId);
			
			if (customer.deleted) {
				throw new Error('Customer was deleted');
			}

			const userId = customer.metadata?.userId;
			if (!userId) {
				throw new Error('User ID not found in customer metadata');
			}

			await db
				.update(users)
				.set({
					subscriptionStatus: 'canceled',
					planTier: null,
				})
				.where(eq(users.id, userId));

		} catch (error) {
			console.error('Error handling subscription deleted:', error);
			throw error;
		}
	}

	static async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
		try {
			console.log('Processing invoice payment succeeded:', invoice.id);
			
			const customerId = invoice.customer as string;
			const stripe = await getStripe();
			const customer = await stripe.customers.retrieve(customerId);
			
			if (customer.deleted) {
				throw new Error('Customer was deleted');
			}

			const userId = customer.metadata?.userId;
			if (!userId) {
				throw new Error('User ID not found in customer metadata');
			}

			// Get subscription record - handle cases where it might not exist yet
			let subscription = null;
			if ((invoice as any).subscription) {
				const subscriptionId = (invoice as any).subscription as string;
				console.log('Looking for subscription:', subscriptionId);
				
				const results = await db
					.select()
					.from(subscriptions)
					.where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
				
				subscription = results[0] || null;
				console.log('Found subscription:', subscription ? 'yes' : 'no');
			}

			// Get payment method details using comprehensive multi-approach detection
			const paymentMethodData = await this.getPaymentMethodFromInvoice(invoice);

			// Create payment history record with comprehensive validation
			const paymentData = {
				userId,
				stripeInvoiceId: invoice.id || null,
				subscriptionId: subscription?.id || null,
				amount: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : 0,
				currency: invoice.currency || 'usd',
				status: 'succeeded' as const,
				description: invoice.description || `Payment for ${invoice.lines?.data?.[0]?.description || 'subscription'}`,
				paymentMethodType: paymentMethodData.paymentMethodType,
				brand: paymentMethodData.brand,
				last4: paymentMethodData.last4,
				paidAt: invoice.status_transitions?.paid_at 
					? new Date(invoice.status_transitions.paid_at * 1000) 
					: new Date(),
			};

			console.log('Inserting payment history with data:', paymentData);
			await db.insert(paymentHistory).values(paymentData);

			console.log('Successfully processed invoice payment succeeded for user:', userId);

		} catch (error) {
			console.error('Error handling invoice payment succeeded:', error);
			console.error('Invoice data:', JSON.stringify(invoice, null, 2));
			// Don't throw - we want webhook to return 200
		}
	}

	static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
		try {
			const customerId = invoice.customer as string;
			const stripe = await getStripe();
			const customer = await stripe.customers.retrieve(customerId);
			
			if (customer.deleted) {
				throw new Error('Customer was deleted');
			}

			const userId = customer.metadata?.userId;
			if (!userId) {
				throw new Error('User ID not found in customer metadata');
			}

			// Get subscription record
			const subscriptionId = (invoice as any).subscription as string;
			const [subscription] = await db
				.select()
				.from(subscriptions)
				.where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

			// Get payment method details using comprehensive multi-approach detection
			const paymentMethodData = await this.getPaymentMethodFromInvoice(invoice);

			// Create payment history record with safe field handling
			await db.insert(paymentHistory).values({
				userId,
				stripeInvoiceId: invoice.id,
				subscriptionId: subscription?.id || null,
				amount: invoice.amount_due || 0,
				currency: invoice.currency || 'usd',
				status: 'failed',
				description: invoice.description || `Failed payment for ${invoice.lines.data[0]?.description || 'subscription'}`,
				paymentMethodType: paymentMethodData.paymentMethodType,
				brand: paymentMethodData.brand,
				last4: paymentMethodData.last4,
			});

		} catch (error) {
			console.error('Error handling invoice payment failed:', error);
			throw error;
		}
	}

	static async updateSubscriptionPlan(userId: string, newPriceId: string): Promise<{ subscription: Stripe.Subscription; wasUpdated: boolean }> {
		try {
			console.log('Updating subscription plan for user:', userId, 'to price:', newPriceId);

			// Get the user's current active subscription
			const activeSubscription = await this.getActiveSubscription(userId);
			if (!activeSubscription) {
				throw new Error('No active subscription found for user');
			}

			// Get the Stripe subscription details
			const stripe = await getStripe();
			const stripeSubscription = await stripe.subscriptions.retrieve(
				activeSubscription.subscription.stripeSubscriptionId
			);

			// Check if the subscription is already using the target price
			const currentPriceId = stripeSubscription.items.data[0]?.price.id;
			if (currentPriceId === newPriceId) {
				console.log('Subscription already using target price:', newPriceId);
				return { subscription: stripeSubscription, wasUpdated: false };
			}

			// Get the subscription item ID to update
			const subscriptionItemId = stripeSubscription.items.data[0]?.id;
			if (!subscriptionItemId) {
				throw new Error('No subscription item found');
			}

			// Update the subscription with the new price
			console.log('Updating subscription item:', subscriptionItemId, 'to price:', newPriceId);
			const updatedSubscription = await stripe.subscriptions.update(
				activeSubscription.subscription.stripeSubscriptionId,
				{
					items: [{
						id: subscriptionItemId,
						price: newPriceId,
					}],
					proration_behavior: 'always_invoice', // Create immediate invoice for proration
				}
			);

			console.log('Successfully updated subscription:', updatedSubscription.id);
			return { subscription: updatedSubscription, wasUpdated: true };

		} catch (error) {
			console.error('Error updating subscription plan:', error);
			throw new Error(`Failed to update subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	static async getSubscriptionItems(subscriptionId: string): Promise<Stripe.SubscriptionItem[]> {
		try {
			const stripe = await getStripe();
			const subscription = await stripe.subscriptions.retrieve(subscriptionId);
			return subscription.items.data;
		} catch (error) {
			console.error('Error getting subscription items:', error);
			throw new Error('Failed to get subscription items');
		}
	}

	static async cancelSubscriptionAtPeriodEnd(userId: string): Promise<Stripe.Subscription> {
		try {
			const activeSubscription = await this.getActiveSubscription(userId);
			if (!activeSubscription) {
				throw new Error('No active subscription found for user');
			}

			const stripe = await getStripe();
			const canceledSubscription = await stripe.subscriptions.update(
				activeSubscription.subscription.stripeSubscriptionId,
				{
					cancel_at_period_end: true,
				}
			);

			return canceledSubscription;
		} catch (error) {
			console.error('Error canceling subscription:', error);
			throw new Error('Failed to cancel subscription');
		}
	}

	static async setCustomerDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
		try {
			console.log(`Setting default payment method ${paymentMethodId} for customer ${customerId}`);

			// First, ensure the payment method is attached to the customer
			const stripe = await getStripe();
			const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
			
			if (paymentMethod.customer !== customerId) {
				// Attach the payment method to the customer if it isn't already
				await stripe.paymentMethods.attach(paymentMethodId, {
					customer: customerId,
				});
				console.log(`Attached payment method ${paymentMethodId} to customer ${customerId}`);
			}

			// Set this payment method as the customer's default
			await stripe.customers.update(customerId, {
				invoice_settings: {
					default_payment_method: paymentMethodId,
				},
			});

			console.log(`Successfully set payment method ${paymentMethodId} as default for customer ${customerId}`);

		} catch (error) {
			console.error('Error setting default payment method:', error);
			throw new Error(`Failed to set default payment method: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	static async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
		try {
			console.log('Processing checkout session completed:', session.id);

			// Only process subscription mode sessions
			if (session.mode !== 'subscription') {
				console.log('Skipping non-subscription checkout session');
				return;
			}

			const customerId = session.customer as string;
			if (!customerId) {
				console.warn('No customer ID found in checkout session');
				return;
			}

			// Get the payment method used in this checkout session
			// For subscription mode, the payment method is attached to the subscription
			if (session.subscription) {
				const stripe = await getStripe();
				const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
				const paymentMethodId = subscription.default_payment_method as string;

				if (paymentMethodId) {
					// Set this payment method as the customer's default
					await this.setCustomerDefaultPaymentMethod(customerId, paymentMethodId);
				} else {
					console.warn('No payment method found on subscription:', subscription.id);
				}
			} else {
				console.warn('No subscription found in checkout session');
			}

			console.log('Successfully processed checkout session completed');

		} catch (error) {
			console.error('Error handling checkout session completed:', error);
			// Don't throw - we want webhook to return 200
		}
	}

	static async getPaymentMethodFromCharge(chargeId: string): Promise<{
		paymentMethodType: string | null;
		brand: string | null;
		last4: string | null;
	}> {
		try {
			const stripe = await getStripe();
			const charge = await stripe.charges.retrieve(chargeId);
			const paymentMethodDetails = charge.payment_method_details;
			
			if (!paymentMethodDetails) {
				return { paymentMethodType: null, brand: null, last4: null };
			}

			switch (paymentMethodDetails.type) {
				case 'card': {
					const card = paymentMethodDetails.card;
					if (!card) {
						return { paymentMethodType: 'card', brand: null, last4: null };
					}
					return {
						paymentMethodType: 'card',
						brand: card.brand,
						last4: card.last4,
					};
				}
				
				case 'paypal': {
					return {
						paymentMethodType: 'paypal',
						brand: null,
						last4: null,
					};
				}
				
				default:
					return {
						paymentMethodType: paymentMethodDetails.type,
						brand: null,
						last4: null,
					};
			}

		} catch (error) {
			console.error('Error extracting payment method from charge:', error);
			return { paymentMethodType: null, brand: null, last4: null };
		}
	}

	static async getPaymentMethodFromCustomer(customerId: string): Promise<{
		paymentMethodType: string | null;
		brand: string | null;
		last4: string | null;
	}> {
		try {
			const paymentMethodInfo = await this.getCustomerDefaultPaymentMethod(customerId);
			
			if (!paymentMethodInfo) {
				return { paymentMethodType: null, brand: null, last4: null };
			}

			// Convert the PaymentMethodInfo format to our database format
			switch (paymentMethodInfo.type) {
				case 'card':
					return {
						paymentMethodType: 'card',
						brand: paymentMethodInfo.brand || null,
						last4: paymentMethodInfo.last4 || null,
					};
				case 'paypal':
					return {
						paymentMethodType: 'paypal',
						brand: null,
						last4: null,
					};
				default:
					return {
						paymentMethodType: paymentMethodInfo.type,
						brand: null,
						last4: null,
					};
			}

		} catch (error) {
			console.error('Error getting payment method from customer:', error);
			return { paymentMethodType: null, brand: null, last4: null };
		}
	}

	static async getPaymentMethodFromInvoice(invoice: Stripe.Invoice): Promise<{
		paymentMethodType: string | null;
		brand: string | null;
		last4: string | null;
	}> {
		console.log('Getting payment method for invoice:', invoice.id);
		
		// Primary approach: Customer's default payment method (proven to work)
		const customerId = invoice.customer;
		if (customerId) {
			try {
				const result = await this.getPaymentMethodFromCustomer(customerId as string);
				if (result.paymentMethodType) {
					console.log('✅ Payment method found via customer');
					return result;
				}
			} catch (error) {
				console.error('Customer payment method failed:', error);
			}
		}
		
		// Fallback: Charge payment method details (for edge cases)
		const chargeId = (invoice as any).charge;
		if (chargeId) {
			try {
				const result = await this.getPaymentMethodFromCharge(chargeId);
				if (result.paymentMethodType) {
					console.log('✅ Payment method found via charge');
					return result;
				}
			} catch (error) {
				console.error('Charge payment method failed:', error);
			}
		}

		console.log('❌ No payment method found');
		return { paymentMethodType: null, brand: null, last4: null };
	}

	static async getCustomerDefaultPaymentMethod(customerId: string): Promise<PaymentMethodInfo | null> {
		try {
			// Get customer's default payment method
			const stripe = await getStripe();
			const customer = await stripe.customers.retrieve(customerId);
			
			if (!customer || customer.deleted) {
				return null;
			}

			const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;
			let paymentMethod: Stripe.PaymentMethod | null = null;
			
			if (!defaultPaymentMethodId) {
				// If no default set, try to get the first available payment method
				// First try cards
				let paymentMethods = await stripe.paymentMethods.list({
					customer: customerId,
					type: 'card',
					limit: 1,
				});

				if (paymentMethods.data.length === 0) {
					// If no cards, try PayPal
					paymentMethods = await stripe.paymentMethods.list({
						customer: customerId,
						type: 'paypal',
						limit: 1,
					});
				}

				if (paymentMethods.data.length === 0) {
					return null;
				}

				paymentMethod = paymentMethods.data[0];
			} else {
				// Retrieve the default payment method
				paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethodId as string);
			}

			if (!paymentMethod) {
				return null;
			}

			// Handle different payment method types
			switch (paymentMethod.type) {
				case 'card': {
					const card = paymentMethod.card;
					if (!card) {
						return null;
					}
					return {
						type: 'card',
						brand: card.brand,
						last4: card.last4,
						expMonth: card.exp_month,
						expYear: card.exp_year,
					};
				}
				
				case 'paypal': {
					const paypal = paymentMethod.paypal;
					if (!paypal) {
						return null;
					}
					// PayPal payment method may have payer email in billing details or paypal object
					const payerEmail = paymentMethod.billing_details?.email || paypal.payer_email || null;
					const payerName = paymentMethod.billing_details?.name || null;
					
					return {
						type: 'paypal',
						payerEmail: payerEmail || undefined,
						payerName: payerName || undefined,
					};
				}
				
				default:
					console.log(`Unsupported payment method type: ${paymentMethod.type}`);
					return null;
			}

		} catch (error) {
			console.error('Error getting customer default payment method:', error);
			return null;
		}
	}
}
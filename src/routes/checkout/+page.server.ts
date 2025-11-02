import type { PageServerLoad } from './$types';
import { getStripePublishableKey } from '$lib/server/settings-store';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
  try {
    // Get stripe publishable key from database settings first, fallback to environment variable
    const dbPublishableKey = await getStripePublishableKey();
    const stripePublishableKey = dbPublishableKey || env.PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!stripePublishableKey) {
      console.warn('No Stripe publishable key configured in database settings or environment variables');
    }

    console.log('Checkout page loading with Stripe key from:', dbPublishableKey ? 'database settings' : 'environment variable');

    return {
      stripePublishableKey: stripePublishableKey || ''
    };
  } catch (error) {
    console.error('Failed to load payment settings for checkout:', error);
    
    // Fallback to environment variable
    return {
      stripePublishableKey: env.PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
    };
  }
};
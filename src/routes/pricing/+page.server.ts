import type { PageServerLoad } from './$types';
import { getPricingPlans } from '$lib/server/pricing-plans-seeder.js';
import { StripeService } from '$lib/server/stripe.js';
import { db, users } from '$lib/server/db/index.js';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	
	try {
		// Get all pricing plans
		const plans = await getPricingPlans();
		
		// Get current user's subscription and user data if logged in
		let currentSubscription = null;
		let userData = null;
		if (session?.user?.id) {
			currentSubscription = await StripeService.getActiveSubscription(session.user.id);
			// Get user data including planTier
			const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
			userData = user || null;
		}

		return {
			plans,
			currentSubscription,
			user: session?.user || null,
			userData, // Include full user data with planTier
		};
	} catch (error) {
		console.error('Error loading pricing data:', error);
		return {
			plans: [],
			currentSubscription: null,
			user: session?.user || null,
			userData: null,
		};
	}
};
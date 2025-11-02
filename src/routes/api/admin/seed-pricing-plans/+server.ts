import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { seedPricingPlans } from '$lib/server/pricing-plans-seeder.js';
import { dev } from '$app/environment';
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

export const POST: RequestHandler = async ({ locals }) => {
	// Only allow in development or if user is authenticated as admin
	if (!dev) {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return error(401, 'Unauthorized');
		}
		// In production, you'd want to check for admin role here
		// For now, any authenticated user can run this in development
	}

	// Check demo mode - block modifications
	if (isDemoModeEnabled()) {
		return json({
			error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED,
			type: 'demo_mode_restriction'
		}, { status: 403 });
	}

	try {
		await seedPricingPlans();
		
		return json({
			success: true,
			message: 'Pricing plans seeded successfully',
		});
	} catch (err) {
		console.error('Error seeding pricing plans:', err);
		return error(500, 'Failed to seed pricing plans');
	}
};
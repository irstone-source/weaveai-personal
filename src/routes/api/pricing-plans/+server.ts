import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPricingPlans } from '$lib/server/pricing-plans-seeder.js';

export const GET: RequestHandler = async () => {
	try {
		const plans = await getPricingPlans();
		
		return json(plans);
	} catch (err) {
		console.error('Error fetching pricing plans:', err);
		return json([]);
	}
};
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ fetch, locals }) => {
	// Check if user is authenticated
	const session = await locals.auth();
	if (!session?.user?.id) {
		return error(401, 'Unauthorized');
	}

	// Check if user is admin (critical security check)
	const [user] = await db
		.select({ isAdmin: users.isAdmin })
		.from(users)
		.where(eq(users.id, session.user.id));

	if (!user?.isAdmin) {
		return error(403, 'Forbidden - Admin access required');
	}

	try {
		// Fetch analytics data from our API endpoint
		const response = await fetch('/api/admin/analytics');
		
		if (!response.ok) {
			// Provide specific error messages based on status codes
			switch (response.status) {
				case 403:
					return error(403, 'Forbidden - Admin access required');
				case 429:
					return error(429, 'Too many requests - Please wait before refreshing');
				case 500:
					return error(500, 'Analytics service temporarily unavailable');
				default:
					return error(response.status, 'Failed to load analytics data');
			}
		}

		const analyticsResult = await response.json();

		// Validate response structure
		if (!analyticsResult || typeof analyticsResult !== 'object') {
			throw new Error('Invalid analytics response format');
		}

		return {
			analytics: analyticsResult,
		};
	} catch (err) {
		// Log error safely for debugging
		console.error('Analytics page load error:', {
			message: err instanceof Error ? err.message : 'Unknown error',
			timestamp: new Date().toISOString(),
			userId: session.user.id
		});
		
		return error(500, 'Analytics dashboard temporarily unavailable. Please try again later.');
	}
};
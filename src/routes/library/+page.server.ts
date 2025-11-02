import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals, fetch, url }) => {
	// Check authentication first
	const session = await locals.auth();
	if (!session?.user) {
		redirect(302, '/login');
	}

	try {
		// Fetch library data from our API endpoint
		const response = await fetch('/api/library' + url.search);
		
		if (!response.ok) {
			throw new Error('Failed to fetch library data');
		}

		const libraryData = await response.json();

		return {
			session,
			library: libraryData
		};
	} catch (error) {
		console.error('Library page load error:', error);
		return {
			session,
			library: {
				media: [],
				total: 0,
				images: 0,
				videos: 0,
				error: 'Failed to load library'
			}
		};
	}
};
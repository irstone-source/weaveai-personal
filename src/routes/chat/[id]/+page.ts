import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types.js';

export const load: PageLoad = async ({ params, fetch, parent }) => {
	try {
		// Get session data from parent layout
		const { session } = await parent();
		
		// Check if user is authenticated
		if (!session?.user?.id) {
			throw error(401, 'Unauthorized');
		}

		// Fetch the specific chat
		const response = await fetch(`/api/chats/${params.id}`);
		
		if (!response.ok) {
			if (response.status === 404) {
				throw error(404, 'Chat not found');
			} else if (response.status === 401) {
				throw error(401, 'Unauthorized');
			} else {
				throw error(500, 'Failed to load chat');
			}
		}

		const data = await response.json();
		
		return {
			chat: data.chat,
			chatId: params.id
		};
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		
		// Handle other errors
		console.error('Error loading chat:', err);
		throw error(500, 'Failed to load chat');
	}
};
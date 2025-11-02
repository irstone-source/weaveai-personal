import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { memorySystem } from '$lib/server/memory/pinecone-memory';

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const {
			query,
			top_k = 10,
			includePrivate = false,
			privateTags = [],
			categories = [],
			memoryTypes = [],
			minImportance
		} = await request.json();

		if (!query || typeof query !== 'string') {
			return json({ error: 'Query string is required' }, { status: 400 });
		}

		const results = await memorySystem.searchMemories(userId, query, {
			top_k,
			includePrivate,
			privateTags,
			categories,
			memoryTypes,
			minImportance
		});

		return json({
			success: true,
			query,
			results,
			count: results.length
		});
	} catch (error) {
		console.error('[Memory API] Error searching memories:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to search memories'
		}, { status: 500 });
	}
};

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
			content,
			chatId,
			privacyLevel = 'contextual',
			category,
			tags = [],
			importance,
			memoryType = 'working'
		} = await request.json();

		if (!content || typeof content !== 'string') {
			return json({ error: 'Content is required' }, { status: 400 });
		}

		const memoryId = await memorySystem.storeMemory(userId, content, {
			chatId,
			privacyLevel,
			category,
			tags,
			importance,
			memoryType
		});

		return json({
			success: true,
			memoryId,
			message: 'Memory stored successfully'
		});
	} catch (error) {
		console.error('[Memory API] Error storing memory:', error);

		// If Pinecone is not configured, return graceful error
		if (error instanceof Error && error.message.includes('not initialized')) {
			return json({
				success: false,
				error: 'Memory system not configured',
				message: 'Add PINECONE_API_KEY to .env to enable memory features'
			}, { status: 503 });
		}

		return json({
			error: error instanceof Error ? error.message : 'Failed to store memory'
		}, { status: 500 });
	}
};

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
		const { mode } = await request.json();

		if (mode !== 'persistent' && mode !== 'humanized') {
			return json({ error: 'Invalid mode. Must be "persistent" or "humanized"' }, { status: 400 });
		}

		await memorySystem.toggleMemoryMode(userId, mode);

		return json({
			success: true,
			mode,
			message: `Memory mode switched to ${mode}`
		});
	} catch (error) {
		console.error('[Memory API] Error toggling mode:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to toggle memory mode'
		}, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const stats = await memorySystem.getMemoryStats(userId);

		return json({
			stats
		});
	} catch (error) {
		console.error('[Memory API] Error getting stats:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to get memory stats'
		}, { status: 500 });
	}
};

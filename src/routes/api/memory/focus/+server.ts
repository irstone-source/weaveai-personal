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
		const { categories, boostFactor = 2.0, durationHours = 4 } = await request.json();

		if (!categories || !Array.isArray(categories) || categories.length === 0) {
			return json({ error: 'Categories array is required' }, { status: 400 });
		}

		const sessionId = await memorySystem.activateFocusMode(userId, {
			categories,
			boostFactor,
			durationHours
		});

		return json({
			success: true,
			sessionId,
			categories,
			boostFactor,
			durationHours,
			message: `Focus mode activated for: ${categories.join(', ')}`
		});
	} catch (error) {
		console.error('[Memory API] Error activating focus mode:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to activate focus mode'
		}, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		await memorySystem.deactivateFocusMode(userId);

		return json({
			success: true,
			message: 'Focus mode deactivated'
		});
	} catch (error) {
		console.error('[Memory API] Error deactivating focus mode:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to deactivate focus mode'
		}, { status: 500 });
	}
};

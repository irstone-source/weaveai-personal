import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { chats } from '$lib/server/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export const PATCH: RequestHandler = async ({ params, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get current chat to toggle pinned status
		const [currentChat] = await db
			.select({ pinned: chats.pinned })
			.from(chats)
			.where(and(eq(chats.id, params.id), eq(chats.userId, session.user.id)));

		if (!currentChat) {
			return json({ error: 'Chat not found' }, { status: 404 });
		}

		// Toggle the pinned status
		const [updatedChat] = await db
			.update(chats)
			.set({
				pinned: !currentChat.pinned,
				updatedAt: sql`NOW()`
			})
			.where(and(eq(chats.id, params.id), eq(chats.userId, session.user.id)))
			.returning();

		return json({ chat: updatedChat });
	} catch (error) {
		console.error('Toggle pin error:', error);
		return json({ error: 'Failed to toggle pin status' }, { status: 500 });
	}
};
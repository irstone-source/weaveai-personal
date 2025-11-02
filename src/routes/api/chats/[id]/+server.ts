import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { chats } from '$lib/server/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const [chat] = await db
			.select()
			.from(chats)
			.where(and(eq(chats.id, params.id), eq(chats.userId, session.user.id)));

		if (!chat) {
			return json({ error: 'Chat not found' }, { status: 404 });
		}

		return json({ chat });
	} catch (error) {
		console.error('Get chat error:', error);
		return json({ error: 'Failed to fetch chat' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { title, model, messages, pinned } = await request.json();

		const updateData: any = {
			updatedAt: sql`NOW()`
		};

		if (title !== undefined) updateData.title = title;
		if (model !== undefined) updateData.model = model;
		if (messages !== undefined) updateData.messages = messages;
		if (pinned !== undefined) updateData.pinned = pinned;

		const [updatedChat] = await db
			.update(chats)
			.set(updateData)
			.where(and(eq(chats.id, params.id), eq(chats.userId, session.user.id)))
			.returning();


		if (!updatedChat) {
			return json({ error: 'Chat not found' }, { status: 404 });
		}

		return json({ chat: updatedChat });
	} catch (error) {
		console.error('Update chat error:', error);
		return json({ error: 'Failed to update chat' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const [deletedChat] = await db
			.delete(chats)
			.where(and(eq(chats.id, params.id), eq(chats.userId, session.user.id)))
			.returning();

		if (!deletedChat) {
			return json({ error: 'Chat not found' }, { status: 404 });
		}

		return json({ message: 'Chat deleted successfully' });
	} catch (error) {
		console.error('Delete chat error:', error);
		return json({ error: 'Failed to delete chat' }, { status: 500 });
	}
};
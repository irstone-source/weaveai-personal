import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { chats } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userChats = await db
			.select({
				id: chats.id,
				title: chats.title,
				model: chats.model,
				pinned: chats.pinned,
				createdAt: chats.createdAt,
				updatedAt: chats.updatedAt
			})
			.from(chats)
			.where(eq(chats.userId, session.user.id))
			.orderBy(desc(chats.updatedAt));

		return json({ chats: userChats });
	} catch (error) {
		console.error('Get chats error:', error);
		return json({ error: 'Failed to fetch chats' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { title, model, messages } = await request.json();

		if (!title || !model || !messages) {
			return json({ error: 'Title, model, and messages are required' }, { status: 400 });
		}

		const [newChat] = await db
			.insert(chats)
			.values({
				userId: session.user.id,
				title,
				model,
				messages
			})
			.returning();

		return json({ chat: newChat });
	} catch (error) {
		console.error('Create chat error:', error);
		return json({ error: 'Failed to create chat' }, { status: 500 });
	}
};
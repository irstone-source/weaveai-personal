import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { images, videos, chats } from '$lib/server/db/schema.js';
import { eq, desc, or, isNull } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get query parameters for filtering
		const searchParams = url.searchParams;
		const type = searchParams.get('type'); // 'images', 'videos', or null for both

		// Fetch user's images with optional chat context
		let userImages: any[] = [];
		if (!type || type === 'images') {
			const rawImages = await db
				.select({
					id: images.id,
					filename: images.filename,
					mimeType: images.mimeType,
					fileSize: images.fileSize,
					createdAt: images.createdAt,
					chatId: images.chatId,
					chatTitle: chats.title,
					chatModel: chats.model,
				})
				.from(images)
				.leftJoin(chats, eq(images.chatId, chats.id))
				.where(eq(images.userId, session.user.id))
				.orderBy(desc(images.createdAt));
			
			userImages = rawImages.map(img => ({ ...img, type: 'image' as const }));
		}

		// Fetch user's videos with optional chat context
		let userVideos: any[] = [];
		if (!type || type === 'videos') {
			const rawVideos = await db
				.select({
					id: videos.id,
					filename: videos.filename,
					mimeType: videos.mimeType,
					fileSize: videos.fileSize,
					duration: videos.duration,
					resolution: videos.resolution,
					fps: videos.fps,
					hasAudio: videos.hasAudio,
					createdAt: videos.createdAt,
					chatId: videos.chatId,
					chatTitle: chats.title,
					chatModel: chats.model,
				})
				.from(videos)
				.leftJoin(chats, eq(videos.chatId, chats.id))
				.where(eq(videos.userId, session.user.id))
				.orderBy(desc(videos.createdAt));
			
			userVideos = rawVideos.map(vid => ({ ...vid, type: 'video' as const }));
		}

		// Combine and sort by creation date
		const allMedia = [...userImages, ...userVideos]
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		return json({ 
			media: allMedia,
			total: allMedia.length,
			images: userImages.length,
			videos: userVideos.length
		});
	} catch (error) {
		console.error('Get library error:', error);
		return json({ error: 'Failed to fetch library' }, { status: 500 });
	}
};
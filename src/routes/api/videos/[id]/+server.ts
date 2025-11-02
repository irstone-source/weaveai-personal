import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { videos } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { storageService } from '$lib/server/storage.js';

// Get video by ID (secure with authentication and authorization)
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const videoId = params.id;
		
		if (!videoId) {
			throw error(400, 'Video ID is required');
		}

		// Validate video ID format (UUID format for database IDs)
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(videoId)) {
			throw error(400, 'Invalid video ID format');
		}

		// Query database to get video metadata and verify ownership
		const [videoRecord] = await db
			.select()
			.from(videos)
			.where(eq(videos.id, videoId));

		if (!videoRecord) {
			throw error(404, 'Video not found');
		}

		// Check authorization - user can only access their own videos
		if (videoRecord.userId !== session.user.id) {
			throw error(403, 'Access denied - you can only access your own videos');
		}

		// Handle cloud storage files with presigned URLs
		if (videoRecord.storageLocation === 'r2' && videoRecord.cloudPath) {
			const presignedUrl = await storageService.getUrl(videoRecord.cloudPath);
			
			// Redirect to presigned URL for direct R2 access
			return new Response(null, {
				status: 302,
				headers: {
					'Location': presignedUrl,
					'Cache-Control': 'private, max-age=300' // 5 minutes cache for redirect
				}
			});
		}

		// Handle local files - use cloudPath stored in database
		if (!videoRecord.cloudPath) {
			throw error(404, 'Video file path not found');
		}
		
		const storagePath = videoRecord.cloudPath;
		
		try {
			const videoData = await storageService.download(storagePath);

			return new Response(new Uint8Array(videoData), {
				headers: {
					'Content-Type': videoRecord.mimeType,
					'Cache-Control': 'private, max-age=3600', // Private cache for 1 hour
					'Content-Length': videoData.length.toString(),
					'Accept-Ranges': 'bytes' // Enable range requests for video streaming
				}
			});
		} catch (storageError) {
			console.error('Storage retrieval error:', storageError);
			throw error(404, 'Video file not found in storage');
		}
	} catch (err) {
		console.error('Video retrieval error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to retrieve video');
	}
};
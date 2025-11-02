import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { images } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { storageService } from '$lib/server/storage.js';

// Get image by ID (secure with authentication and authorization)
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const imageId = params.id;
		
		if (!imageId) {
			throw error(400, 'Image ID is required');
		}

		// Validate image ID format (UUID format for database IDs)
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(imageId)) {
			throw error(400, 'Invalid image ID format');
		}

		// Query database to get image metadata and verify ownership
		const [imageRecord] = await db
			.select()
			.from(images)
			.where(eq(images.id, imageId));

		if (!imageRecord) {
			throw error(404, 'Image not found');
		}

		// Check authorization - user can only access their own images
		if (imageRecord.userId !== session.user.id) {
			throw error(403, 'Access denied - you can only access your own images');
		}

		// Handle cloud storage files with presigned URLs
		if (imageRecord.storageLocation === 'r2' && imageRecord.cloudPath) {
			const presignedUrl = await storageService.getUrl(imageRecord.cloudPath);
			
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
		if (!imageRecord.cloudPath) {
			throw error(404, 'Image file path not found');
		}
		
		const storagePath = imageRecord.cloudPath;
		
		try {
			const imageData = await storageService.download(storagePath);

			return new Response(new Uint8Array(imageData), {
				headers: {
					'Content-Type': imageRecord.mimeType,
					'Cache-Control': 'private, max-age=3600', // Private cache for 1 hour
					'Content-Length': imageData.length.toString()
				}
			});
		} catch (storageError) {
			console.error('Storage retrieval error:', storageError);
			throw error(404, 'Image file not found in storage');
		}
	} catch (err) {
		console.error('Image retrieval error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to retrieve image');
	}
};
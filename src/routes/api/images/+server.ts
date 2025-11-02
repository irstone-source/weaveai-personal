import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { images } from '$lib/server/db/schema.js';
import { storageService } from '$lib/server/storage.js';

// Upload/save image
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Unauthorized');
		}

		const { imageData, mimeType, filename, chatId } = await request.json();

		if (!imageData || !mimeType) {
			throw error(400, 'Image data and MIME type are required');
		}

		// Validate MIME type
		const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(mimeType)) {
			throw error(400, 'Unsupported image type');
		}

		// Convert base64 to buffer
		const imageBuffer = Buffer.from(imageData, 'base64');
		
		// Check file size (max 10MB)
		if (imageBuffer.length > 10 * 1024 * 1024) {
			throw error(400, 'Image too large (max 10MB)');
		}

		// Generate unique filename
		const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
		const generatedFilename = storageService.generateFilename(`file.${extension}`);
		
		// Upload to storage (R2 or local)
		const storageResult = await storageService.upload(
			{
				buffer: imageBuffer,
				mimeType,
				filename: generatedFilename
			},
			session.user.id,
			'images',
			'generated'
		);

		// Create database record with user association
		const [imageRecord] = await db
			.insert(images)
			.values({
				filename: generatedFilename,
				userId: session.user.id,
				chatId: chatId || null,
				mimeType,
				fileSize: imageBuffer.length,
				storageLocation: storageResult.storageLocation,
				cloudPath: storageResult.path
			})
			.returning();

		return json({ 
			imageId: imageRecord.id,
			mimeType: imageRecord.mimeType,
			size: imageRecord.fileSize
		});
	} catch (err) {
		console.error('Image upload error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to upload image');
	}
};
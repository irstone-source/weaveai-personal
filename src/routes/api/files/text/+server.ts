import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { db } from '$lib/server/db/index.js';
import { images } from '$lib/server/db/schema.js';

// Upload/save text file
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Unauthorized');
		}

		const { content, mimeType, filename, chatId } = await request.json();

		if (!content || !mimeType || !filename) {
			throw error(400, 'Content, MIME type, and filename are required');
		}

		// Validate MIME type for text files
		const allowedTypes = [
			'text/plain', 
			'text/markdown', 
			'text/csv', 
			'application/json',
			'text/html',
			'text/css',
			'text/javascript',
			'application/javascript'
		];
		if (!allowedTypes.includes(mimeType)) {
			throw error(400, 'Unsupported file type');
		}

		// Validate content size (max 1MB for text files)
		const contentBuffer = Buffer.from(content, 'utf-8');
		if (contentBuffer.length > 1024 * 1024) { // 1MB limit
			throw error(400, 'File too large (max 1MB for text files)');
		}

		// Generate unique filename for filesystem
		const extension = getFileExtension(mimeType, filename);
		const filename_fs = `${randomUUID()}.${extension}`;
		
		// Save text file to filesystem
		const filePath = join(process.cwd(), 'static', 'uploads', 'files', filename_fs);
		await writeFile(filePath, contentBuffer);

		// For now, we'll store text files in the images table with a special type
		// In a full implementation, you might create a separate files table
		const [fileRecord] = await db
			.insert(images)
			.values({
				filename: filename_fs,
				userId: session.user.id,
				chatId: chatId || null,
				mimeType,
				fileSize: contentBuffer.length
			})
			.returning();

		return json({ 
			fileId: fileRecord.id,
			mimeType: fileRecord.mimeType,
			size: fileRecord.fileSize,
			filename: filename
		});
	} catch (err) {
		console.error('Text file upload error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to upload text file');
	}
};

function getFileExtension(mimeType: string, originalFilename: string): string {
	// Try to get extension from original filename first
	const filenameExt = originalFilename.split('.').pop()?.toLowerCase();
	if (filenameExt) {
		return filenameExt;
	}

	// Fallback to MIME type mapping
	const mimeToExt: Record<string, string> = {
		'text/plain': 'txt',
		'text/markdown': 'md',
		'text/csv': 'csv',
		'application/json': 'json',
		'text/html': 'html',
		'text/css': 'css',
		'text/javascript': 'js',
		'application/javascript': 'js'
	};

	return mimeToExt[mimeType] || 'txt';
}
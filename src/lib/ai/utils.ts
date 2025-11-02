import { db } from '$lib/server/db/index.js';
import { images, videos } from '$lib/server/db/schema.js';
import { storageService } from '$lib/server/storage.js';

/**
 * Shared utility function to save image data to storage and create database record
 * Used across multiple AI providers to maintain consistency
 */
export async function saveImageAndGetId(
	imageData: string, 
	mimeType: string, 
	userId: string, 
	chatId?: string
): Promise<string> {
	// Generate unique filename
	const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1] || 'png';
	const filename = storageService.generateFilename(`file.${extension}`);

	// Convert base64 to buffer
	const imageBuffer = Buffer.from(imageData, 'base64');

	// Upload to storage (R2 or local)
	const storageResult = await storageService.upload(
		{
			buffer: imageBuffer,
			mimeType,
			filename
		},
		userId,
		'images',
		'generated'
	);

	// Create database record with user association
	const [imageRecord] = await db
		.insert(images)
		.values({
			filename,
			userId,
			chatId: chatId || null,
			mimeType,
			fileSize: imageBuffer.length,
			storageLocation: storageResult.storageLocation,
			cloudPath: storageResult.path
		})
		.returning();

	// Return database ID
	return imageRecord.id;
}

/**
 * Shared utility function to save video data to storage and create database record
 * Used across multiple AI providers to maintain consistency
 */
export async function saveVideoAndGetId(
	videoData: string,
	mimeType: string,
	userId: string,
	chatId?: string,
	duration = 8,
	resolution = '720p',
	fps = 24,
	hasAudio = false
): Promise<string> {
	// Generate unique filename
	const extension = mimeType.split('/')[1] || 'mp4';
	const filename = storageService.generateFilename(`file.${extension}`);

	// Convert base64 to buffer
	const videoBuffer = Buffer.from(videoData, 'base64');

	// Upload to storage (R2 or local)
	const storageResult = await storageService.upload(
		{
			buffer: videoBuffer,
			mimeType,
			filename
		},
		userId,
		'videos',
		'generated'
	);

	// Create database record with user association
	const [videoRecord] = await db
		.insert(videos)
		.values({
			filename,
			userId,
			chatId: chatId || null,
			mimeType,
			fileSize: videoBuffer.length,
			duration,
			resolution,
			fps,
			hasAudio,
			storageLocation: storageResult.storageLocation,
			cloudPath: storageResult.path
		})
		.returning();

	// Return database ID
	return videoRecord.id;
}

/**
 * Standardized error handling for AI providers
 * Provides consistent error messages and logging
 */
export function createProviderError(providerName: string, operation: string, originalError: unknown): Error {
	const message = originalError instanceof Error ? originalError.message : 'Unknown error';
	return new Error(`${providerName} ${operation} error: ${message}`);
}

/**
 * Improved token usage calculation
 * More sophisticated estimation than simple length division
 */
export function estimateTokenUsage(text: string): number {
	// More sophisticated token estimation
	// Account for punctuation, spaces, and common patterns
	const words = text.trim().split(/\s+/).length;
	const chars = text.length;
	
	// Average tokens per word varies by language and complexity
	// Conservative estimate: ~1.3 tokens per word, with minimum based on character count
	const wordBasedTokens = words * 1.3;
	const charBasedTokens = chars / 3.5; // ~3.5 characters per token on average
	
	// Use the higher estimate for better accuracy
	return Math.max(Math.ceil(wordBasedTokens), Math.ceil(charBasedTokens));
}

/**
 * Convert ArrayBuffer to base64 string
 * Utility function for handling binary data from API responses
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const uint8Array = new Uint8Array(buffer);
	const binaryString = Array.from(uint8Array)
		.map(byte => String.fromCharCode(byte))
		.join('');
	return btoa(binaryString);
}

/**
 * Standard response format parser for multiple providers
 * Handles common response patterns from AI generation APIs
 */
export function parseMediaResponse(responseData: any, mediaType: 'image' | 'video'): {
	data?: string;
	buffer?: ArrayBuffer;
} {
	let mediaData: string | undefined;
	let mediaBuffer: ArrayBuffer | undefined;

	// Try to extract media data from common response formats
	if (responseData.data && Array.isArray(responseData.data) && responseData.data[0]) {
		// OpenAI-style response format
		if (responseData.data[0].b64_json) {
			mediaData = responseData.data[0].b64_json;
		} else if (responseData.data[0].url) {
			// URL will need to be fetched separately
			throw new Error('URL_RESPONSE_FORMAT');
		}
	} else if (responseData[mediaType]) {
		// Direct media field
		if (typeof responseData[mediaType] === 'string') {
			mediaData = responseData[mediaType];
		}
	} else if (responseData[`${mediaType}s`] && Array.isArray(responseData[`${mediaType}s`]) && responseData[`${mediaType}s`][0]) {
		// Media array format
		mediaData = responseData[`${mediaType}s`][0];
	} else if (responseData.result && responseData.result[mediaType]) {
		// Nested result format
		mediaData = responseData.result[mediaType];
	}

	return { data: mediaData, buffer: mediaBuffer };
}
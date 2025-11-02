import type {
	AIProvider,
	AIModelConfig,
	AIResponse,
	AIStreamChunk,
	AIMessage,
	ImageGenerationParams,
	AIImageResponse,
	VideoGenerationParams,
	AIVideoResponse
} from '../types.js';
import { env } from '$env/dynamic/private';
import { saveImageAndGetId, saveVideoAndGetId, createProviderError, estimateTokenUsage, arrayBufferToBase64 } from '../utils.js';
import jwt from 'jsonwebtoken';
import { getKlingApiAccessKey, getKlingApiSecretKey } from '$lib/server/settings-store.js';

// Get API keys from database or fallback to environment variables
async function getApiKeys(): Promise<{ accessKey: string; secretKey: string }> {
	try {
		const [dbAccessKey, dbSecretKey] = await Promise.all([
			getKlingApiAccessKey(),
			getKlingApiSecretKey()
		]);
		
		return {
			accessKey: dbAccessKey || env.KLING_API_ACCESS_KEY || '',
			secretKey: dbSecretKey || env.KLING_API_SECRET_KEY || ''
		};
	} catch (error) {
		console.warn('Failed to get Kling API keys from database, using environment variables:', error);
		return {
			accessKey: env.KLING_API_ACCESS_KEY || '',
			secretKey: env.KLING_API_SECRET_KEY || ''
		};
	}
}

// Kling AI Models Configuration
const KLING_MODELS: AIModelConfig[] = [
	{
		name: 'kling-v2',
		displayName: 'Kling v2 Image',
		provider: 'KlingAI',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false
	},
	{
		name: 'kling-v2-master',
		displayName: 'Kling v2 Master Video',
		provider: 'KlingAI',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true
	},
	{
		name: 'kling-v2-1-master',
		displayName: 'Kling v2.1 Master Video',
		provider: 'KlingAI',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true
	}
];

// Kling AI API configuration
const KLING_API_BASE_URL = 'https://api-singapore.klingai.com';
const KLING_IMAGE_ENDPOINT = '/v1/images/generations';
const KLING_TEXT_TO_VIDEO_ENDPOINT = '/v1/videos/text2video';
const KLING_IMAGE_TO_VIDEO_ENDPOINT = '/v1/videos/image2video';

// Helper function to generate JWT token for Kling AI authentication
function generateKlingJWT(accessKey: string, secretKey: string): string {
	const currentTime = Math.floor(Date.now() / 1000);

	const payload = {
		iss: accessKey,                    // Access Key as issuer
		exp: currentTime + 1800,          // Expires in 30 minutes (1800 seconds)
		nbf: currentTime - 5              // Valid from 5 seconds ago
	};

	const header = {
		alg: 'HS256',
		typ: 'JWT'
	};

	return jwt.sign(payload, secretKey, { header });
}

// Helper function to save image to filesystem and database
async function saveImageToStorage(
	imageBuffer: ArrayBuffer,
	userId: string,
	chatId?: string
): Promise<string> {
	console.log('📥 Kling AI: Saving image buffer, size:', imageBuffer.byteLength);

	// Convert ArrayBuffer to base64 for storage service
	const imageBase64 = arrayBufferToBase64(imageBuffer);
	
	// Use the proper storage abstraction layer (supports both R2 and local storage)
	const imageId = await saveImageAndGetId(imageBase64, 'image/png', userId, chatId);

	console.log('✅ Kling AI: Image saved with ID:', imageId);
	return imageId;
}

// Helper function to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
	// Remove data URL prefix if present
	const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '');
	const binaryString = atob(base64Data);
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

// Helper function to save video to filesystem and database
async function saveVideoToStorage(
	videoBuffer: ArrayBuffer,
	userId: string,
	chatId?: string,
	duration?: number,
	resolution?: string,
	fps?: number
): Promise<string> {
	console.log('📥 Kling AI: Saving video buffer, size:', videoBuffer.byteLength);

	// Convert ArrayBuffer to base64 for storage service
	const videoBase64 = arrayBufferToBase64(videoBuffer);
	
	// Use the proper storage abstraction layer (supports both R2 and local storage)
	const videoId = await saveVideoAndGetId(
		videoBase64,
		'video/mp4',
		userId,
		chatId,
		duration || 5,
		resolution || '720p',
		fps || 24,
		false // Kling AI videos don't have audio
	);

	console.log('✅ Kling AI: Video saved with ID:', videoId);
	return videoId;
}

export const klingProvider: AIProvider = {
	name: 'Kling AI',
	models: KLING_MODELS,

	// Note: chat method not implemented for specialized generation models
	async chat(params: { model: string; messages: AIMessage[]; maxTokens?: number; temperature?: number; stream?: boolean; userId?: string; chatId?: string }): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>> {
		throw new Error('Chat not supported for Kling AI specialized generation models (image/video). Use appropriate generation endpoints.');
	},

	// Image generation
	async generateImage(params: ImageGenerationParams): Promise<AIImageResponse> {
		const { model, prompt, userId, chatId } = params;

		// Validate model capabilities
		const modelConfig = KLING_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in Kling AI provider`);
		}

		if (!modelConfig.supportsImageGeneration) {
			throw new Error(`Model ${model} does not support image generation`);
		}

		const apiKeys = await getApiKeys();
		if (!apiKeys.accessKey || !apiKeys.secretKey) {
			throw new Error('KLING_API_ACCESS_KEY and KLING_API_SECRET_KEY are not configured');
		}

		try {
			// Generate JWT token for authentication
			const jwtToken = generateKlingJWT(apiKeys.accessKey, apiKeys.secretKey);

			const requestBody = {
				model_name: model,
				prompt: prompt
			};

			const response = await fetch(`${KLING_API_BASE_URL}${KLING_IMAGE_ENDPOINT}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${jwtToken}`
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Kling AI API error: ${response.status} - ${errorText}`);
			}

			const responseData = await response.json();

			// Handle different possible response formats
			let imageData: string | undefined;
			let imageBuffer: ArrayBuffer | undefined;

			// Try to extract image data from common response formats
			if (responseData.data && Array.isArray(responseData.data) && responseData.data[0]) {
				// OpenAI-style response format
				if (responseData.data[0].b64_json) {
					imageData = responseData.data[0].b64_json;
				} else if (responseData.data[0].url) {
					// If URL is provided, fetch the image
					const imageResponse = await fetch(responseData.data[0].url);
					if (!imageResponse.ok) {
						throw new Error('Failed to fetch image from provided URL');
					}
					imageBuffer = await imageResponse.arrayBuffer();
				}
			} else if (responseData.image) {
				// Direct image field
				if (typeof responseData.image === 'string') {
					imageData = responseData.image;
				}
			} else if (responseData.images && Array.isArray(responseData.images) && responseData.images[0]) {
				// Images array format
				imageData = responseData.images[0];
			} else if (responseData.result && responseData.result.image) {
				// Nested result format
				imageData = responseData.result.image;
			}

			// Convert base64 to buffer if we have base64 data
			if (imageData && !imageBuffer) {
				imageBuffer = base64ToArrayBuffer(imageData);
			}

			if (!imageBuffer || imageBuffer.byteLength === 0) {
				throw new Error('No image data received from Kling AI');
			}

			// Save image to storage
			const imageId = await saveImageToStorage(imageBuffer, userId!, chatId);

			return {
				imageId,
				mimeType: 'image/png',
				prompt,
				model,
				usage: {
					promptTokens: prompt.length / 4, // Rough estimate
					totalTokens: prompt.length / 4
				}
			};
		} catch (error) {
			throw new Error(`Kling AI image generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Video generation
	async generateVideo(params: VideoGenerationParams): Promise<AIVideoResponse> {
		const { model, prompt, userId, chatId } = params;

		// Validate model capabilities
		const modelConfig = KLING_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in Kling AI provider`);
		}

		if (!modelConfig.supportsVideoGeneration) {
			throw new Error(`Model ${model} does not support video generation`);
		}

		const apiKeys = await getApiKeys();
		if (!apiKeys.accessKey || !apiKeys.secretKey) {
			throw new Error('KLING_API_ACCESS_KEY and KLING_API_SECRET_KEY are not configured');
		}

		try {
			// Generate JWT token for authentication
			const jwtToken = generateKlingJWT(apiKeys.accessKey, apiKeys.secretKey);

			// For now, use text-to-video endpoint (image-to-video will be handled separately)
			const requestBody = {
				model_name: model,
				prompt: prompt
			};

			const response = await fetch(`${KLING_API_BASE_URL}${KLING_TEXT_TO_VIDEO_ENDPOINT}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${jwtToken}`
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Kling AI API error: ${response.status} - ${errorText}`);
			}

			const responseData = await response.json();

			// Handle different possible response formats for video
			let videoData: string | undefined;
			let videoBuffer: ArrayBuffer | undefined;

			// Try to extract video data from common response formats
			if (responseData.data && Array.isArray(responseData.data) && responseData.data[0]) {
				// OpenAI-style response format
				if (responseData.data[0].b64_json) {
					videoData = responseData.data[0].b64_json;
				} else if (responseData.data[0].url) {
					// If URL is provided, fetch the video
					const videoResponse = await fetch(responseData.data[0].url);
					if (!videoResponse.ok) {
						throw new Error('Failed to fetch video from provided URL');
					}
					videoBuffer = await videoResponse.arrayBuffer();
				}
			} else if (responseData.video) {
				// Direct video field
				if (typeof responseData.video === 'string') {
					videoData = responseData.video;
				}
			} else if (responseData.videos && Array.isArray(responseData.videos) && responseData.videos[0]) {
				// Videos array format
				videoData = responseData.videos[0];
			} else if (responseData.result && responseData.result.video) {
				// Nested result format
				videoData = responseData.result.video;
			}

			// Convert base64 to buffer if we have base64 data
			if (videoData && !videoBuffer) {
				// For video, we need to handle different base64 formats
				const base64Data = videoData.replace(/^data:video\/[a-z0-9]+;base64,/, '');
				const binaryString = atob(base64Data);
				const len = binaryString.length;
				const bytes = new Uint8Array(len);
				for (let i = 0; i < len; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}
				videoBuffer = bytes.buffer;
			}

			if (!videoBuffer || videoBuffer.byteLength === 0) {
				throw new Error('No video data received from Kling AI');
			}

			// Extract metadata if available
			const duration = responseData.duration || params.duration || 5;
			const resolution = responseData.resolution || params.resolution || '720p';
			const fps = responseData.fps || params.fps || 24;

			// Save video to storage
			const videoId = await saveVideoToStorage(videoBuffer, userId!, chatId, duration, resolution, fps);

			return {
				videoId,
				mimeType: 'video/mp4',
				prompt,
				model,
				duration,
				resolution,
				fps,
				hasAudio: false,
				usage: {
					promptTokens: prompt.length / 4, // Rough estimate
					totalTokens: prompt.length / 4
				}
			};
		} catch (error) {
			throw new Error(`Kling AI video generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
};
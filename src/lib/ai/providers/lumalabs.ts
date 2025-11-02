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
import { saveImageAndGetId, saveVideoAndGetId, createProviderError, estimateTokenUsage, arrayBufferToBase64, parseMediaResponse } from '../utils.js';
import { getLumaLabsApiKey } from '$lib/server/settings-store.js';

// Get API key from database or fallback to environment variable
async function getApiKey(): Promise<string> {
	try {
		const dbKey = await getLumaLabsApiKey();
		return dbKey || env.LUMALABS_API_KEY || '';
	} catch (error) {
		console.warn('Failed to get Luma Labs API key from database, using environment variable:', error);
		return env.LUMALABS_API_KEY || '';
	}
}

// Luma Labs AI Models Configuration
const LUMALABS_MODELS: AIModelConfig[] = [
	{
		name: 'photon-1',
		displayName: 'Photon-1',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true
	},
	{
		name: 'photon-flash-1',
		displayName: 'Photon Flash-1',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true
	},
	{
		name: 'ray-2',
		displayName: 'Ray-2',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsVideoGeneration: true
	},
	{
		name: 'ray-flash-2',
		displayName: 'Ray Flash-2',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsVideoGeneration: true
	}
];

// Luma Labs API configuration
const LUMALABS_API_BASE_URL = 'https://api.lumalabs.ai/dream-machine/v1/generations';
const LUMALABS_IMAGE_ENDPOINT = '/image';
const LUMALABS_VIDEO_ENDPOINT = '/video';


export const lumalabsProvider: AIProvider = {
	name: 'Luma Labs',
	models: LUMALABS_MODELS,

	// Chat method - not implemented for specialized generation models
	async chat(params: { model: string; messages: AIMessage[]; maxTokens?: number; temperature?: number; stream?: boolean; userId?: string; chatId?: string }): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>> {
		throw new Error('Chat not supported for Luma Labs specialized generation models (image/video). Use appropriate generation endpoints.');
	},

	// Image generation method
	async generateImage(params: ImageGenerationParams): Promise<AIImageResponse> {
		const { model, prompt, userId, chatId, imageUrl } = params;

		// Validate model capabilities
		const modelConfig = LUMALABS_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in Luma Labs provider`);
		}

		if (!modelConfig.supportsImageGeneration) {
			throw new Error(`Model ${model} does not support image generation`);
		}

		const apiKey = await getApiKey();
		if (!apiKey) {
			throw new Error('LUMALABS_API_KEY environment variable is not configured');
		}

		if (!userId) {
			throw new Error('User ID is required for saving images');
		}

		try {
			const requestBody: any = {
				generation_type: 'image',
				model: model,
				prompt: prompt,
				format: 'png'
			};

			// Add image input support for Photon models (image-to-image generation)
			if (imageUrl && modelConfig.supportsImageInput) {
				requestBody.image_ref = imageUrl;
			}

			const response = await fetch(`${LUMALABS_API_BASE_URL}${LUMALABS_IMAGE_ENDPOINT}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Luma Labs API error: ${response.status} - ${errorText}`);
			}

			const responseData = await response.json();

			// Parse response using shared utility
			try {
				const { data: imageData, buffer: imageBuffer } = parseMediaResponse(responseData, 'image');

				let finalImageData = imageData;

				// Handle URL response format
				if (!finalImageData && !imageBuffer) {
					// Check if we got a URL response that needs fetching
					if (responseData.data?.[0]?.url) {
						const imageResponse = await fetch(responseData.data[0].url);
						if (!imageResponse.ok) {
							throw new Error('Failed to fetch image from provided URL');
						}
						const fetchedBuffer = await imageResponse.arrayBuffer();
						finalImageData = arrayBufferToBase64(fetchedBuffer);
					}
				}

				// Convert ArrayBuffer to base64 if we have buffer data
				if (imageBuffer && !finalImageData) {
					finalImageData = arrayBufferToBase64(imageBuffer);
				}

				if (!finalImageData || finalImageData.length === 0) {
					throw new Error('No image data received from Luma Labs API');
				}

				// Save image and get database ID
				const imageId = await saveImageAndGetId(finalImageData, 'image/png', userId, chatId);

				const promptTokens = estimateTokenUsage(prompt);
				return {
					imageId,
					mimeType: 'image/png',
					prompt,
					model,
					usage: {
						promptTokens,
						imageTokens: 1,
						totalTokens: promptTokens + 1
					}
				};
			} catch (parseError) {
				if (parseError instanceof Error && parseError.message === 'URL_RESPONSE_FORMAT') {
					// Handle URL response format
					if (responseData.data?.[0]?.url) {
						const imageResponse = await fetch(responseData.data[0].url);
						if (!imageResponse.ok) {
							throw new Error('Failed to fetch image from provided URL');
						}
						const imageBuffer = await imageResponse.arrayBuffer();
						const imageData = arrayBufferToBase64(imageBuffer);

						const imageId = await saveImageAndGetId(imageData, 'image/png', userId, chatId);
						const promptTokens = estimateTokenUsage(prompt);

						return {
							imageId,
							mimeType: 'image/png',
							prompt,
							model,
							usage: {
								promptTokens,
								imageTokens: 1,
								totalTokens: promptTokens + 1
							}
						};
					}
				}
				throw parseError;
			}

		} catch (error) {
			throw createProviderError('Luma Labs', 'image generation', error);
		}
	},

	// Video generation method
	async generateVideo(params: VideoGenerationParams): Promise<AIVideoResponse> {
		const { model, prompt, userId, chatId, duration = 8, resolution = '720p', fps = 24 } = params;

		// Validate model capabilities
		const modelConfig = LUMALABS_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in Luma Labs provider`);
		}

		if (!modelConfig.supportsVideoGeneration) {
			throw new Error(`Model ${model} does not support video generation`);
		}

		const apiKey = await getApiKey();
		if (!apiKey) {
			throw new Error('LUMALABS_API_KEY environment variable is not configured');
		}

		if (!userId) {
			throw new Error('User ID is required for saving videos');
		}

		try {
			const requestBody = {
				generation_type: 'video',
				model: model,
				prompt: prompt
			};

			const response = await fetch(`${LUMALABS_API_BASE_URL}${LUMALABS_VIDEO_ENDPOINT}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Luma Labs API error: ${response.status} - ${errorText}`);
			}

			const responseData = await response.json();

			// Parse response using shared utility
			try {
				const { data: videoData, buffer: videoBuffer } = parseMediaResponse(responseData, 'video');

				let finalVideoData = videoData;

				// Handle URL response format
				if (!finalVideoData && !videoBuffer) {
					// Check if we got a URL response that needs fetching
					if (responseData.data?.[0]?.url) {
						const videoResponse = await fetch(responseData.data[0].url);
						if (!videoResponse.ok) {
							throw new Error('Failed to fetch video from provided URL');
						}
						const fetchedBuffer = await videoResponse.arrayBuffer();
						finalVideoData = arrayBufferToBase64(fetchedBuffer);
					}
				}

				// Convert ArrayBuffer to base64 if we have buffer data
				if (videoBuffer && !finalVideoData) {
					finalVideoData = arrayBufferToBase64(videoBuffer);
				}

				if (!finalVideoData || finalVideoData.length === 0) {
					throw new Error('No video data received from Luma Labs API');
				}

				// Save video and get database ID
				const videoId = await saveVideoAndGetId(finalVideoData, 'video/mp4', userId, chatId, duration, resolution, fps, false);

				const promptTokens = estimateTokenUsage(prompt);
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
						promptTokens,
						videoTokens: 1,
						totalTokens: promptTokens + 1
					}
				};
			} catch (parseError) {
				if (parseError instanceof Error && parseError.message === 'URL_RESPONSE_FORMAT') {
					// Handle URL response format
					if (responseData.data?.[0]?.url) {
						const videoResponse = await fetch(responseData.data[0].url);
						if (!videoResponse.ok) {
							throw new Error('Failed to fetch video from provided URL');
						}
						const videoBuffer = await videoResponse.arrayBuffer();
						const videoData = arrayBufferToBase64(videoBuffer);

						const videoId = await saveVideoAndGetId(videoData, 'video/mp4', userId, chatId, duration, resolution, fps, false);
						const promptTokens = estimateTokenUsage(prompt);

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
								promptTokens,
								videoTokens: 1,
								totalTokens: promptTokens + 1
							}
						};
					}
				}
				throw parseError;
			}

		} catch (error) {
			throw createProviderError('Luma Labs', 'video generation', error);
		}
	}
};
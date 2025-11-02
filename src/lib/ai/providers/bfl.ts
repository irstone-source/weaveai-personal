import type {
	AIProvider,
	AIModelConfig,
	AIResponse,
	AIStreamChunk,
	AIMessage,
	ImageGenerationParams,
	AIImageResponse
} from '../types.js';
import { env } from '$env/dynamic/private';
import { saveImageAndGetId, arrayBufferToBase64 } from '../utils.js';
import { getBFLApiKey } from '$lib/server/settings-store.js';

// Get API key from database or fallback to environment variable
async function getApiKey(): Promise<string> {
	try {
		const dbKey = await getBFLApiKey();
		return dbKey || env.BFL_API_KEY || '';
	} catch (error) {
		console.warn('Failed to get BFL API key from database, using environment variable:', error);
		return env.BFL_API_KEY || '';
	}
}

// BFL API Response Types
interface BFLTaskResponse {
	status: 'Ready' | 'Pending' | 'Error';
	result?: {
		sample: string; // Signed URL for the generated image
	};
	error?: string;
}

// Constants
const POLLING_MAX_ATTEMPTS = 60;
const POLLING_DELAY_MS = 2000;

// Black Forest Labs FLUX Models Configuration
const BFL_IMAGE_MODELS: AIModelConfig[] = [
	{
		name: 'flux-kontext-pro',
		displayName: 'FLUX.1 Kontext Pro',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageEditing: false, // Will be implemented later
		supportsImageStreaming: false
	},
	{
		name: 'flux-kontext-max',
		displayName: 'FLUX.1 Kontext Max',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageEditing: false, // Will be implemented later
		supportsImageStreaming: false
	},
	{
		name: 'flux-pro-1.1',
		displayName: 'FLUX.1.1 Pro',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageEditing: false,
		supportsImageStreaming: false
	},
	{
		name: 'flux-pro-1.1-ultra',
		displayName: 'FLUX.1.1 Ultra',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageEditing: false,
		supportsImageStreaming: false
	}
];

// Helper function to get API endpoint based on model
function getEndpointForModel(model: string): string {
	const baseUrl = 'https://api.bfl.ai/v1';

	switch (model) {
		case 'flux-kontext-pro':
			return `${baseUrl}/flux-kontext-pro`;
		case 'flux-kontext-max':
			return `${baseUrl}/flux-kontext-max`;
		case 'flux-pro-1.1':
			return `${baseUrl}/flux-pro-1.1`;
		case 'flux-pro-1.1-ultra':
			return `${baseUrl}/flux-pro-1.1-ultra`;
		default:
			throw new Error(`Unknown Black Forest Labs model: ${model}`);
	}
}

// Helper function to poll for completion
async function pollForCompletion(pollingUrl: string, apiKey: string, maxAttempts = POLLING_MAX_ATTEMPTS): Promise<BFLTaskResponse> {
	let attempts = 0;

	while (attempts < maxAttempts) {
		try {
			const response = await fetch(pollingUrl, {
				headers: {
					'x-key': apiKey
				}
			});

			if (!response.ok) {
				throw new Error(`Polling failed: ${response.status} - ${await response.text()}`);
			}

			const data = await response.json();

			// Check if the task is completed
			if (data.status === 'Ready' && data.result) {
				return data;
			}

			// If still processing, wait and retry
			if (data.status === 'Pending') {
				attempts++;
				await new Promise(resolve => setTimeout(resolve, POLLING_DELAY_MS));
				continue;
			}

			// If failed or unknown status
			if (data.status === 'Error') {
				throw new Error(`BFL API task failed: ${data.error || 'Unknown error'}`);
			}

			// Unknown status, continue polling
			attempts++;
			await new Promise(resolve => setTimeout(resolve, POLLING_DELAY_MS));

		} catch (error) {
			if (attempts >= maxAttempts - 1) {
				throw error;
			}
			attempts++;
			await new Promise(resolve => setTimeout(resolve, POLLING_DELAY_MS));
		}
	}

	throw new Error('Polling timeout: Image generation took too long');
}

// Helper function to download and save image from URL
async function downloadAndSaveImage(
	imageUrl: string,
	userId: string,
	chatId?: string
): Promise<string> {
	console.log('📥 BFL: Downloading image from URL:', imageUrl);
	
	// Download image from signed URL
	const response = await fetch(imageUrl);
	if (!response.ok) {
		throw new Error(`Failed to download image: ${response.status}`);
	}

	const imageBuffer = await response.arrayBuffer();
	if (!imageBuffer || imageBuffer.byteLength === 0) {
		throw new Error('No image data received from download');
	}

	console.log('✅ BFL: Image downloaded successfully, size:', imageBuffer.byteLength);

	// Convert ArrayBuffer to base64 for storage service
	const imageBase64 = arrayBufferToBase64(imageBuffer);
	
	// Use the proper storage abstraction layer (supports both R2 and local storage)
	const imageId = await saveImageAndGetId(imageBase64, 'image/png', userId, chatId);

	console.log('✅ BFL: Image saved with ID:', imageId);
	return imageId;
}

export const bflProvider: AIProvider = {
	name: 'Black Forest Labs',
	models: BFL_IMAGE_MODELS,

	// Note: chat method not implemented for image-only models
	async chat(params: { model: string; messages: AIMessage[]; maxTokens?: number; temperature?: number; stream?: boolean; userId?: string; chatId?: string }): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>> {
		throw new Error('Chat not supported for Black Forest Labs image generation models');
	},

	// Image generation with polling mechanism
	async generateImage(params: ImageGenerationParams): Promise<AIImageResponse> {
		const { model, prompt, userId, chatId } = params;

		// Validate model capabilities
		const modelConfig = BFL_IMAGE_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in Black Forest Labs provider`);
		}

		if (!modelConfig.supportsImageGeneration) {
			throw new Error(`Model ${model} does not support image generation`);
		}

		const apiKey = await getApiKey();
		if (!apiKey) {
			throw new Error('BFL_API_KEY is not configured');
		}

		try {
			const endpoint = getEndpointForModel(model);

			// Create the initial request
			const requestBody = {
				prompt: prompt
			};

			// Submit initial request
			const initialResponse = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'x-key': apiKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!initialResponse.ok) {
				const errorText = await initialResponse.text();
				throw new Error(`BFL API error: ${initialResponse.status} - ${errorText}`);
			}

			const initialData = await initialResponse.json();

			// Check if we have a polling URL
			if (!initialData.polling_url) {
				throw new Error('No polling URL received from BFL API');
			}

			// Poll for completion
			const completionData = await pollForCompletion(initialData.polling_url, apiKey);

			// Extract the image URL from the result
			if (!completionData.result || !completionData.result.sample) {
				throw new Error('No image URL received from BFL API result');
			}

			const imageUrl = completionData.result.sample;

			// Validate userId is provided
			if (!userId) {
				throw new Error('userId is required for image generation');
			}

			// Download and save the image
			const imageId = await downloadAndSaveImage(imageUrl, userId, chatId);

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
			throw new Error(`Black Forest Labs image generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
};
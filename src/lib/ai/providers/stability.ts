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
import { getStabilityAIApiKey } from '$lib/server/settings-store.js';

// Get API key from database or fallback to environment variable
async function getApiKey(): Promise<string> {
	try {
		const dbKey = await getStabilityAIApiKey();
		return dbKey || env.STABILITYAI_API_KEY || '';
	} catch (error) {
		console.warn('Failed to get Stability AI API key from database, using environment variable:', error);
		return env.STABILITYAI_API_KEY || '';
	}
}

// Stability AI Image Generation Models Configuration
const STABILITY_IMAGE_MODELS: AIModelConfig[] = [
	{
		name: 'stable-image-ultra',
		displayName: 'Stable Image Ultra',
		provider: 'StabilityAI',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false
	},
	{
		name: 'stable-image-core',
		displayName: 'Stable Image Core',
		provider: 'StabilityAI',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false
	},
	{
		name: 'stable-diffusion-3.5-large',
		displayName: 'Stable Diffusion 3.5 Large',
		provider: 'StabilityAI',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false
	},
	{
		name: 'stable-diffusion-3.5-large-turbo',
		displayName: 'Stable Diffusion 3.5 Large Turbo',
		provider: 'StabilityAI',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false
	},
	{
		name: 'stable-diffusion-3.5-medium',
		displayName: 'Stable Diffusion 3.5 Medium',
		provider: 'StabilityAI',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false
	},
	{
		name: 'stable-diffusion-3.5-flash',
		displayName: 'Stable Diffusion 3.5 Flash',
		provider: 'StabilityAI',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false
	}
];

// Helper function to get API endpoint based on model
function getEndpointForModel(model: string): string {
	if (model === 'stable-image-ultra') {
		return 'https://api.stability.ai/v2beta/stable-image/generate/ultra';
	} else if (model === 'stable-image-core') {
		return 'https://api.stability.ai/v2beta/stable-image/generate/core';
	} else if (model.startsWith('stable-diffusion-3.5')) {
		return 'https://api.stability.ai/v2beta/stable-image/generate/sd3';
	}
	throw new Error(`Unknown Stability AI model: ${model}`);
}

// Helper function to get model parameter for SD3.5 variants
function getModelParameter(model: string): string | undefined {
	switch (model) {
		case 'stable-diffusion-3.5-large':
			return 'sd3.5-large';
		case 'stable-diffusion-3.5-large-turbo':
			return 'sd3.5-large-turbo';
		case 'stable-diffusion-3.5-medium':
			return 'sd3.5-medium';
		case 'stable-diffusion-3.5-flash':
			return 'sd3.5-flash';
		default:
			return undefined;
	}
}

// Helper function to map size to aspect_ratio
function getAspectRatio(size?: string): string {
	switch (size) {
		case '1024x1024':
			return '1:1';
		case '1024x1536':
		case '1024x1792':
			return '2:3';
		case '1536x1024':
		case '1792x1024':
			return '3:2';
		case '1536x896':
			return '16:9';
		case '896x1536':
			return '9:16';
		default:
			return '1:1'; // Default to square
	}
}

// Helper function to save image to filesystem and database
async function saveImageToStorage(
	imageBuffer: ArrayBuffer,
	userId: string,
	chatId?: string
): Promise<string> {
	console.log('📥 Stability AI: Saving image buffer, size:', imageBuffer.byteLength);

	// Convert ArrayBuffer to base64 for storage service
	const imageBase64 = arrayBufferToBase64(imageBuffer);
	
	// Use the proper storage abstraction layer (supports both R2 and local storage)
	const imageId = await saveImageAndGetId(imageBase64, 'image/png', userId, chatId);

	console.log('✅ Stability AI: Image saved with ID:', imageId);
	return imageId;
}

export const stabilityProvider: AIProvider = {
	name: 'Stability AI',
	models: STABILITY_IMAGE_MODELS,

	// Note: chat method not implemented for image-only models
	async chat(params: { model: string; messages: AIMessage[]; maxTokens?: number; temperature?: number; stream?: boolean; userId?: string; chatId?: string }): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>> {
		throw new Error('Chat not supported for Stability AI image generation models');
	},

	// Image generation
	async generateImage(params: ImageGenerationParams): Promise<AIImageResponse> {
		const { model, prompt, size = '1024x1024', userId, chatId } = params;

		// Validate model capabilities
		const modelConfig = STABILITY_IMAGE_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in Stability AI provider`);
		}

		if (!modelConfig.supportsImageGeneration) {
			throw new Error(`Model ${model} does not support image generation`);
		}

		const apiKey = await getApiKey();
		if (!apiKey) {
			throw new Error('STABILITYAI_API_KEY is not configured');
		}

		try {
			const endpoint = getEndpointForModel(model);
			const aspectRatio = getAspectRatio(size);

			// Create form data for multipart/form-data request
			const formData = new FormData();
			formData.append('prompt', prompt);
			formData.append('aspect_ratio', aspectRatio);
			formData.append('output_format', 'png');

			// Add model parameter for SD3.5 variants
			const modelParam = getModelParameter(model);
			if (modelParam) {
				formData.append('model', modelParam);
			}

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Authorization': apiKey,
					'Accept': 'image/*'
				},
				body: formData
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Stability AI API error: ${response.status} - ${errorText}`);
			}

			// Get image as array buffer
			const imageBuffer = await response.arrayBuffer();
			if (!imageBuffer || imageBuffer.byteLength === 0) {
				throw new Error('No image data received from Stability AI');
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
			throw new Error(`Stability AI image generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
};
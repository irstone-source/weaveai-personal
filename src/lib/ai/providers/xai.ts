import OpenAI from 'openai';
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
import { saveImageAndGetId } from '../utils.js';
import { getXAIApiKey } from '$lib/server/settings-store.js';

// Get API key from database or fallback to environment variable
async function getApiKey(): Promise<string> {
	try {
		const dbKey = await getXAIApiKey();
		return dbKey || env.XAI_API_KEY || '';
	} catch (error) {
		console.warn('Failed to get xAI API key from database, using environment variable:', error);
		return env.XAI_API_KEY || '';
	}
}

// Initialize xAI client - will be recreated if needed when API key changes
let xai: OpenAI | null = null;
let currentApiKey: string | null = null;

async function getXAIClient(): Promise<OpenAI> {
	const apiKey = await getApiKey();
	
	if (!xai || currentApiKey !== apiKey) {
		currentApiKey = apiKey;
		xai = new OpenAI({
			apiKey,
			baseURL: 'https://api.x.ai/v1'
		});
	}
	
	return xai;
}

// xAI Grok-2-Image Model Configuration
const XAI_MODELS: AIModelConfig[] = [
	{
		name: 'grok-2-image',
		displayName: 'Grok 2 Image',
		provider: 'xAI',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsFunctions: false,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageEditing: false,
		supportsImageStreaming: false
	}
];

// Helper function to save image to filesystem and database
async function saveImageToStorage(
	imageBase64: string,
	userId: string,
	chatId?: string
): Promise<string> {
	console.log('📥 xAI: Saving image, base64 length:', imageBase64.length);
	
	// Use the proper storage abstraction layer (supports both R2 and local storage)
	const imageId = await saveImageAndGetId(imageBase64, 'image/png', userId, chatId);

	console.log('✅ xAI: Image saved with ID:', imageId);
	return imageId;
}

export const xaiProvider: AIProvider = {
	name: 'xAI',
	models: XAI_MODELS,

	// Note: chat method not implemented for image-only models
	async chat(params: { model: string; messages: AIMessage[]; maxTokens?: number; temperature?: number; stream?: boolean; userId?: string; chatId?: string }): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>> {
		throw new Error('Chat not supported for xAI image generation models');
	},

	// Image generation with Grok-2-Image
	async generateImage(params: ImageGenerationParams): Promise<AIImageResponse> {
		const { model, prompt, userId, chatId } = params;

		// Validate model
		const modelConfig = XAI_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in xAI provider`);
		}

		if (!modelConfig.supportsImageGeneration) {
			throw new Error(`Model ${model} does not support image generation`);
		}

		if (!userId) {
			throw new Error('User ID is required for image generation');
		}

		console.log(`Generating image with xAI ${model}:`, prompt);

		try {
			// Use OpenAI SDK format for xAI API
			const client = await getXAIClient();
			const response = await client.images.generate({
				model,
				prompt,
				response_format: 'b64_json',
				n: 1
			});

			console.log('xAI API Response received');

			// Extract image data
			const imageBase64 = response.data?.[0]?.b64_json;
			if (!imageBase64) {
				throw new Error('No image data received from xAI API');
			}

			console.log(`Image generated successfully: ${imageBase64.length} characters`);

			// Save image to storage
			const imageId = await saveImageToStorage(imageBase64, userId, chatId);

			return {
				imageId,
				mimeType: 'image/png',
				prompt,
				model,
				usage: {
					promptTokens: prompt.length / 4, // Rough estimate
					imageTokens: 1,
					totalTokens: (prompt.length / 4) + 1
				}
			};

		} catch (error) {
			console.error('xAI API Error:', error);

			// Provide more specific error messages
			if (error instanceof Error) {
				if (error.message.includes('insufficient_quota')) {
					throw new Error('xAI API quota exceeded. Please check your xAI account billing and usage limits.');
				} else if (error.message.includes('invalid_api_key')) {
					throw new Error('Invalid xAI API key. Please check your XAI_API_KEY environment variable.');
				} else if (error.message.includes('rate_limit_exceeded')) {
					throw new Error('xAI API rate limit exceeded. Please wait and try again.');
				} else if (error.message.includes('content_policy_violation')) {
					throw new Error('Content policy violation. Please modify your prompt and try again.');
				}
			}

			throw new Error(`xAI image generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
};
import OpenAI, { toFile } from 'openai';
import type {
	AIProvider,
	AIModelConfig,
	AIResponse,
	AIStreamChunk,
	AIMessage,
	ImageGenerationParams,
	ImageEditParams,
	AIImageResponse,
	AIImageStreamChunk
} from '../types.js';
import { env } from '$env/dynamic/private';
import { saveImageAndGetId } from '../utils.js';
import { getOpenAIApiKey } from '$lib/server/settings-store.js';

// Get API key from database or fallback to environment variable
async function getApiKey(): Promise<string> {
	try {
		const dbKey = await getOpenAIApiKey();
		return dbKey || env.OPENAI_API_KEY || '';
	} catch (error) {
		console.warn('Failed to get OpenAI API key from database, using environment variable:', error);
		return env.OPENAI_API_KEY || '';
	}
}

// Initialize OpenAI client - will be recreated if needed when API key changes
let openai: OpenAI | null = null;
let currentApiKey: string | null = null;

async function getOpenAIClient(): Promise<OpenAI> {
	const apiKey = await getApiKey();
	
	if (!openai || currentApiKey !== apiKey) {
		currentApiKey = apiKey;
		openai = new OpenAI({ apiKey });
	}
	
	return openai;
}


// OpenAI Image Generation Models Configuration
const OPENAI_IMAGE_MODELS: AIModelConfig[] = [
	{
		name: 'gpt-image-1',
		displayName: 'GPT Image 1',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: false, // Text streaming
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageEditing: true,
		supportsImageStreaming: true // Supports streaming image generation
	},
	{
		name: 'dall-e-3',
		displayName: 'DALL-E 3',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: false, // Text streaming
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageEditing: false, // DALL-E 3 only supports generations
		supportsImageStreaming: false
	},
	{
		name: 'dall-e-2',
		displayName: 'DALL-E 2',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: false, // Text streaming
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageEditing: true, // DALL-E 2 supports generations and edits
		supportsImageStreaming: false
	}
];

// Helper function to map quality parameters for each model
function mapQualityForModel(model: string, quality?: string): string {
	// Default to 'auto' if no quality specified
	const inputQuality = quality || 'auto';

	// If auto, return auto for all models
	if (inputQuality === 'auto') {
		return 'auto';
	}

	switch (model) {
		case 'gpt-image-1':
			// Maps: standard->medium, hd->high, or use direct values
			const gptQualityMap: Record<string, string> = {
				'standard': 'medium',
				'hd': 'high',
				'low': 'low',
				'medium': 'medium',
				'high': 'high'
			};
			return gptQualityMap[inputQuality] || 'auto';

		case 'dall-e-3':
			// Supports: standard, hd
			const dalle3QualityMap: Record<string, string> = {
				'standard': 'standard',
				'hd': 'hd'
			};
			return dalle3QualityMap[inputQuality] || 'auto';

		case 'dall-e-2':
			// Only supports: standard
			return 'standard'; // DALL-E 2 only supports standard quality

		default:
			return 'auto';
	}
}

// Helper function to save image to filesystem and database
async function saveImageToStorage(
	imageBase64: string,
	userId: string,
	chatId?: string,
	prompt?: string,
	model?: string
): Promise<string> {
	// Use the proper storage abstraction layer (supports both R2 and local storage)
	const imageId = await saveImageAndGetId(imageBase64, 'image/png', userId, chatId);

	return imageId;
}

export const openaiProvider: AIProvider = {
	name: 'OpenAI',
	models: OPENAI_IMAGE_MODELS,

	// Note: chat method not implemented for image-only models
	async chat(params: { model: string; messages: AIMessage[]; maxTokens?: number; temperature?: number; stream?: boolean; userId?: string; chatId?: string }): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>> {
		throw new Error('Chat not supported for OpenAI image generation models');
	},

	// Image generation with streaming support
	async generateImage(params: ImageGenerationParams): Promise<AIImageResponse | AsyncIterableIterator<AIImageStreamChunk>> {
		const { model, prompt, quality = 'standard', size = '1024x1024', stream = false, partial_images = 2, userId, chatId } = params;

		// Validate model capabilities
		const modelConfig = OPENAI_IMAGE_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in OpenAI provider`);
		}

		if (!modelConfig.supportsImageGeneration) {
			throw new Error(`Model ${model} does not support image generation`);
		}

		// Handle streaming for supported models
		if (stream && modelConfig.supportsImageStreaming) {
			return createImageStreamIterator({ model, prompt, quality, size, partial_images, userId, chatId });
		}

		// Non-streaming generation
		try {
			let response;
			const mappedQuality = mapQualityForModel(model, quality);

			if (model === 'gpt-image-1') {
				// GPT-image-1 specific parameters
				const validSizes = ['1024x1024', '1024x1536', '1536x1024'];
				const finalSize = validSizes.includes(size) ? size : '1024x1024';

				const client = await getOpenAIClient();
				response = await client.images.generate({
					model,
					prompt,
					quality: mappedQuality as 'high' | 'medium' | 'low' | 'auto',
					size: finalSize as '1024x1024' | '1024x1536' | '1536x1024',
					output_format: 'png',
					n: 1
				});
			} else if (model === 'dall-e-3') {
				// DALL-E 3 parameters
				const validSizes = ['1024x1024', '1792x1024', '1024x1792'];
				const finalSize = validSizes.includes(size) ? size : '1024x1024';

				const client = await getOpenAIClient();
				response = await client.images.generate({
					model,
					prompt,
					quality: mappedQuality as 'standard' | 'hd' | 'auto',
					size: finalSize as '1024x1024' | '1792x1024' | '1024x1792',
					response_format: 'b64_json',
					n: 1
				});
			} else if (model === 'dall-e-2') {
				// DALL-E 2 parameters (no quality parameter - not supported by API)
				const validSizes = ['256x256', '512x512', '1024x1024'];
				const finalSize = validSizes.includes(size) ? size : '1024x1024';

				const client = await getOpenAIClient();
				response = await client.images.generate({
					model,
					prompt,
					size: finalSize as '256x256' | '512x512' | '1024x1024',
					response_format: 'b64_json',
					n: 1
				});
			} else {
				throw new Error(`Unsupported model: ${model}`);
			}

			const imageBase64 = response.data?.[0]?.b64_json;
			if (!imageBase64) {
				throw new Error('No image data received from OpenAI');
			}

			// Save image to storage
			const imageId = await saveImageToStorage(imageBase64, userId!, chatId);

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
			throw new Error(`OpenAI image generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Image editing
	async editImage(params: ImageEditParams): Promise<AIImageResponse> {
		const { model, image, prompt, quality = 'standard', size = '1024x1024', userId, chatId } = params;

		// Validate model capabilities
		const modelConfig = OPENAI_IMAGE_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in OpenAI provider`);
		}

		if (!modelConfig.supportsImageEditing) {
			throw new Error(`Model ${model} does not support image editing`);
		}

		try {
			// Convert File(s) to OpenAI format
			const imageFiles = Array.isArray(image) ? image : [image];
			const openaiImages = await Promise.all(
				imageFiles.map(file => toFile(file, file.name))
			);

			let response;
			const mappedQuality = mapQualityForModel(model, quality);

			if (model === 'gpt-image-1') {
				// GPT-image-1 specific parameters for editing
				const validSizes = ['1024x1024', '1024x1536', '1536x1024'];
				const finalSize = validSizes.includes(size) ? size : '1024x1024';

				const client = await getOpenAIClient();
				response = await client.images.edit({
					model,
					image: openaiImages.length === 1 ? openaiImages[0] : openaiImages,
					prompt,
					quality: mappedQuality as 'high' | 'medium' | 'low' | 'auto',
					size: finalSize as '1024x1024' | '1024x1536' | '1536x1024',
					output_format: 'png',
					n: 1
				});
			} else if (model === 'dall-e-2') {
				// DALL-E 2 parameters (no quality parameter - not supported by API)
				const validSizes = ['256x256', '512x512', '1024x1024'];
				const finalSize = validSizes.includes(size) ? size : '1024x1024';

				const client = await getOpenAIClient();
				response = await client.images.edit({
					model,
					image: openaiImages.length === 1 ? openaiImages[0] : openaiImages,
					prompt,
					size: finalSize as '256x256' | '512x512' | '1024x1024',
					response_format: 'b64_json',
					n: 1
				});
			} else {
				throw new Error(`Model ${model} does not support image editing`);
			}

			const imageBase64 = response.data?.[0]?.b64_json;
			if (!imageBase64) {
				throw new Error('No image data received from OpenAI edit');
			}

			// Save edited image to storage
			const imageId = await saveImageToStorage(imageBase64, userId!, chatId);

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
			throw new Error(`OpenAI image editing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
};

// Streaming image generation iterator
async function* createImageStreamIterator(params: {
	model: string;
	prompt: string;
	quality?: string;
	size?: string;
	partial_images?: number;
	userId?: string;
	chatId?: string;
}): AsyncIterableIterator<AIImageStreamChunk> {
	const { model, prompt, quality = 'standard', size = '1024x1024', partial_images = 2, userId, chatId } = params;

	try {
		let stream;
		const mappedQuality = mapQualityForModel(model, quality);

		if (model === 'gpt-image-1') {
			// GPT-image-1 specific streaming parameters
			const validSizes = ['1024x1024', '1024x1536', '1536x1024'];
			const finalSize = validSizes.includes(size) ? size : '1024x1024';

			const client = await getOpenAIClient();
			stream = await client.images.generate({
				model,
				prompt,
				quality: mappedQuality as 'high' | 'medium' | 'low' | 'auto',
				size: finalSize as '1024x1024' | '1024x1536' | '1536x1024',
				output_format: 'png',
				stream: true,
				partial_images
			});
		} else {
			// DALL-E models don't support streaming, so this shouldn't be reached
			throw new Error(`Model ${model} does not support streaming image generation`);
		}

		for await (const event of stream) {
			if (event.type === 'image_generation.partial_image') {
				yield {
					type: 'image_generation.partial_image',
					partial_image_index: event.partial_image_index,
					b64_json: event.b64_json,
					done: false
				};
			}
		}

		// Generate final complete image for GPT-image-1
		const validSizes = ['1024x1024', '1024x1536', '1536x1024'];
		const finalSize = validSizes.includes(size) ? size : '1024x1024';

		const client = await getOpenAIClient();
		const finalResponse = await client.images.generate({
			model,
			prompt,
			quality: mappedQuality as 'high' | 'medium' | 'low' | 'auto',
			size: finalSize as '1024x1024' | '1024x1536' | '1536x1024',
			output_format: 'png',
			n: 1
		});

		const finalImageBase64 = finalResponse.data?.[0]?.b64_json;
		if (finalImageBase64 && userId) {
			const imageId = await saveImageToStorage(finalImageBase64, userId, chatId);

			yield {
				type: 'image_generation.complete',
				b64_json: finalImageBase64,
				imageId,
				done: true
			};
		}

	} catch (error) {
		throw new Error(`OpenAI streaming image generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
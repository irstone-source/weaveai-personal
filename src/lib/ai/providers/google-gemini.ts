import { GoogleGenAI, Modality } from '@google/genai';
import type { AIProvider, AIModelConfig, AIImageResponse, ImageGenerationParams, AIVideoResponse, VideoGenerationParams, AIResponse, AIMessage } from '../types.js';
import { env } from '$env/dynamic/private';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { db } from '$lib/server/db/index.js';
import { images } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { saveImageAndGetId, saveVideoAndGetId } from '../utils.js';
import { getGeminiApiKey } from '$lib/server/settings-store.js';

// Get API key from database or fallback to environment variable
async function getApiKey(): Promise<string> {
	try {
		const dbKey = await getGeminiApiKey();
		return dbKey || env.GEMINI_API_KEY || '';
	} catch (error) {
		console.warn('Failed to get Gemini API key from database, using environment variable:', error);
		return env.GEMINI_API_KEY || '';
	}
}

// Initialize Google GenAI client - will be recreated if needed when API key changes
let genAI: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

async function getGenAIClient(): Promise<GoogleGenAI> {
	const apiKey = await getApiKey();

	if (!genAI || currentApiKey !== apiKey) {
		currentApiKey = apiKey;
		genAI = new GoogleGenAI({ apiKey });
	}

	return genAI;
}

// Helper function to fetch image data from database by ID
async function getImageDataById(imageId: string): Promise<{ data: string, mimeType: string } | null> {
	try {
		// Get image record from database
		const [imageRecord] = await db
			.select()
			.from(images)
			.where(eq(images.id, imageId))
			.limit(1);

		if (!imageRecord) {
			console.error(`Image not found in database: ${imageId}`);
			return null;
		}

		// Read image file from filesystem
		const imagePath = join(process.cwd(), 'static', 'uploads', 'images', imageRecord.filename);
		const imageBuffer = await readFile(imagePath);

		// Convert to base64
		const base64Data = imageBuffer.toString('base64');

		return {
			data: base64Data,
			mimeType: imageRecord.mimeType
		};
	} catch (error) {
		console.error(`Error fetching image data for ID ${imageId}:`, error);
		return null;
	}
}

// Helper function to convert our AIMessage format to Google's expected format
async function convertMessagesToGeminiFormat(messages: AIMessage[]) {
	const contents = [];

	for (const message of messages) {
		if (message.role === 'system') {
			// Skip system messages for now as Gemini handles context differently
			continue;
		}

		const parts = [];

		// Add text content
		if (message.content) {
			parts.push({ text: message.content });
		}

		// Add image content if present (support imageId, imageUrl, and legacy imageData)
		if (message.imageData && message.mimeType) {
			// Legacy base64 data support
			parts.push({
				inlineData: {
					data: message.imageData,
					mimeType: message.mimeType
				}
			});
		} else if (message.imageId && message.mimeType) {
			// Image ID reference - fetch the image data from database
			console.log('Processing image ID in conversation context:', message.imageId);
			const imageData = await getImageDataById(message.imageId);
			if (imageData) {
				parts.push({
					inlineData: {
						data: imageData.data,
						mimeType: imageData.mimeType
					}
				});
				console.log(`Successfully loaded image data: ${imageData.data.length} characters, MIME type: ${imageData.mimeType}`);
			} else {
				console.error(`Failed to load image data for ID: ${message.imageId}`);
			}
		} else if (message.imageUrl && message.mimeType) {
			// TODO: For now, we'll skip URL-based images in conversation context
			// In a future enhancement, we could fetch the image data from the URL
			console.log('Skipping image URL in conversation context:', message.imageUrl);
		}

		if (parts.length > 0) {
			contents.push({
				role: message.role === 'assistant' ? 'model' : 'user',
				parts: parts
			});
		}
	}

	return contents;
}

const GOOGLE_GEMINI_MODELS: AIModelConfig[] = [
	{
		name: 'gemini-2.5-flash-image-preview',
		displayName: 'Gemini 2.5 Flash Image',
		provider: 'Google',
		maxTokens: 2048,
		supportsStreaming: false,
		supportsFunctions: false,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoInput: true,
		supportsAudioInput: true,
		supportsTextGeneration: true,
		supportsImageGeneration: true,
	},
	{
		name: 'gemini-2.0-flash-preview-image-generation',
		displayName: 'Gemini 2.0 Flash Image',
		provider: 'Google',
		maxTokens: 2048,
		supportsStreaming: false,
		supportsFunctions: false,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoInput: true,
		supportsAudioInput: true,
		supportsTextGeneration: true,
		supportsImageGeneration: true,
	},
	{
		name: 'imagen-4.0-generate-preview-06-06',
		displayName: 'Imagen 4',
		provider: 'Google',
		maxTokens: 2048,
		supportsStreaming: false,
		supportsFunctions: false,
		supportsTextInput: true,
		supportsImageGeneration: true
	},
	{
		name: 'imagen-4.0-ultra-generate-preview-06-06',
		displayName: 'Imagen 4 Ultra',
		provider: 'Google',
		maxTokens: 2048,
		supportsStreaming: false,
		supportsFunctions: false,
		supportsTextInput: true,
		supportsImageGeneration: true
	},
	{
		name: 'imagen-3.0-generate-002',
		displayName: 'Imagen 3',
		provider: 'Google',
		maxTokens: 2048,
		supportsStreaming: false,
		supportsFunctions: false,
		supportsTextInput: true,
		supportsImageGeneration: true
	},
	{
		name: 'veo-3.0-generate-preview',
		displayName: 'Veo 3 Video',
		provider: 'Google',
		maxTokens: 2048,
		supportsStreaming: false,
		supportsFunctions: false,
		supportsTextInput: true,
		supportsVideoGeneration: true,
		supportsAudioGeneration: true // supports video generation with audio
	},
	{
		name: 'veo-2.0-generate-001',
		displayName: 'Veo 2 Video',
		provider: 'Google',
		maxTokens: 2048,
		supportsStreaming: false,
		supportsFunctions: false,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true
	}
];

export const googleGeminiProvider: AIProvider = {
	name: 'Google Gemini',
	models: GOOGLE_GEMINI_MODELS,

	// Chat method - handles Imagen models by routing to image generation
	// Imagen models: routed to generateImage() method for consistent behavior with OpenAI/xAI
	// Other Google models: directed to use chatMultimodal() method
	async chat(params: { model: string; messages: AIMessage[]; maxTokens?: number; temperature?: number; userId?: string; chatId?: string }) {
		const { model, messages, userId, chatId } = params;

		// Route Imagen models to image generation (consistent with other pure image generation models)
		if (model.includes('imagen')) {
			// Extract the prompt from the last user message
			const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
			if (!lastUserMessage || !lastUserMessage.content) {
				throw new Error('No user message found for image generation');
			}

			// Check if generateImage method exists
			if (!this.generateImage) {
				throw new Error('Image generation not supported by this provider');
			}

			// Route to generateImage method and convert response to chat format
			const imageResult = await this.generateImage({
				model,
				prompt: lastUserMessage.content,
				userId,
				chatId
			});

			// Handle the case where generateImage might return streaming results
			if (Symbol.asyncIterator in (imageResult as any)) {
				throw new Error('Streaming image generation not supported through chat interface');
			}

			const imageResponse = imageResult as AIImageResponse;

			// Convert AIImageResponse to chat-compatible AIResponse format
			// This allows Imagen models to work through chat interface like DALL-E/Grok-2-Image
			return {
				content: `Generated image for: "${lastUserMessage.content}"`,
				model,
				usage: {
					promptTokens: imageResponse.usage?.promptTokens || 0,
					completionTokens: imageResponse.usage?.imageTokens || 1, // Map imageTokens to completionTokens for compatibility
					totalTokens: imageResponse.usage?.totalTokens || 1
				},
				// Include image metadata (extended AIResponse properties for frontend)
				imageId: imageResponse.imageId,
				mimeType: imageResponse.mimeType
			} as AIResponse & { imageId: string; mimeType: string };
		}

		// For other Google models (Gemini, Veo), redirect to multimodal chat
		throw new Error('Chat method not supported for this Google model. Use the multimodal chat interface instead.');
	},

	// Multimodal chat method for Gemini 2.0 Flash
	async chatMultimodal(params: { model: string; messages: AIMessage[]; maxTokens?: number; temperature?: number; userId?: string; chatId?: string }) {
		const { model, messages, userId, chatId } = params;

		console.log('=== GOOGLE GEMINI MULTIMODAL CHAT START ===');
		console.log('Model:', model);
		console.log('User ID:', userId);
		console.log('Chat ID:', chatId);
		console.log('Messages count:', messages.length);
		console.log('Full messages:', JSON.stringify(messages, null, 2));

		if (!model.includes('gemini')) {
			throw new Error('chatMultimodal only supports Gemini models');
		}

		// Convert our message format to Google's expected format
		const geminiContents = await convertMessagesToGeminiFormat(messages);

		console.log('Converted messages to Gemini format:', JSON.stringify(geminiContents, null, 2));

		try {
			const client = await getGenAIClient();
			const response = await client.models.generateContent({
				model,
				contents: geminiContents,
				config: {
					responseModalities: [Modality.TEXT, Modality.IMAGE],
				},
			});

			console.log('=== GEMINI API RESPONSE ===');
			console.log('Raw response:', JSON.stringify(response, null, 2));

			// Process Gemini response
			if (!response.candidates || response.candidates.length === 0) {
				console.error('No candidates in response:', response);
				throw new Error('No candidates received from Google Gemini API');
			}

			const candidate = response.candidates[0];
			console.log('Selected candidate:', JSON.stringify(candidate, null, 2));

			// Handle content policy blocks (RECITATION finish reason)
			if (candidate.finishReason === 'RECITATION') {
				throw new Error('Content blocked by Gemini safety filters. The request may contain copyrighted material or violate content policies. Please try rephrasing your message or using a different image.');
			}

			// Handle other safety-related finish reasons
			if (candidate.finishReason && candidate.finishReason !== 'STOP') {
				const reasonMessages: Record<string, string> = {
					'SAFETY': 'Content blocked by Gemini safety filters. Please try a different request.',
					'MAX_TOKENS': 'Response truncated due to maximum token limit.',
					'OTHER': 'Request was stopped for an unspecified reason.'
				};
				const message = reasonMessages[candidate.finishReason] || `Request stopped with reason: ${candidate.finishReason}`;
				throw new Error(message);
			}

			if (!candidate.content || !candidate.content.parts) {
				throw new Error('No content parts received from Google Gemini API');
			}

			// Look for both image and text data
			let imageData = '';
			let mimeType = 'image/png';
			let textContent = '';

			console.log('=== PROCESSING RESPONSE PARTS ===');
			console.log('Parts count:', candidate.content.parts.length);

			for (const part of candidate.content.parts) {
				console.log('Processing part:', JSON.stringify(part, null, 2));
				if (part.inlineData) {
					imageData = part.inlineData.data || '';
					mimeType = part.inlineData.mimeType || 'image/png';
					console.log(`✓ Found image data: ${imageData.length} characters, MIME type: ${mimeType}`);
				} else if (part.text) {
					textContent = part.text;
					console.log(`✓ Found text content: "${textContent}"`);
				} else {
					console.log('⚠️ Unknown part type:', Object.keys(part));
				}
			}

			const usage = {
				promptTokens: response.usageMetadata?.promptTokenCount || 0,
				completionTokens: response.usageMetadata?.totalTokenCount || 0,
				totalTokens: (response.usageMetadata?.totalTokenCount || 0)
			};

			// Get the last user message content for context
			const lastUserMessage = messages.filter(m => m.role === 'user').pop();
			const contextPrompt = lastUserMessage?.content?.trim() || 'user request';

			console.log('=== RESPONSE DECISION ===');
			console.log('Has imageData:', !!imageData, `(length: ${imageData.length})`);
			console.log('Has textContent:', !!textContent, `(content: "${textContent}")`);
			console.log('Context prompt:', contextPrompt);
			console.log('User ID:', userId);

			// Return appropriate response type
			if (imageData) {
				console.log('✓ Returning IMAGE response');
				// Save image and get database ID
				if (!userId) {
					throw new Error('User ID is required for saving images');
				}
				const imageId = await saveImageAndGetId(imageData, mimeType, userId, chatId);
				console.log('Saved image with ID:', imageId);

				const imageResponse = {
					imageId,
					mimeType,
					prompt: contextPrompt,
					model,
					usage: {
						promptTokens: usage.promptTokens,
						imageTokens: 1,
						totalTokens: usage.totalTokens + 1
					}
				} as AIImageResponse;

				console.log('=== FINAL IMAGE RESPONSE ===');
				console.log(JSON.stringify(imageResponse, null, 2));
				return imageResponse;
			} else if (textContent) {
				console.log('✓ Returning TEXT response');
				const textResponse = {
					content: textContent,
					model,
					usage: {
						promptTokens: usage.promptTokens,
						completionTokens: usage.completionTokens,
						totalTokens: usage.totalTokens
					}
				} as AIResponse;

				console.log('=== FINAL TEXT RESPONSE ===');
				console.log(JSON.stringify(textResponse, null, 2));
				return textResponse;
			} else {
				console.log('❌ No content found - throwing error');
				throw new Error('No content received from Google Gemini API');
			}

		} catch (error) {
			console.error('=== GOOGLE GEMINI ERROR ===');
			console.error('Error details:', error);
			console.error('Error type:', typeof error);
			console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
			console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');

			// Provide more specific error messages
			if (error instanceof Error) {
				if (error.message.includes('No content received')) {
					throw new Error(`Google Gemini returned no content. This may be due to: 1) Content filtering, 2) Invalid prompt for image generation, 3) Model limitations. Original error: ${error.message}`);
				} else if (error.message.includes('User ID is required')) {
					throw new Error('User authentication required for image generation. Please ensure you are logged in.');
				} else if (error.message.includes('safety filters')) {
					throw new Error(`Content blocked by safety filters: ${error.message}`);
				}
			}

			throw new Error(`Google Gemini multimodal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Image generation method
	async generateImage(params: ImageGenerationParams): Promise<AIImageResponse> {
		const { model, prompt, userId, chatId } = params;

		// Determine if this is a Gemini or Imagen model
		const isGeminiModel = model.includes('gemini');
		const isImagenModel = model.includes('imagen');

		console.log(`Generating image with ${isGeminiModel ? 'Gemini' : 'Imagen'} model: ${model}`);

		try {
			if (isGeminiModel) {
				// Use generateContent for Gemini models (as per official docs)
				const client = await getGenAIClient();
				const response = await client.models.generateContent({
					model,
					contents: [{
						role: 'user',
						parts: [{ text: prompt }]
					}],
					config: {
						responseModalities: [Modality.TEXT, Modality.IMAGE],
					},
				});

				console.log('Gemini API Response:', JSON.stringify(response, null, 2));

				// Process Gemini response
				if (!response.candidates || response.candidates.length === 0) {
					throw new Error('No candidates received from Google Gemini API');
				}

				const candidate = response.candidates[0];
				if (!candidate.content || !candidate.content.parts) {
					throw new Error('No content parts received from Google Gemini API');
				}

				// Look for both image and text data in the response parts
				let imageData = '';
				let mimeType = 'image/png';
				let textContent = '';

				for (const part of candidate.content.parts) {
					if (part.inlineData) {
						imageData = part.inlineData.data || '';
						mimeType = part.inlineData.mimeType || 'image/png';
						console.log(`Found image data: ${imageData.length} characters, MIME type: ${mimeType}`);
					} else if (part.text) {
						textContent = part.text;
						console.log(`Found text content: ${textContent.substring(0, 100)}...`);
					}
				}

				// Handle multimodal responses: prioritize image but allow text-only
				if (imageData) {
					// Save image and get database ID
					if (!userId) {
						throw new Error('User ID is required for saving images');
					}
					const imageId = await saveImageAndGetId(imageData, mimeType, userId, chatId);

					// Image response (with optional text description)
					return {
						imageId,
						mimeType,
						prompt: prompt?.trim() || 'image generation',
						model,
						usage: {
							promptTokens: response.usageMetadata?.promptTokenCount || 0,
							imageTokens: 1,
							totalTokens: (response.usageMetadata?.totalTokenCount || 0) + 1
						}
					};
				} else if (textContent) {
					// Text-only response - this is valid for multimodal models
					console.log('No image generated, returning text response');
					throw new Error('TEXT_RESPONSE_ONLY|' + textContent);
				} else {
					// No content at all
					console.log('Response parts:', candidate.content.parts);
					throw new Error('No content received from Google Gemini API. Check console for response details.');
				}

			} else if (isImagenModel) {
				// Use generateImages for Imagen models (as per official docs)
				const client = await getGenAIClient();
				const response = await client.models.generateImages({
					model,
					prompt, // Simple string prompt as per docs
					config: {
						numberOfImages: 1, // Generate single image
					},
				});

				console.log('Imagen API Response:', JSON.stringify(response, null, 2));

				// Process Imagen response
				if (!response.generatedImages || response.generatedImages.length === 0) {
					throw new Error('No generated images received from Google Imagen API');
				}

				const generatedImage = response.generatedImages[0];
				if (!generatedImage.image || !generatedImage.image.imageBytes) {
					throw new Error('No image bytes received from Google Imagen API');
				}

				const imageData = generatedImage.image.imageBytes;
				const mimeType = generatedImage.image.mimeType || 'image/png';

				console.log(`Found Imagen image data: ${imageData.length} characters, MIME type: ${mimeType}`);

				// Save image and get database ID
				if (!userId) {
					throw new Error('User ID is required for saving images');
				}
				const imageId = await saveImageAndGetId(imageData, mimeType, userId, chatId);

				return {
					imageId,
					mimeType,
					prompt: prompt?.trim() || 'image generation',
					model,
					usage: {
						promptTokens: 0, // Imagen doesn't provide token usage info
						imageTokens: 1,
						totalTokens: 1
					}
				};

			} else {
				throw new Error(`Unsupported model type: ${model}`);
			}

		} catch (error) {
			console.error('Google API Error Details:', error);

			// Extract more detailed error information
			if (error && typeof error === 'object' && 'message' in error) {
				const errorMessage = error.message;
				console.error('Error message:', errorMessage);

				// Try to parse JSON error details if available
				try {
					const errorData = JSON.parse(String(errorMessage));
					if (errorData.error) {
						// Check for specific Imagen billing error
						if (errorData.error.code === 400 &&
							errorData.error.message &&
							errorData.error.message.includes('Imagen API is only accessible to billed users')) {
							throw new Error('Imagen models require a billing account. Please add billing details to your Google Cloud account to use Imagen 3 and Imagen 4 models. You can set up billing at https://console.cloud.google.com/billing');
						}
						throw new Error(`Google API error: ${errorData.error.message} (Code: ${errorData.error.code})`);
					}
				} catch (parseError) {
					// If JSON parsing fails, check for billing error in raw message
					if (String(errorMessage).includes('Imagen API is only accessible to billed users')) {
						throw new Error('Imagen models require a billing account. Please add billing details to your Google Cloud account to use Imagen 3 and Imagen 4 models. You can set up billing at https://console.cloud.google.com/billing');
					}
					// Use the original message if no special handling needed
				}
			}

			throw new Error(`Google API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Video generation method for Veo 3
	async generateVideo(params: VideoGenerationParams): Promise<AIVideoResponse> {
		const { model, prompt, userId, chatId, duration = 8, resolution = '720p', fps = 24 } = params;

		console.log(`Generating video with Veo 3 model: ${model}`);
		console.log(`Prompt: ${prompt}`);

		if (!model.includes('veo')) {
			throw new Error(`Unsupported video model: ${model}. Only Veo models are supported.`);
		}

		if (!userId) {
			throw new Error('User ID is required for video generation');
		}

		try {
			// Start video generation using the generateVideos method
			const client = await getGenAIClient();
			let operation = await client.models.generateVideos({
				model,
				prompt, // Simple string prompt as per Veo 3 docs
				config: {
					numberOfVideos: 1, // Generate single video
				},
			});

			console.log('Veo 3 Initial Response:', JSON.stringify(operation, null, 2));

			console.log('Video generation started. Polling for completion...');

			// Poll for completion (can take 11 seconds to 6 minutes)
			let attempts = 0;
			const maxAttempts = 180; // 15 minutes max (5 second intervals)
			const pollInterval = 5000; // 5 seconds

			while (!operation.done && attempts < maxAttempts) {
				try {
					// Wait before polling
					await new Promise(resolve => setTimeout(resolve, pollInterval));

					// Get updated operation status using the correct method
					const client2 = await getGenAIClient();
					operation = await client2.operations.getVideosOperation({
						operation: operation,
					});

					attempts++;
					console.log(`Poll attempt ${attempts}:`, JSON.stringify(operation, null, 2));

					if (operation.done) {
						// Operation completed
						if (operation.error) {
							throw new Error(`Video generation failed: ${operation.error.message}`);
						}

						if (!operation.response || !operation.response.generatedVideos) {
							throw new Error('No generated videos in completed operation response');
						}

						const generatedVideos = operation.response.generatedVideos;
						if (generatedVideos.length === 0) {
							throw new Error('No videos generated in operation response');
						}

						const generatedVideo = generatedVideos[0];
						if (!generatedVideo.video) {
							throw new Error('No video in generated video response');
						}

						// Download the video file using the SDK
						const videoFile = generatedVideo.video;

						// For now, let's try to get the video data directly
						// Note: The exact API for downloading may vary
						let videoData: string;
						let mimeType = 'video/mp4';

						if (videoFile.videoBytes) {
							// If videoBytes is available directly
							videoData = videoFile.videoBytes;
							mimeType = videoFile.mimeType || 'video/mp4';
						} else {
							// If we need to download the file
							throw new Error('Video download not yet implemented - videoBytes not available in response');
						}

						console.log(`Video generation completed! Video data: ${videoData.length} characters, MIME type: ${mimeType}`);

						// Save video and get database ID
						const videoId = await saveVideoAndGetId(
							videoData,
							mimeType,
							userId,
							chatId,
							duration,
							resolution,
							fps,
							true // Veo 3 generates audio natively
						);

						return {
							videoId,
							mimeType,
							prompt: prompt?.trim() || 'video generation',
							model,
							duration,
							resolution,
							fps,
							hasAudio: true,
							usage: {
								promptTokens: 0, // Veo 3 doesn't provide detailed token usage
								videoTokens: 1,
								totalTokens: 1
							}
						};
					}

					console.log(`Video still generating... waiting ${pollInterval / 1000} seconds (attempt ${attempts}/${maxAttempts})`);

				} catch (pollError) {
					console.error('Error during polling:', pollError);
					// Continue polling unless it's a fatal error
					if (attempts >= maxAttempts - 1) {
						throw pollError;
					}
					attempts++;
					await new Promise(resolve => setTimeout(resolve, pollInterval));
				}
			}

			// If we reach here, we've exceeded max attempts
			throw new Error(`Video generation timed out after ${maxAttempts * pollInterval / 1000} seconds. The operation may still be in progress on Google's servers.`);

		} catch (error) {
			console.error('Veo 3 API Error Details:', error);

			// Extract more detailed error information
			if (error && typeof error === 'object' && 'message' in error) {
				const errorMessage = error.message;
				console.error('Error message:', errorMessage);

				// Check for specific billing or access errors
				if (String(errorMessage).includes('billing') || String(errorMessage).includes('quota')) {
					throw new Error('Veo 3 video generation requires a billing account with sufficient quota. Please check your Google Cloud billing and quota settings.');
				}
			}

			throw new Error(`Veo 3 video generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
};
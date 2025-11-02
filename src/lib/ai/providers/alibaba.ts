import type {
	AIProvider,
	AIModelConfig,
	AIResponse,
	AIStreamChunk,
	AIMessage,
	ImageGenerationParams,
	VideoGenerationParams,
	AIImageResponse,
	AIVideoResponse
} from '../types.js';
import { env } from '$env/dynamic/private';
import { saveImageAndGetId, saveVideoAndGetId, createProviderError, estimateTokenUsage, arrayBufferToBase64 } from '../utils.js';
import { getAlibabaApiKey } from '$lib/server/settings-store.js';

// Get API key from database or fallback to environment variable
async function getApiKey(): Promise<string> {
	try {
		const dbKey = await getAlibabaApiKey();
		return dbKey || env.ALIBABA_API_KEY || '';
	} catch (error) {
		console.warn('Failed to get Alibaba API key from database, using environment variable:', error);
		return env.ALIBABA_API_KEY || '';
	}
}

// Alibaba API Response Types
interface AlibabaTaskResponse {
	request_id: string;
	output?: {
		task_id: string;
		task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
		submit_time?: string;
		scheduled_time?: string;
		end_time?: string;
		// Image generation response
		results?: Array<{
			orig_prompt: string;
			actual_prompt: string;
			url: string;
		}>;
		task_metrics?: {
			TOTAL: number;
			SUCCEEDED: number;
			FAILED: number;
		};
		// Video generation response
		video_url?: string;
		orig_prompt?: string;
		actual_prompt?: string;
	};
	usage?: {
		image_count?: number;
		video_duration?: number;
		video_ratio?: string;
		video_count?: number;
	};
	code?: string;
	message?: string;
}

interface AlibabaInitialResponse {
	request_id: string;
	output: {
		task_id: string;
	};
	code?: string;
	message?: string;
}

interface AlibabaImageRequestBody {
	model: string;
	input: {
		prompt: string;
	};
}

interface AlibabaVideoRequestBody {
	model: string;
	input: {
		prompt: string;
		img_url?: string;
	};
}

// Constants - Following Alibaba's recommendations
const POLLING_DELAY_MS = 15000; // 15 seconds as recommended by Alibaba
const BASE_URL = 'https://dashscope-intl.aliyuncs.com/api/v1';

// Model-specific timeout configurations
const POLLING_CONFIG = {
	// Text-to-video models (typically 1-2 minutes, up to 5 minutes under load)
	t2v: {
		maxAttempts: 20, // 20 × 15s = 5 minutes
		description: 'text-to-video'
	},
	// Image-to-video models (typically 1-2 minutes, can take longer with complex images)
	i2v: {
		maxAttempts: 20, // 20 × 15s = 5 minutes
		description: 'image-to-video'
	},
	// Image generation models (typically faster)
	t2i: {
		maxAttempts: 10, // 10 × 15s = 2.5 minutes
		description: 'text-to-image'
	}
};

// Alibaba Wan Models Configuration
const ALIBABA_MODELS: AIModelConfig[] = [
	{
		name: 'wan2.2-t2v-plus',
		displayName: 'Wan 2.2 T2V Plus',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsVideoGeneration: true,
		supportsImageInput: false
	},
	{
		name: 'wan2.2-i2v-plus',
		displayName: 'Wan 2.2 I2V Plus',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsVideoGeneration: true,
		supportsImageInput: true
	},
	{
		name: 'wan2.2-t2i-flash',
		displayName: 'Wan 2.2 T2I Flash',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageInput: false
	},
	{
		name: 'wan2.2-t2i-plus',
		displayName: 'Wan 2.2 T2I Plus',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsStreaming: false,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageInput: false
	}
];

// Helper function to get API endpoint based on model type
function getEndpointForModel(model: string): string {
	if (model.includes('t2v') || model.includes('i2v')) {
		return `${BASE_URL}/services/aigc/video-generation/video-synthesis`;
	} else if (model.includes('t2i')) {
		return `${BASE_URL}/services/aigc/text2image/image-synthesis`;
	}
	throw new Error(`Unknown Alibaba model type: ${model}`);
}

// Helper function to get polling config based on model type
function getPollingConfig(model: string): { maxAttempts: number; description: string } {
	if (model.includes('t2v')) {
		return POLLING_CONFIG.t2v;
	} else if (model.includes('i2v')) {
		return POLLING_CONFIG.i2v;
	} else if (model.includes('t2i')) {
		return POLLING_CONFIG.t2i;
	}
	// Default to t2v config for unknown models
	return POLLING_CONFIG.t2v;
}

// Helper function to poll for completion
async function pollForCompletion(taskId: string, apiKey: string, model: string): Promise<AlibabaTaskResponse> {
	const pollingConfig = getPollingConfig(model);
	const { maxAttempts, description } = pollingConfig;
	let attempts = 0;
	const pollingUrl = `${BASE_URL}/tasks/${taskId}`;
	const startTime = Date.now();

	console.log(`Starting ${description} polling for task ${taskId} (max ${maxAttempts} attempts, ${POLLING_DELAY_MS / 1000}s intervals, ~${Math.round(maxAttempts * POLLING_DELAY_MS / 60000)} min timeout)`);

	while (attempts < maxAttempts) {
		try {
			const response = await fetch(pollingUrl, {
				headers: {
					'Authorization': apiKey
				}
			});

			if (!response.ok) {
				throw new Error(`Polling failed: ${response.status} - ${await response.text()}`);
			}

			const data: AlibabaTaskResponse = await response.json();

			// Check for API errors
			if (data.code && data.code !== '200') {
				throw new Error(`Alibaba API error: ${data.code} - ${data.message || 'Unknown error'}`);
			}

			// Check if the task is completed successfully
			if (data.output?.task_status === 'SUCCEEDED') {
				const elapsedTime = Math.round((Date.now() - startTime) / 1000);
				console.log(`${description} task ${taskId} completed successfully after ${attempts + 1} attempts (${elapsedTime}s)`);
				return data;
			}

			// If task failed
			if (data.output?.task_status === 'FAILED') {
				const elapsedTime = Math.round((Date.now() - startTime) / 1000);
				throw new Error(`Alibaba ${description} task ${taskId} failed after ${elapsedTime}s: ${data.message || 'Task failed'}`);
			}

			// If still processing, wait and retry
			if (data.output?.task_status === 'PENDING' || data.output?.task_status === 'RUNNING') {
				attempts++;
				const elapsedTime = Math.round((Date.now() - startTime) / 1000);
				console.log(`${description} task ${taskId} still ${data.output.task_status.toLowerCase()}, attempt ${attempts}/${maxAttempts} (${elapsedTime}s elapsed)`);
				await new Promise(resolve => setTimeout(resolve, POLLING_DELAY_MS));
				continue;
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

	const elapsedTime = Math.round((Date.now() - startTime) / 1000);
	throw new Error(`${description} timeout: Task ${taskId} took too long to complete (${maxAttempts} attempts over ${elapsedTime}s). Try again later when server load is lower.`);
}

// Helper function to get MIME type and extension from response
function getMimeTypeAndExtension(response: Response, fallbackMime: string): { mimeType: string; extension: string } {
	const contentType = response.headers.get('content-type');
	if (contentType) {
		const mimeType = contentType.split(';')[0].trim();
		if (mimeType.startsWith('image/')) {
			const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
			return { mimeType, extension };
		}
		if (mimeType.startsWith('video/')) {
			const extension = mimeType.split('/')[1];
			return { mimeType, extension };
		}
	}

	// Fallback based on URL extension or default
	const extension = fallbackMime === 'image/png' ? 'png' : 'mp4';
	return { mimeType: fallbackMime, extension };
}

// Helper function to parse and standardize video resolution format
function parseResolution(alibabaResolution: string): string {
	// Alibaba returns resolution in format like "1920*1080"
	// We want to convert to standard format like "1080p"
	const match = alibabaResolution.match(/(\d+)\*(\d+)/);
	if (match) {
		const [, width, height] = match;
		const widthNum = parseInt(width, 10);
		const heightNum = parseInt(height, 10);

		// Determine if it's landscape or portrait and use the standard height notation
		if (heightNum >= widthNum) {
			// Portrait or square - use height
			return `${heightNum}p`;
		} else {
			// Landscape - use height for standard formats
			return `${heightNum}p`;
		}
	}

	// Fallback to original format if parsing fails
	return alibabaResolution;
}

// Helper function to download and save image from URL
async function downloadAndSaveImage(
	imageUrl: string,
	userId: string,
	chatId?: string
): Promise<string> {
	// Download image from URL
	const response = await fetch(imageUrl);
	if (!response.ok) {
		throw new Error(`Failed to download image: ${response.status}`);
	}

	const imageBuffer = await response.arrayBuffer();
	if (!imageBuffer || imageBuffer.byteLength === 0) {
		throw new Error('No image data received from download');
	}

	// Detect MIME type and extension
	const { mimeType, extension } = getMimeTypeAndExtension(response, 'image/png');

	// Convert ArrayBuffer to base64 for storage service
	const imageBase64 = arrayBufferToBase64(imageBuffer);
	
	// Use the proper storage abstraction layer (supports both R2 and local storage)
	const imageId = await saveImageAndGetId(imageBase64, mimeType, userId, chatId);

	return imageId;
}

// Helper function to download and save video from URL
async function downloadAndSaveVideo(
	videoUrl: string,
	userId: string,
	duration: number,
	resolution: string,
	chatId?: string
): Promise<string> {
	// Download video from URL
	const response = await fetch(videoUrl);
	if (!response.ok) {
		throw new Error(`Failed to download video: ${response.status}`);
	}

	const videoBuffer = await response.arrayBuffer();
	if (!videoBuffer || videoBuffer.byteLength === 0) {
		throw new Error('No video data received from download');
	}

	// Detect MIME type and extension
	const { mimeType, extension } = getMimeTypeAndExtension(response, 'video/mp4');

	// Convert ArrayBuffer to base64 for storage service
	const videoBase64 = arrayBufferToBase64(videoBuffer);
	
	// Use the proper storage abstraction layer (supports both R2 and local storage)
	const videoId = await saveVideoAndGetId(
		videoBase64,
		mimeType,
		userId,
		chatId,
		duration,
		resolution,
		30, // Default FPS for Wan models
		true // Has audio
	);

	return videoId;
}

export const alibabaProvider: AIProvider = {
	name: 'Alibaba',
	models: ALIBABA_MODELS,

	// Note: chat method not implemented for media generation models
	async chat(params: { model: string; messages: AIMessage[]; maxTokens?: number; temperature?: number; stream?: boolean; userId?: string; chatId?: string }): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>> {
		throw new Error('Chat not supported for Alibaba media generation models');
	},

	// Image generation with polling mechanism
	async generateImage(params: ImageGenerationParams): Promise<AIImageResponse> {
		const { model, prompt, userId, chatId } = params;

		// Validate model capabilities
		const modelConfig = ALIBABA_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in Alibaba provider`);
		}

		if (!modelConfig.supportsImageGeneration) {
			throw new Error(`Model ${model} does not support image generation`);
		}

		const apiKey = await getApiKey();
		if (!apiKey) {
			throw new Error('ALIBABA_API_KEY is not configured');
		}

		if (!userId) {
			throw new Error('userId is required for image generation');
		}

		try {
			const endpoint = getEndpointForModel(model);

			// Create the initial request
			const requestBody: AlibabaImageRequestBody = {
				model: model,
				input: {
					prompt: prompt
				}
			};

			// Submit initial request
			const initialResponse = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': apiKey,
					'X-DashScope-Async': 'enable'
				},
				body: JSON.stringify(requestBody)
			});

			if (!initialResponse.ok) {
				const errorText = await initialResponse.text();
				throw new Error(`Alibaba API error: ${initialResponse.status} - ${errorText}`);
			}

			const initialData: AlibabaInitialResponse = await initialResponse.json();

			// Check for API errors
			if (initialData.code && initialData.code !== '200') {
				throw new Error(`Alibaba API error: ${initialData.code} - ${initialData.message || 'Unknown error'}`);
			}

			// Check if we have a task ID
			if (!initialData.output?.task_id) {
				throw new Error('No task ID received from Alibaba API');
			}

			// Poll for completion
			const completionData = await pollForCompletion(initialData.output.task_id, apiKey, model);

			// Extract the image URL from the result
			if (!completionData.output?.results?.[0]?.url) {
				throw new Error('No image URL received from Alibaba API result');
			}

			const imageUrl = completionData.output.results[0].url;

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
			throw new Error(`Alibaba image generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Video generation with polling mechanism
	async generateVideo(params: VideoGenerationParams): Promise<AIVideoResponse> {
		const { model, prompt, userId, chatId } = params;

		// Validate model capabilities
		const modelConfig = ALIBABA_MODELS.find(m => m.name === model);
		if (!modelConfig) {
			throw new Error(`Model ${model} not found in Alibaba provider`);
		}

		if (!modelConfig.supportsVideoGeneration) {
			throw new Error(`Model ${model} does not support video generation`);
		}

		const apiKey = await getApiKey();
		if (!apiKey) {
			throw new Error('ALIBABA_API_KEY is not configured');
		}

		if (!userId) {
			throw new Error('userId is required for video generation');
		}

		try {
			const endpoint = getEndpointForModel(model);

			// Create the initial request body
			const requestBody: AlibabaVideoRequestBody = {
				model: model,
				input: {
					prompt: prompt
				}
			};

			// For i2v model, we need to handle image input
			if (model === 'wan2.2-i2v-plus' && params.imageUrl) {
				requestBody.input.img_url = params.imageUrl;
			}

			// Submit initial request
			const initialResponse = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': apiKey,
					'X-DashScope-Async': 'enable'
				},
				body: JSON.stringify(requestBody)
			});

			if (!initialResponse.ok) {
				const errorText = await initialResponse.text();
				throw new Error(`Alibaba API error: ${initialResponse.status} - ${errorText}`);
			}

			const initialData: AlibabaInitialResponse = await initialResponse.json();

			// Check for API errors
			if (initialData.code && initialData.code !== '200') {
				throw new Error(`Alibaba API error: ${initialData.code} - ${initialData.message || 'Unknown error'}`);
			}

			// Check if we have a task ID
			if (!initialData.output?.task_id) {
				throw new Error('No task ID received from Alibaba API');
			}

			// Poll for completion
			const completionData = await pollForCompletion(initialData.output.task_id, apiKey, model);

			// Extract the video URL from the result
			if (!completionData.output?.video_url) {
				throw new Error('No video URL received from Alibaba API result');
			}

			const videoUrl = completionData.output.video_url;
			const duration = completionData.usage?.video_duration || 5;
			const rawResolution = completionData.usage?.video_ratio || '1920*1080';
			const resolution = parseResolution(rawResolution);

			// Download and save the video
			const videoId = await downloadAndSaveVideo(videoUrl, userId, duration, resolution, chatId);

			return {
				videoId,
				mimeType: 'video/mp4',
				prompt,
				model,
				duration,
				resolution,
				fps: 30,
				hasAudio: true,
				usage: {
					promptTokens: prompt.length / 4, // Rough estimate
					totalTokens: prompt.length / 4
				}
			};
		} catch (error) {
			throw new Error(`Alibaba video generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
};
import OpenAI from 'openai';
import type { AIProvider, AIModelConfig, AIMessage, AIResponse, AIStreamChunk, ChatCompletionParams, ArchitectureObject, AITool, AIToolResult } from '../types.js';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db/index.js';
import { images } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { executeTool } from '../tools/index.js';
import { getOpenRouterApiKey } from '$lib/server/settings-store.js';
import { storageService } from '$lib/server/storage.js';

// Get API key from database or fallback to environment variable
async function getApiKey(): Promise<string> {
	try {
		const dbKey = await getOpenRouterApiKey();
		return dbKey || env.OPENROUTER_API_KEY || '';
	} catch (error) {
		console.warn('Failed to get OpenRouter API key from database, using environment variable:', error);
		return env.OPENROUTER_API_KEY || '';
	}
}

// Initialize OpenAI client - will be recreated if needed when API key changes
let openai: OpenAI | null = null;
let currentApiKey: string | null = null;

async function getOpenAIClient(): Promise<OpenAI> {
	const apiKey = await getApiKey();

	if (!openai || currentApiKey !== apiKey) {
		currentApiKey = apiKey;
		openai = new OpenAI({
			baseURL: 'https://openrouter.ai/api/v1',
			apiKey,
			defaultHeaders: {
				'HTTP-Referer': 'https://localhost:5173', // Optional: your site URL
				'X-Title': 'CC AI Models' // Optional: your site name
			}
		});
	}

	return openai;
}

const OPENROUTER_MODELS: AIModelConfig[] = [
	{
		name: 'anthropic/claude-opus-4.1',
		displayName: 'Claude Opus 4.1',
		provider: 'Anthropic',
		maxTokens: 8192,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'anthropic/claude-sonnet-4',
		displayName: 'Claude Sonnet 4',
		provider: 'Anthropic',
		maxTokens: 8192,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'anthropic/claude-3.7-sonnet',
		displayName: 'Claude Sonnet 3.7',
		provider: 'Anthropic',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'anthropic/claude-3.5-haiku',
		displayName: 'Claude Haiku 3.5',
		provider: 'Anthropic',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'openai/gpt-5',
		displayName: 'GPT-5',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsImageInput: true,
		supportsFunctions: true
	},
	{
		name: 'openai/gpt-5-mini',
		displayName: 'GPT-5-Mini',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsImageInput: true,
		supportsFunctions: true
	},
	{
		name: 'openai/gpt-5-nano',
		displayName: 'GPT-5-Nano',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsImageInput: true,
		supportsFunctions: true
	},
	{
		name: 'openai/gpt-5-chat',
		displayName: 'GPT-5-Chat',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsImageInput: true,
		supportsFunctions: true
	},
	{
		name: 'openai/gpt-4.1-mini',
		displayName: 'GPT-4.1 Mini',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsImageInput: true,
		supportsFunctions: true
	},
	{
		name: 'openai/o3-mini',
		displayName: 'GPT-o3 Mini',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'openai/o1',
		displayName: 'GPT-o1',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'openai/gpt-4o-mini',
		displayName: 'GPT-4o Mini',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'openai/gpt-oss-20b:free',
		displayName: 'GPT OSS 20B (free)',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsStreaming: true
	},
	{
		name: 'google/gemini-2.5-pro',
		displayName: 'Gemini 2.5 Pro',
		provider: 'Google',
		maxTokens: 8192,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'google/gemini-2.5-flash',
		displayName: 'Gemini 2.5 Flash',
		provider: 'Google',
		maxTokens: 8192,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'google/gemini-2.5-flash-lite',
		displayName: 'Gemini 2.5 Flash Lite',
		provider: 'Google',
		maxTokens: 8192,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'meta-llama/llama-4-maverick',
		displayName: 'Llama 4 Maverick',
		provider: 'Meta',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'meta-llama/llama-4-scout',
		displayName: 'Llama 4 Scout',
		provider: 'Meta',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'deepseek/deepseek-r1-0528',
		displayName: 'DeepSeek R1',
		provider: 'DeepSeek',
		maxTokens: 4096,
		supportsStreaming: true
	},
	{
		name: 'deepseek/deepseek-r1-0528:free',
		displayName: 'DeepSeek R1 (free)',
		provider: 'DeepSeek',
		maxTokens: 4096,
		supportsStreaming: true
	},
	{
		name: 'deepseek/deepseek-chat-v3.1:free',
		displayName: 'DeepSeek V3.1 (free)',
		provider: 'DeepSeek',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'x-ai/grok-4',
		displayName: 'Grok 4',
		provider: 'xAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'x-ai/grok-3',
		displayName: 'Grok 3',
		provider: 'xAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'x-ai/grok-3-mini',
		displayName: 'Grok 3 Mini',
		provider: 'xAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'x-ai/grok-code-fast-1',
		displayName: 'Grok Code Fast 1',
		provider: 'xAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'x-ai/grok-4-fast:free',
		displayName: 'Grok 4 Fast (free)',
		provider: 'xAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'qwen/qwen3-coder',
		displayName: 'Qwen3 Coder',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'qwen/qwen3-235b-a22b-thinking-2507',
		displayName: 'Qwen3 Thinking',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsStreaming: true
	},
	{
		name: 'qwen/qwen3-30b-a3b',
		displayName: 'Qwen3 30B A3B',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'moonshotai/kimi-k2-0905',
		displayName: 'Kimi K2 0905',
		provider: 'Moonshot',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'moonshotai/kimi-k2:free',
		displayName: 'Kimi K2 (free)',
		provider: 'Moonshot',
		maxTokens: 4096,
		supportsStreaming: true
	},
	{
		name: 'mistralai/mistral-nemo',
		displayName: 'Mistral Nemo',
		provider: 'Mistral',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'mistralai/mistral-small-3.2-24b-instruct',
		displayName: 'Mistral Small 3.2',
		provider: 'Mistral',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'z-ai/glm-4.5',
		displayName: 'GLM 4.5',
		provider: 'ZAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'z-ai/glm-4.5-air',
		displayName: 'GLM 4.5 Air',
		provider: 'ZAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	},
	{
		name: 'z-ai/glm-4.5-air:free',
		displayName: 'GLM 4.5 Air (free)',
		provider: 'ZAI',
		maxTokens: 4096,
		supportsStreaming: true,
		supportsFunctions: true
	}
];

// Interface for OpenRouter API model response
interface OpenRouterModel {
	id: string;
	name: string;
	architecture: ArchitectureObject;
	// Other fields we don't need for now
}

interface OpenRouterModelsResponse {
	data: OpenRouterModel[];
}

// Function to enrich hardcoded models with architecture data from OpenRouter API
async function enrichModelsWithArchitecture(models: AIModelConfig[]): Promise<AIModelConfig[]> {
	try {
		console.log('Fetching architecture data from OpenRouter API...');

		const response = await fetch('https://openrouter.ai/api/v1/models', {
			headers: {
				'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
				'HTTP-Referer': 'https://localhost:5173',
				'X-Title': 'CC AI Models'
			}
		});

		if (!response.ok) {
			console.warn(`OpenRouter API returned ${response.status}: ${response.statusText}`);
			return models; // Return original models on API failure
		}

		const apiData: OpenRouterModelsResponse = await response.json();
		console.log(`Fetched ${apiData.data.length} models from OpenRouter API`);

		// Create a map of API models by their ID for efficient lookup
		const apiModelMap = new Map<string, ArchitectureObject>();
		apiData.data.forEach(apiModel => {
			if (apiModel.architecture) {
				apiModelMap.set(apiModel.id, apiModel.architecture);
			}
		});

		// Enrich hardcoded models with architecture data
		const enrichedModels = models.map(model => {
			const architectureData = apiModelMap.get(model.name);
			if (architectureData) {
				console.log(`Enriched ${model.name} with architecture data:`, architectureData);
				return {
					...model,
					architecture: architectureData
				};
			}
			return model; // Return original model if no architecture data found
		});

		console.log(`Successfully enriched ${enrichedModels.filter(m => m.architecture).length} models with architecture data`);
		return enrichedModels;

	} catch (error) {
		console.error('Failed to fetch architecture data from OpenRouter API:', error);
		return models; // Return original models on error
	}
}

function convertMessages(messages: AIMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
	return messages.map(msg => {
		if (msg.role === 'tool') {
			// Tool result message - content cannot be null
			return {
				role: 'tool' as const,
				tool_call_id: msg.tool_call_id!,
				content: msg.content || 'No content provided'
			};
		} else if (msg.role === 'assistant' && msg.tool_calls) {
			// Assistant message with tool calls
			return {
				role: 'assistant' as const,
				content: msg.content || null, // OpenAI allows null for assistant messages with tool calls
				tool_calls: msg.tool_calls.map(tc => ({
					id: tc.id,
					type: 'function' as const,
					function: {
						name: tc.function.name,
						arguments: tc.function.arguments
					}
				}))
			};
		} else if (msg.role === 'assistant') {
			// Regular assistant message
			return {
				role: 'assistant' as const,
				content: msg.content || 'No response provided'
			};
		} else if (msg.role === 'user') {
			// User message
			return {
				role: 'user' as const,
				content: msg.content || 'No message provided'
			};
		} else if (msg.role === 'system') {
			// System message
			return {
				role: 'system' as const,
				content: msg.content || 'No system message provided'
			};
		} else {
			// Fallback for any other cases
			return {
				role: 'user' as const,
				content: msg.content || 'No message provided'
			};
		}
	});
}

// Utility function to fetch image data by ID and convert to base64
async function getImageDataById(imageId: string, userId: string): Promise<{ data: string; mimeType: string } | null> {
	try {
		// Query database to get image metadata and verify ownership
		const [imageRecord] = await db
			.select()
			.from(images)
			.where(eq(images.id, imageId));

		if (!imageRecord || imageRecord.userId !== userId) {
			console.error(`Image not found or access denied for ID: ${imageId}`);
			return null;
		}

		// Handle cloud storage files (R2)
		if (imageRecord.storageLocation === 'r2' && imageRecord.cloudPath) {
			try {
				const imageData = await storageService.download(imageRecord.cloudPath);
				const base64Data = imageData.toString('base64');

				return {
					data: base64Data,
					mimeType: imageRecord.mimeType
				};
			} catch (error) {
				console.error(`Error downloading image from cloud storage: ${imageRecord.cloudPath}`, error);
				return null;
			}
		}

		// Handle local storage files
		if (imageRecord.storageLocation === 'local') {
			// For local files, use the cloudPath if available (contains the full path)
			// or construct the path using the expected storage structure
			const storagePath = imageRecord.cloudPath ||
				storageService.generateFilePath(userId, 'images', imageRecord.filename, 'generated');

			try {
				const imageData = await storageService.download(storagePath);
				const base64Data = imageData.toString('base64');

				return {
					data: base64Data,
					mimeType: imageRecord.mimeType
				};
			} catch (error) {
				console.error(`Error downloading image from local storage: ${storagePath}`, error);
				return null;
			}
		}

		console.error(`Unknown storage location: ${imageRecord.storageLocation} for image ID: ${imageId}`);
		return null;
	} catch (error) {
		console.error('Error fetching image data:', error);
		return null;
	}
}

// Convert messages for multimodal chat with image support
async function convertMultimodalMessages(messages: AIMessage[], userId?: string): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> {
	const convertedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

	for (const msg of messages) {
		if (msg.role === 'user' && (msg.imageId || msg.imageData || msg.imageIds || msg.images)) {
			// Handle messages with images (single or multiple)
			const content: OpenAI.Chat.ChatCompletionContentPart[] = [];

			// Add text content if present
			if (msg.content) {
				content.push({
					type: 'text',
					text: msg.content
				});
			}

			// Handle multiple images (new format)
			if (msg.images && msg.images.length > 0) {
				for (const image of msg.images) {
					if (image.imageData && image.mimeType) {
						// Use base64 data directly
						content.push({
							type: 'image_url',
							image_url: {
								url: `data:${image.mimeType};base64,${image.imageData}`
							}
						});
					} else if (image.imageId && userId) {
						// Fetch image data from database and convert to base64
						const imageData = await getImageDataById(image.imageId, userId);
						if (imageData) {
							content.push({
								type: 'image_url',
								image_url: {
									url: `data:${imageData.mimeType};base64,${imageData.data}`
								}
							});
						} else {
							console.error(`Failed to fetch image data for imageId: ${image.imageId}`);
						}
					}
				}
			} else if (msg.imageIds && msg.imageIds.length > 0 && userId) {
				// Handle multiple image IDs
				for (const imageId of msg.imageIds) {
					const imageData = await getImageDataById(imageId, userId);
					if (imageData) {
						content.push({
							type: 'image_url',
							image_url: {
								url: `data:${imageData.mimeType};base64,${imageData.data}`
							}
						});
					} else {
						console.error(`Failed to fetch image data for imageId: ${imageId}`);
					}
				}
			} else {
				// Handle single image (backwards compatibility)
				if (msg.imageData && msg.mimeType) {
					// Use base64 data directly
					content.push({
						type: 'image_url',
						image_url: {
							url: `data:${msg.mimeType};base64,${msg.imageData}`
						}
					});
				} else if (msg.imageId && userId) {
					// Fetch image data from database and convert to base64
					const imageData = await getImageDataById(msg.imageId, userId);
					if (imageData) {
						content.push({
							type: 'image_url',
							image_url: {
								url: `data:${imageData.mimeType};base64,${imageData.data}`
							}
						});
					} else {
						console.error(`Failed to fetch image data for imageId: ${msg.imageId}`);
					}
				}
			}

			convertedMessages.push({
				role: msg.role,
				content: content
			} as OpenAI.Chat.ChatCompletionUserMessageParam);
		} else {
			// Regular text message - need proper type handling
			if (msg.role === 'tool') {
				// Tool message must have tool_call_id
				convertedMessages.push({
					role: 'tool' as const,
					tool_call_id: msg.tool_call_id || 'unknown',
					content: msg.content || 'No content provided'
				});
			} else if (msg.role === 'assistant') {
				// Assistant message
				convertedMessages.push({
					role: 'assistant' as const,
					content: msg.content || 'No response provided'
				});
			} else if (msg.role === 'user') {
				// User message
				convertedMessages.push({
					role: 'user' as const,
					content: msg.content || 'No message provided'
				});
			} else if (msg.role === 'system') {
				// System message
				convertedMessages.push({
					role: 'system' as const,
					content: msg.content || 'No system message provided'
				});
			} else {
				// Fallback to user message
				convertedMessages.push({
					role: 'user' as const,
					content: msg.content || 'No message provided'
				});
			}
		}
	}

	return convertedMessages;
}

// Initialize with hardcoded models, will be enriched asynchronously
let enrichedModels: AIModelConfig[] = OPENROUTER_MODELS;

// Promise to track enrichment completion
let enrichmentPromise: Promise<void> | null = null;
let enrichmentCompleted = false;

// Initialize architecture data enrichment
async function initializeModels() {
	try {
		enrichedModels = await enrichModelsWithArchitecture(OPENROUTER_MODELS);
		console.log('OpenRouter models enriched with architecture data');
		enrichmentCompleted = true;
	} catch (error) {
		console.error('Failed to initialize OpenRouter models with architecture data:', error);
		enrichmentCompleted = true; // Mark as completed even on error to prevent hanging
	}
}

// Start enrichment process (non-blocking) and track with Promise
enrichmentPromise = initializeModels();

// Export function to wait for enrichment completion with timeout
export async function waitForEnrichmentCompletion(timeoutMs: number = 10000): Promise<boolean> {
	if (enrichmentCompleted) {
		return true;
	}

	if (!enrichmentPromise) {
		return false;
	}

	try {
		// Race between enrichment completion and timeout
		await Promise.race([
			enrichmentPromise,
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Enrichment timeout')), timeoutMs)
			)
		]);
		return true;
	} catch (error) {
		console.warn('Enrichment timeout or error, proceeding with basic models:', error);
		return false;
	}
}

export const openRouterProvider: AIProvider = {
	name: 'OpenRouter',
	get models() {
		return enrichedModels;
	},

	async chat(params: ChatCompletionParams): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>> {
		const { model, messages, maxTokens = 1024, temperature = 0.7, stream = false, tools } = params;

		// If tools are provided and model supports functions, use tool calling
		if (tools && tools.length > 0) {
			// Check if model supports functions
			const modelConfig = enrichedModels.find(m => m.name === model);
			if (modelConfig?.supportsFunctions) {
				// Using tool calling for function-capable model
				return this.chatWithTools!({
					model,
					messages,
					tools,
					maxTokens,
					temperature,
					userId: params.userId,
					chatId: params.chatId
				});
			} else {
				// Model does not support functions, ignoring tools
			}
		}

		const openaiMessages = convertMessages(messages);

		const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
			model,
			messages: openaiMessages,
			max_tokens: maxTokens,
			temperature,
			stream,
			...(tools && tools.length > 0 && {
				tools: tools.map(tool => ({
					type: 'function' as const,
					function: tool.function
				}))
			})
		};

		if (stream) {
			return createStreamIterator(requestParams);
		}

		try {
			const client = await getOpenAIClient();
			const response = await client.chat.completions.create(requestParams) as OpenAI.Chat.ChatCompletion;
			const choice = response.choices[0];

			if (!choice || !choice.message.content) {
				throw new Error('No response content received from OpenRouter');
			}

			return {
				content: choice.message.content,
				usage: response.usage ? {
					promptTokens: response.usage.prompt_tokens,
					completionTokens: response.usage.completion_tokens,
					totalTokens: response.usage.total_tokens
				} : undefined,
				model: response.model,
				finishReason: choice.finish_reason as AIResponse['finishReason'],
				tool_calls: choice.message.tool_calls?.filter(tc => tc.type === 'function').map(tc => ({
					id: tc.id,
					type: 'function' as const,
					function: {
						name: tc.function.name,
						arguments: tc.function.arguments || '{}'
					}
				}))
			};
		} catch (error) {
			throw new Error(`OpenRouter API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Multimodal chat method for vision models
	async chatMultimodal(params: {
		model: string;
		messages: AIMessage[];
		maxTokens?: number;
		temperature?: number;
		userId?: string;
		chatId?: string;
		tools?: AITool[];
	}): Promise<AIResponse> {
		const { model, messages, maxTokens = 2000, temperature = 0.7, tools } = params;

		// Debug: Multimodal chat request (removed verbose logging)

		// Convert messages to multimodal format
		const multimodalMessages = await convertMultimodalMessages(messages, params.userId);

		// Debug: Message conversion completed

		const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
			model,
			messages: multimodalMessages,
			max_tokens: maxTokens,
			temperature,
			...(tools && tools.length > 0 && {
				tools: tools.map(tool => ({
					type: 'function' as const,
					function: tool.function
				}))
			})
		};

		try {
			const client = await getOpenAIClient();
			const response = await client.chat.completions.create(requestParams) as OpenAI.Chat.ChatCompletion;
			const choice = response.choices[0];

			if (!choice || !choice.message.content) {
				throw new Error('No response content received from OpenRouter multimodal API');
			}

			return {
				content: choice.message.content,
				usage: response.usage ? {
					promptTokens: response.usage.prompt_tokens,
					completionTokens: response.usage.completion_tokens,
					totalTokens: response.usage.total_tokens
				} : undefined,
				model: response.model,
				finishReason: choice.finish_reason as AIResponse['finishReason'],
				tool_calls: choice.message.tool_calls?.filter(tc => tc.type === 'function').map(tc => ({
					id: tc.id,
					type: 'function' as const,
					function: {
						name: tc.function.name,
						arguments: tc.function.arguments || '{}'
					}
				}))
			};
		} catch (error) {
			console.error('OpenRouter multimodal API error:', error);
			throw new Error(`OpenRouter multimodal API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Tool calling method implementing OpenRouter's 3-step pattern
	async chatWithTools(params: {
		model: string;
		messages: AIMessage[];
		tools: AITool[];
		maxTokens?: number;
		temperature?: number;
		userId?: string;
		chatId?: string;
	}): Promise<AIResponse> {
		const { model, messages, tools, maxTokens = 2000, temperature = 0.7 } = params;

		// Debug: Tool calling request initiated

		try {
			// Step 1: Initial request with tools
			const openaiMessages = convertMessages(messages);
			const openaiTools = tools.map(tool => ({
				type: 'function' as const,
				function: tool.function
			}));

			const initialRequestParams: OpenAI.Chat.ChatCompletionCreateParams = {
				model,
				messages: openaiMessages,
				max_tokens: maxTokens,
				temperature,
				tools: openaiTools
			};

			// Step 1: Sending initial request with tools

			const client = await getOpenAIClient();
			const initialResponse = await client.chat.completions.create(initialRequestParams) as OpenAI.Chat.ChatCompletion;
			const initialChoice = initialResponse.choices[0];

			if (!initialChoice) {
				throw new Error('No response received from OpenRouter API');
			}

			// Check if the model made tool calls
			if (initialChoice.message.tool_calls && initialChoice.message.tool_calls.length > 0) {
				// Step 2: Execute requested tools
				const toolResults: AIToolResult[] = [];

				// Filter to only function-type tool calls
				const functionCalls = initialChoice.message.tool_calls.filter(tc => tc.type === 'function');

				for (const toolCall of functionCalls) {
					try {
						// Executing tool: ${toolCall.function.name}

						const args = JSON.parse(toolCall.function.arguments || '{}');
						const result = await executeTool(toolCall.function.name, args);

						toolResults.push({
							role: 'tool',
							tool_call_id: toolCall.id,
							name: toolCall.function.name,
							content: result
						});

						// Tool executed successfully
					} catch (error) {
						console.error(`Error executing tool ${toolCall.function.name}:`, error);
						toolResults.push({
							role: 'tool',
							tool_call_id: toolCall.id,
							name: toolCall.function.name,
							content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
						});
					}
				}

				// Step 3: Send tool results back to model
				const updatedMessages: AIMessage[] = [
					...messages,
					{
						role: 'assistant',
						content: initialChoice.message.content,
						tool_calls: functionCalls.map(tc => ({
							id: tc.id,
							type: 'function' as const,
							function: {
								name: tc.function.name,
								arguments: tc.function.arguments || '{}'
							}
						}))
					},
					...toolResults
				];

				const finalRequestParams: OpenAI.Chat.ChatCompletionCreateParams = {
					model,
					messages: convertMessages(updatedMessages),
					max_tokens: maxTokens,
					temperature,
					tools: openaiTools // Must include tools in final request per OpenRouter docs
				};

				// Step 3: Sending tool results back to model

				const client2 = await getOpenAIClient();
				const finalResponse = await client2.chat.completions.create(finalRequestParams) as OpenAI.Chat.ChatCompletion;
				const finalChoice = finalResponse.choices[0];

				if (!finalChoice || !finalChoice.message.content) {
					throw new Error('No final response content received from OpenRouter API');
				}

				return {
					content: finalChoice.message.content,
					usage: finalResponse.usage ? {
						promptTokens: finalResponse.usage.prompt_tokens,
						completionTokens: finalResponse.usage.completion_tokens,
						totalTokens: finalResponse.usage.total_tokens
					} : undefined,
					model: finalResponse.model,
					finishReason: finalChoice.finish_reason as AIResponse['finishReason']
				};

			} else {
				// No tool calls requested, return initial response
				return {
					content: initialChoice.message.content || '',
					usage: initialResponse.usage ? {
						promptTokens: initialResponse.usage.prompt_tokens,
						completionTokens: initialResponse.usage.completion_tokens,
						totalTokens: initialResponse.usage.total_tokens
					} : undefined,
					model: initialResponse.model,
					finishReason: initialChoice.finish_reason as AIResponse['finishReason']
				};
			}

		} catch (error) {
			console.error('OpenRouter tool calling error:', error);
			throw new Error(`OpenRouter tool calling error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
};

async function* createStreamIterator(params: OpenAI.Chat.ChatCompletionCreateParams): AsyncIterableIterator<AIStreamChunk> {
	try {
		const streamParams = { ...params, stream: true };
		const client = await getOpenAIClient();
		const stream = await client.chat.completions.create(streamParams);

		// Type assertion for streaming response
		const streamIterable = stream as any;
		for await (const chunk of streamIterable) {
			const choice = chunk.choices[0];

			if (choice?.delta?.content) {
				yield {
					content: choice.delta.content,
					done: false
				};
			}

			if (choice?.finish_reason) {
				yield {
					content: '',
					done: true,
					usage: chunk.usage ? {
						promptTokens: chunk.usage.prompt_tokens,
						completionTokens: chunk.usage.completion_tokens,
						totalTokens: chunk.usage.total_tokens
					} : undefined
				};
				break;
			}
		}
	} catch (error) {
		throw new Error(`OpenRouter streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
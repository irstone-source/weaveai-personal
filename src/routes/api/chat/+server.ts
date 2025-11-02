import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getModelProvider } from '$lib/ai/index.js';
import type { AIMessage, AITool } from '$lib/ai/types.js';
import { getAllTools, getTools } from '$lib/ai/tools/index.js';
import { UsageTrackingService, UsageLimitError } from '$lib/server/usage-tracking.js';
import { GUEST_MESSAGE_LIMIT, isModelAllowedForGuests } from '$lib/constants/guest-limits.js';
import { isDemoModeRestricted, isModelAllowedForDemo, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';
import { enhanceChatWithClientContext } from '$lib/server/integrations/client-rag-service.js';

// Extend Vercel serverless function timeout for long-running AI requests
export const config = {
	maxDuration: 60 // 60 seconds (maximum for Hobby plan)
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { model, messages, maxTokens, temperature, stream, userId, chatId, multimodal, selectedTool, tools } = body;

		if (!model) {
			return json({ error: 'Model is required' }, { status: 400 });
		}

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return json({ error: 'Messages array is required and cannot be empty' }, { status: 400 });
		}

		// Get user session to check authentication status
		const session = await locals.getSession();
		const isLoggedIn = !!session?.user?.id;

		// Validate guest user restrictions
		if (!isLoggedIn) {
			// Check guest message limit (count user messages only)
			const userMessages = messages.filter(msg => msg.role === 'user');
			if (userMessages.length > GUEST_MESSAGE_LIMIT) {
				return json({
					error: `Guest users are limited to ${GUEST_MESSAGE_LIMIT} messages. Please sign up for an account to continue.`,
					type: 'guest_limit_exceeded'
				}, { status: 429 });
			}

			// Check guest model restriction
			if (!isModelAllowedForGuests(model)) {
				return json({
					error: 'Guest users can only use the allowed guest models. Please sign up for access to all models.',
					type: 'guest_model_restricted'
				}, { status: 403 });
			}
		}

		// Validate demo mode restrictions for logged-in users
		if (isLoggedIn && isDemoModeRestricted(isLoggedIn)) {
			// Check demo mode model restriction
			if (!isModelAllowedForDemo(model)) {
				return json({
					error: DEMO_MODE_MESSAGES.MODEL_RESTRICTED,
					type: 'demo_model_restricted'
				}, { status: 403 });
			}
		}

		// Check usage limits for text generation (if userId provided)
		if (userId) {
			try {
				await UsageTrackingService.checkUsageLimit(userId, 'text');
			} catch (error) {
				if (error instanceof UsageLimitError) {
					return json({
						error: error.message,
						type: 'usage_limit_exceeded',
						remainingQuota: error.remainingQuota
					}, { status: 429 });
				}
				throw error; // Re-throw other errors
			}
		}

		// RAG Enhancement: Add Linear client context to messages if user is logged in
		let ragContexts: any[] = [];
		if (isLoggedIn && userId) {
			try {
				const userMessage = messages[messages.length - 1]?.content;
				const conversationHistory = messages.slice(0, -1);

				// Only enhance if there's a user message and it's text-based
				if (userMessage && typeof userMessage === 'string') {
					const { enhancedPrompt, contexts } = await enhanceChatWithClientContext(
						userId,
						userMessage,
						conversationHistory,
						{
							topK: 5
						}
					);

					// If contexts found, replace the last message with enhanced version
					if (contexts.length > 0) {
						messages[messages.length - 1] = {
							...messages[messages.length - 1],
							content: enhancedPrompt
						};
						ragContexts = contexts;
						console.log(`[Chat API] Enhanced with ${contexts.length} contexts from Linear`);
					}
				}
			} catch (error) {
				// RAG enhancement failed - continue without it
				console.warn('[Chat API] RAG enhancement failed:', error);
			}
		}

		const provider = getModelProvider(model);
		if (!provider) {
			return json({ error: `No provider found for model: ${model}` }, { status: 400 });
		}

		// Find the model configuration to check its capabilities
		const modelConfig = provider.models.find(m => m.name === model);

		// Determine which tools to use
		let toolsToUse: AITool[] = [];
		if (selectedTool) {
			// Single tool selected via UI
			toolsToUse = getTools([selectedTool]);
			console.log(`Using selected tool: ${selectedTool}`);
		} else if (tools && Array.isArray(tools)) {
			// Tools explicitly provided in request
			toolsToUse = tools;
		}

		// Check if model supports functions when tools are requested
		if (toolsToUse.length > 0 && !modelConfig?.supportsFunctions) {
			console.warn(`Model ${model} does not support functions, tools will be ignored`);
			toolsToUse = [];
		}

		// Check if this is a multimodal request or if any messages contain images
		const hasImageContent = multimodal || messages.some((msg: any) =>
			msg.imageId || msg.imageData || msg.imageIds || msg.images ||
			(msg.role === 'user' && msg.type === 'image')
		);

		// Check if this is a Google Gemini model (Gemini models use chatMultimodal, Imagen models use regular chat)
		const isGoogleGeminiModel = provider.name === 'Google Gemini';

		// Helper function to detect if a Gemini model is being used for pure image generation
		// (text-only prompt with no existing conversation context, for image generation capable models)
		const isGeminiPureImageGeneration = () => {
			if (!isGoogleGeminiModel || !model.includes('gemini')) return false;
			if (hasImageContent) return false; // If there are images, use multimodal chat
			if (!modelConfig?.supportsImageGeneration) return false; // Must support image generation

			// Check if this is a simple text prompt for image generation
			// (single user message or conversation ending with user request)
			const userMessages = messages.filter(msg => msg.role === 'user');
			const lastMessage = userMessages[userMessages.length - 1];

			// If it's the first message or the last message is a user message requesting image generation
			return userMessages.length === 1 || (lastMessage && messages[messages.length - 1].role === 'user');
		};

		// Check if this is a Gemini model being used for pure image generation
		// Route to generateImage method to ensure proper usage tracking as 'image'
		if (isGeminiPureImageGeneration() && provider.generateImage) {
			// Extract the prompt from the last user message
			const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
			if (!lastUserMessage || !lastUserMessage.content) {
				return json({ error: 'No user message found for image generation' }, { status: 400 });
			}

			try {
				const imageResult = await provider.generateImage({
					model,
					prompt: lastUserMessage.content,
					userId,
					chatId
				});

				// Track usage for successful image generation
				if (userId) {
					UsageTrackingService.trackUsage(userId, 'image').catch(console.error);
				}

				return json(imageResult);
			} catch (error) {
				console.error('Gemini image generation error:', error);
				return json(
					{ error: error instanceof Error ? error.message : 'Image generation failed' },
					{ status: 500 }
				);
			}
		}

		// Use multimodal chat for image-enabled requests OR Gemini models in multimodal conversation context
		if ((hasImageContent || (isGoogleGeminiModel && model.includes('gemini') && !isGeminiPureImageGeneration())) && provider.chatMultimodal) {
			try {
				const response = await provider.chatMultimodal({
					model,
					messages: messages as AIMessage[],
					maxTokens,
					temperature,
					userId,
					chatId,
					tools: toolsToUse.length > 0 ? toolsToUse : undefined
				});

				// Track usage for successful multimodal request
				if (userId) {
					UsageTrackingService.trackUsage(userId, 'text').catch(console.error);
				}

				return json(response);
			} catch (error) {
				console.error('Multimodal chat error:', error);
				return json(
					{ error: error instanceof Error ? error.message : 'Multimodal chat failed' },
					{ status: 500 }
				);
			}
		}

		// Check if this is a video generation request
		if (modelConfig?.supportsVideoGeneration && provider.generateVideo) {
			// Extract the prompt from the last user message
			const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
			if (!lastUserMessage) {
				return json({ error: 'No user message found for video generation' }, { status: 400 });
			}

			try {
				const videoResponse = await provider.generateVideo({
					model,
					prompt: lastUserMessage.content,
					userId,
					chatId
				});

				// Track usage for successful video generation
				if (userId) {
					UsageTrackingService.trackUsage(userId, 'video').catch(console.error);
				}

				return json(videoResponse);
			} catch (error) {
				console.error('Video generation error:', error);
				return json(
					{ error: error instanceof Error ? error.message : 'Video generation failed' },
					{ status: 500 }
				);
			}
		}

		const response = await provider.chat({
			model,
			messages: messages as AIMessage[],
			maxTokens,
			temperature,
			stream,
			userId,
			chatId,
			tools: toolsToUse.length > 0 ? toolsToUse : undefined
		});

		if (stream) {
			// Handle streaming response
			const encoder = new TextEncoder();
			const readable = new ReadableStream({
				async start(controller) {
					try {
						for await (const chunk of response as AsyncIterableIterator<any>) {
							const data = `data: ${JSON.stringify(chunk)}\n\n`;
							controller.enqueue(encoder.encode(data));

							if (chunk.done) {
								// Track usage for successful streaming completion
								if (userId) {
									UsageTrackingService.trackUsage(userId, 'text').catch(console.error);
								}
								controller.enqueue(encoder.encode('data: [DONE]\n\n'));
								break;
							}
						}
					} catch (error) {
						const errorData = `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`;
						controller.enqueue(encoder.encode(errorData));
					} finally {
						controller.close();
					}
				}
			});

			return new Response(readable, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					'Connection': 'keep-alive'
				}
			});
		}

		// Handle tool calls if present (agentic loop)
		const typedResponse = response as any;
		if (typedResponse.tool_calls && Array.isArray(typedResponse.tool_calls) && typedResponse.tool_calls.length > 0) {
			console.log('[Chat API] Tool calls detected:', typedResponse.tool_calls.length);

			// Execute each tool call
			const toolResults: any[] = [];
			for (const toolCall of typedResponse.tool_calls) {
				console.log('[Chat API] Executing tool:', toolCall.function?.name);

				try {
					// Make request to tool execution API
					const toolResponse = await fetch(`${request.url.origin}/api/tools/execute`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							toolName: toolCall.function?.name,
							args: {
								...toolCall.function?.arguments,
								userId: userId || session?.user?.id // Inject userId for Linear tools
							}
						})
					});

					const toolResult = await toolResponse.json();

					if (toolResult.success) {
						console.log('[Chat API] Tool executed successfully:', toolCall.function?.name);
						toolResults.push({
							tool_call_id: toolCall.id,
							role: 'tool',
							name: toolCall.function?.name,
							content: toolResult.result
						});
					} else {
						console.error('[Chat API] Tool execution failed:', toolResult.error);
						toolResults.push({
							tool_call_id: toolCall.id,
							role: 'tool',
							name: toolCall.function?.name,
							content: `Error: ${toolResult.error}`
						});
					}
				} catch (error) {
					console.error('[Chat API] Tool execution error:', error);
					toolResults.push({
						tool_call_id: toolCall.id,
						role: 'tool',
						name: toolCall.function?.name,
						content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
					});
				}
			}

			// Add assistant message with tool calls
			const updatedMessages = [
				...messages,
				{
					role: 'assistant',
					content: typedResponse.content || null,
					tool_calls: typedResponse.tool_calls
				},
				...toolResults
			];

			// Make another chat request with tool results
			console.log('[Chat API] Sending tool results back to AI');
			const finalResponse = await provider.chat({
				model,
				messages: updatedMessages as AIMessage[],
				maxTokens,
				temperature,
				stream: false, // Don't stream when processing tool results
				userId,
				chatId,
				tools: toolsToUse.length > 0 ? toolsToUse : undefined
			});

			// Track usage for successful text generation (with tool execution)
			if (userId) {
				UsageTrackingService.trackUsage(userId, 'text').catch(console.error);
			}

			return json({
				...finalResponse,
				tool_calls_executed: toolResults.length,
				tool_results: toolResults
			});
		}

		// Track usage for successful text generation (non-streaming, no tools)
		if (userId) {
			UsageTrackingService.trackUsage(userId, 'text').catch(console.error);
		}

		return json(response);

	} catch (error) {
		console.error('Chat API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
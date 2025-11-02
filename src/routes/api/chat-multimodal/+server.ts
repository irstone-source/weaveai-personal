import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getModelProvider } from '$lib/ai/index.js';
import type { AIResponse, AIImageResponse, AIMessage } from '$lib/ai/types.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const body = await request.json();
		const { model, messages, maxTokens, temperature } = body;

		if (!model) {
			return json({ error: 'Model is required' }, { status: 400 });
		}

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return json({ error: 'Messages array is required and cannot be empty' }, { status: 400 });
		}

		const provider = getModelProvider(model);
		if (!provider) {
			return json({ error: `No provider found for model: ${model}` }, { status: 400 });
		}

		if (!provider.chatMultimodal) {
			return json({ 
				error: `Model ${model} does not support multimodal chat. This model may not have vision capabilities or the provider hasn't implemented multimodal support.` 
			}, { status: 400 });
		}

		const response = await provider.chatMultimodal({
			model,
			messages: messages as AIMessage[],
			maxTokens,
			temperature,
			userId: session.user.id
		});

		return json(response);

	} catch (error) {
		console.error('Multimodal chat API error:', error);
		
		// Extract more user-friendly error messages
		let errorMessage = 'Internal server error';
		if (error instanceof Error) {
			errorMessage = error.message;
			
			// Handle specific error types with better messages
			if (errorMessage.includes('Content blocked by Gemini safety filters')) {
				// Gemini content policy error - already user-friendly
			} else if (errorMessage.includes('multimodal API error')) {
				// OpenRouter/provider errors
				errorMessage = `Multimodal chat failed: ${errorMessage}`;
			} else if (errorMessage.includes('No response content received')) {
				errorMessage = 'The AI model did not provide a response. This may be due to content filters or model limitations.';
			}
		}
		
		return json(
			{ error: errorMessage },
			{ status: 500 }
		);
	}
};
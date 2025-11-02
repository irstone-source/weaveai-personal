import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getModelProvider } from '$lib/ai/index.js';
import type { VideoGenerationParams } from '$lib/ai/types.js';
import { UsageTrackingService, UsageLimitError } from '$lib/server/usage-tracking.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const body = await request.json();
		const { model, prompt, duration, resolution, fps, imageUrl, chatId } = body;

		if (!model) {
			return json({ error: 'Model is required' }, { status: 400 });
		}

		if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
			return json({ error: 'Prompt is required and must be a non-empty string' }, { status: 400 });
		}

		// Check usage limits for video generation
		try {
			await UsageTrackingService.checkUsageLimit(session.user.id, 'video');
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

		// Validate video parameters if provided
		if (duration !== undefined && (typeof duration !== 'number' || duration <= 0 || duration > 60)) {
			return json({ error: 'Duration must be a positive number between 1 and 60 seconds' }, { status: 400 });
		}

		if (fps !== undefined && (typeof fps !== 'number' || fps < 1 || fps > 60)) {
			return json({ error: 'FPS must be a number between 1 and 60' }, { status: 400 });
		}

		const provider = getModelProvider(model);
		if (!provider) {
			return json({ error: `No provider found for model: ${model}` }, { status: 400 });
		}

		if (!provider.generateVideo) {
			return json({ error: `Model ${model} does not support video generation` }, { status: 400 });
		}

		// Check if model supports video generation
		const modelConfig = provider.models.find(m => m.name === model);
		if (!modelConfig?.supportsVideoGeneration) {
			return json({ error: `Model ${model} does not support video generation` }, { status: 400 });
		}

		// For i2v models, validate that imageUrl is provided if required
		if (model.includes('i2v') && !imageUrl) {
			return json({ error: 'Image URL is required for image-to-video models' }, { status: 400 });
		}

		// For models that support image input, validate imageUrl format if provided
		if (imageUrl && modelConfig.supportsImageInput) {
			try {
				new URL(imageUrl);
			} catch {
				return json({ error: 'Invalid image URL format' }, { status: 400 });
			}
		}

		const params: VideoGenerationParams & { imageUrl?: string } = {
			model,
			prompt: prompt.trim(),
			duration,
			resolution,
			fps,
			userId: session.user.id,
			chatId,
			...(imageUrl && { imageUrl })
		};

		console.log('🎯 Video generation API called:', {
			model,
			prompt: prompt.trim().substring(0, 100) + '...',
			userId: session.user.id,
			providerName: provider.name,
			hasGenerateVideo: !!provider.generateVideo
		});

		const response = await provider.generateVideo(params);
		console.log('🎉 Video generation completed, response:', {
			videoId: response.videoId,
			model: response.model,
			mimeType: response.mimeType
		});

		// Track usage for successful video generation
		UsageTrackingService.trackUsage(session.user.id, 'video').catch(console.error);

		return json(response);

	} catch (error) {
		console.error('Video generation API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getModelProvider } from '$lib/ai/index.js';
import type { ImageEditParams } from '$lib/ai/types.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Parse form data to handle file uploads
		const formData = await request.formData();
		const model = formData.get('model') as string;
		const prompt = formData.get('prompt') as string;
		const quality = formData.get('quality') as string;
		const size = formData.get('size') as string;
		const chatId = formData.get('chatId') as string;

		// Validation
		if (!model) {
			return json({ error: 'Model is required' }, { status: 400 });
		}

		if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
			return json({ error: 'Prompt is required and must be a non-empty string' }, { status: 400 });
		}

		// Get uploaded image files
		const imageFiles: File[] = [];
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('image') && value instanceof File) {
				imageFiles.push(value);
			}
		}

		if (imageFiles.length === 0) {
			return json({ error: 'At least one image file is required for editing' }, { status: 400 });
		}

		// Validate image files
		for (const file of imageFiles) {
			if (!file.type.startsWith('image/')) {
				return json({ error: 'All uploaded files must be images' }, { status: 400 });
			}
			// Limit file size to 10MB
			if (file.size > 10 * 1024 * 1024) {
				return json({ error: 'Image files must be smaller than 10MB' }, { status: 400 });
			}
		}

		const provider = getModelProvider(model);
		if (!provider) {
			return json({ error: `No provider found for model: ${model}` }, { status: 400 });
		}

		if (!provider.editImage) {
			return json({ error: `Model ${model} does not support image editing` }, { status: 400 });
		}

		// Find model config to check capabilities
		const modelConfig = provider.models.find(m => m.name === model);
		if (!modelConfig?.supportsImageEditing) {
			return json({ error: `Model ${model} does not support image editing` }, { status: 400 });
		}

		const params: ImageEditParams = {
			model,
			image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
			prompt: prompt.trim(),
			quality: quality as 'standard' | 'hd',
			size,
			userId: session.user.id,
			chatId: chatId || undefined
		};

		const response = await provider.editImage(params);

		return json(response);

	} catch (error) {
		console.error('Image editing API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
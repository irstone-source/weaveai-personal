// For AI Models via OpenRouter
export interface ArchitectureObject {
	input_modalities: string[]; // e.g., ["text", "image", "file"]
	output_modalities: string[]; // e.g., ["text"]
	tokenizer: string; // e.g., "Claude" or "GPT"
	instruct_type: string | null; // Instruction format type, can be null
}

// Tool calling interfaces for OpenRouter function calling
export interface AITool {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: {
			type: 'object';
			properties: Record<string, any>;
			required?: string[];
		};
	};
}

export interface AIToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string; // JSON string
	};
}

export interface AIToolResult {
	role: 'tool';
	tool_call_id: string;
	name: string;
	content: string;
}

export interface AIMessage {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string | null;
	model?: string; // Store which model generated this message (for assistant messages)
	imageId?: string; // Reference to images database table (single image, for backwards compatibility)
	imageUrl?: string; // URL to the generated image file (deprecated, for backwards compatibility)
	imageData?: string; // Base64 image data (deprecated, for backwards compatibility)
	videoId?: string; // Reference to videos database table
	mimeType?: string; // MIME type for image/video data
	type?: 'text' | 'image' | 'video'; // Message type
	// Multiple image support
	imageIds?: string[]; // Array of image IDs from database
	images?: Array<{
		imageId?: string;
		imageData?: string;
		mimeType: string;
	}>; // Array of image objects with data or IDs
	// Tool calling support
	tool_calls?: AIToolCall[];
	tool_call_id?: string; // For tool result messages
	name?: string; // Tool name for tool result messages
}

export interface AIModelConfig {
	name: string;
	displayName: string;
	provider: string;
	maxTokens: number;
	supportsStreaming: boolean;
	supportsFunctions?: boolean;
	supportsTextInput?: boolean; // Default, all models support text input
	supportsImageInput?: boolean; // Vision models that can analyze uploaded images
	supportsVideoInput?: boolean;
	supportsAudioInput?: boolean; // Transcribe models
	supportsTextGeneration?: boolean;
	supportsImageGeneration?: boolean;
	supportsImageEditing?: boolean; // Image editing capabilities
	supportsImageStreaming?: boolean; // Streaming image generation
	supportsVideoGeneration?: boolean;
	supportsAudioGeneration?: boolean;
	architecture?: ArchitectureObject; // OpenRouter architecture data when available
	isGuestAllowed?: boolean; // Whether guest users can use this model
	isDemoAllowed?: boolean; // Whether this model is allowed in demo mode
	isLocked?: boolean; // Whether this model is locked for the current user
	isDemoMode?: boolean; // Whether the platform is currently in demo mode
}

export interface AIResponse {
	content: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model: string;
	finishReason?: 'stop' | 'length' | 'content_filter' | 'function_call' | 'tool_calls';
	tool_calls?: AIToolCall[]; // Support tool calls in response
}

export interface AIStreamChunk {
	content: string;
	done: boolean;
	usage?: AIResponse['usage'];
}

export interface AIProvider {
	name: string;
	models: AIModelConfig[];
	chat(params: {
		model: string;
		messages: AIMessage[];
		maxTokens?: number;
		temperature?: number;
		stream?: boolean;
		userId?: string;
		chatId?: string;
		tools?: AITool[];
	}): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>>;
	generateImage?(params: ImageGenerationParams): Promise<AIImageResponse | AsyncIterableIterator<AIImageStreamChunk>>;
	editImage?(params: ImageEditParams): Promise<AIImageResponse>;
	generateVideo?(params: VideoGenerationParams): Promise<AIVideoResponse>;
	chatMultimodal?(params: {
		model: string;
		messages: AIMessage[];
		maxTokens?: number;
		temperature?: number;
		userId?: string;
		chatId?: string;
		tools?: AITool[];
	}): Promise<AIResponse | AIImageResponse | AIVideoResponse>;
	// New method specifically for tool calling
	chatWithTools?(params: {
		model: string;
		messages: AIMessage[];
		tools: AITool[];
		maxTokens?: number;
		temperature?: number;
		userId?: string;
		chatId?: string;
	}): Promise<AIResponse>;
}

export interface ChatCompletionParams {
	model: string;
	messages: AIMessage[];
	maxTokens?: number;
	temperature?: number;
	stream?: boolean;
	userId?: string;
	chatId?: string;
	tools?: AITool[];
}

export interface AIImageResponse {
	imageId: string; // Reference to images database table
	imageUrl?: string; // URL to the generated image file (deprecated, for backwards compatibility)
	imageData?: string; // Base64 encoded image (deprecated, for backwards compatibility)
	mimeType: string; // e.g., 'image/png', 'image/jpeg'
	prompt: string;
	model: string;
	usage?: {
		promptTokens: number;
		imageTokens?: number;
		totalTokens: number;
	};
}

export interface ImageGenerationParams {
	model: string;
	prompt: string;
	quality?: 'standard' | 'hd';
	size?: string;
	style?: string;
	userId?: string;
	chatId?: string;
	stream?: boolean; // Support for streaming image generation
	partial_images?: number; // Number of partial images to generate during streaming
	imageUrl?: string; // Reference image URL for image-to-image generation
}

export interface ImageEditParams {
	model: string;
	image: File | File[]; // Source image(s) for editing
	prompt: string;
	quality?: 'standard' | 'hd';
	size?: string;
	userId?: string;
	chatId?: string;
}

export interface AIImageStreamChunk {
	type: 'image_generation.partial_image' | 'image_generation.complete';
	partial_image_index?: number;
	b64_json?: string;
	imageId?: string; // Reference to database when complete
	done: boolean;
}

export interface AIVideoResponse {
	videoId: string; // Reference to videos database table
	mimeType: string; // e.g., 'video/mp4'
	prompt: string;
	model: string;
	duration?: number; // Duration in seconds
	resolution?: string; // e.g., '720p'
	fps?: number; // Frames per second
	hasAudio?: boolean; // Whether video includes audio
	usage?: {
		promptTokens: number;
		videoTokens?: number;
		totalTokens: number;
	};
}

export interface VideoGenerationParams {
	model: string;
	prompt: string;
	duration?: number; // Duration in seconds (default 8 for Veo 3)
	resolution?: string; // e.g., '720p'
	fps?: number; // Frames per second (default 24 for Veo 3)
	imageUrl?: string; // Image URL for image-to-video models (i2v)
	userId?: string;
	chatId?: string;
}

// Helper function to determine if a model is multimodal (supports 2+ generation types)
export function isMultimodal(model: AIModelConfig): boolean {
	const capabilities = [
		model.supportsTextGeneration,
		model.supportsImageGeneration,
		model.supportsVideoGeneration,
		model.supportsAudioGeneration
	].filter(Boolean);

	return capabilities.length >= 2;
}
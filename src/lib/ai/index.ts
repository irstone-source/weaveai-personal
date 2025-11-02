import type { AIProvider, AIModelConfig } from './types.js';
import { openRouterProvider } from './providers/openrouter.js';
import { googleGeminiProvider } from './providers/google-gemini.js';
import { openaiProvider } from './providers/openai.js';
import { xaiProvider } from './providers/xai.js';
import { stabilityProvider } from './providers/stability.js';
import { klingProvider } from './providers/kling.js';
import { bflProvider } from './providers/bfl.js';
import { alibabaProvider } from './providers/alibaba.js';
import { lumalabsProvider } from './providers/lumalabs.js';

export const AI_PROVIDERS: AIProvider[] = [
	openRouterProvider,
	googleGeminiProvider,
	openaiProvider,
	xaiProvider,
	stabilityProvider,
	klingProvider,
	bflProvider,
	alibabaProvider,
	lumalabsProvider
];

export function getAllModels(): AIModelConfig[] {
	return AI_PROVIDERS.flatMap(provider => provider.models);
}

export function getProvider(providerName: string): AIProvider | undefined {
	return AI_PROVIDERS.find(provider => provider.name === providerName);
}

export function getModelProvider(modelName: string): AIProvider | undefined {
	return AI_PROVIDERS.find(provider =>
		provider.models.some(model => model.name === modelName)
	);
}

export * from './types.js';
export { openRouterProvider } from './providers/openrouter.js';
export { googleGeminiProvider } from './providers/google-gemini.js';
export { openaiProvider } from './providers/openai.js';
export { xaiProvider } from './providers/xai.js';
export { stabilityProvider } from './providers/stability.js';
export { klingProvider } from './providers/kling.js';
export { bflProvider } from './providers/bfl.js';
export { alibabaProvider } from './providers/alibaba.js';
export { lumalabsProvider } from './providers/lumalabs.js';
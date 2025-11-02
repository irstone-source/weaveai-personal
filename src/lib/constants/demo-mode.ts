/**
 * Demo mode limitation constants
 * Centralized configuration for demo mode restrictions when DEMO_MODE=true
 */

import { env } from '$env/dynamic/private';

// Demo mode allowed models (hand-picked subset similar to guest restrictions)
export const DEMO_ALLOWED_MODELS = [
	// "deepseek/deepseek-chat-v3.1:free",
	// "deepseek/deepseek-r1-0528:free",
	"openai/gpt-oss-20b:free",
	"moonshotai/kimi-k2:free",
	"z-ai/glm-4.5-air:free"
];

// Helper function to check if demo mode is enabled
export function isDemoModeEnabled(): boolean {
	return env.DEMO_MODE === 'true';
}

// Helper function to check if a model is allowed for demo mode users
export function isModelAllowedForDemo(modelName: string): boolean {
	return DEMO_ALLOWED_MODELS.includes(modelName);
}

// Helper function to check if user is restricted by demo mode
export function isDemoModeRestricted(isLoggedIn: boolean): boolean {
	return isDemoModeEnabled() && isLoggedIn;
}

// Demo mode error messages
export const DEMO_MODE_MESSAGES = {
	MODEL_RESTRICTED: 'Demo mode limits access to selected models only. Contact administrator for full access.',
	SAVE_DISABLED: 'Saving is disabled in demo mode. This is a read-only demonstration.',
	ADMIN_SAVE_DISABLED: 'Admin modifications are disabled in demo mode. This is a read-only demonstration.',
	GENERAL_RESTRICTION: 'This action is disabled in demo mode.'
} as const;
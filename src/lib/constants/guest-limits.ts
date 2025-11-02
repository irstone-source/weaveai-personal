/**
 * Guest user limitation constants
 * Centralized configuration for non-logged in user restrictions
 */

export const GUEST_MESSAGE_LIMIT = 6;
export const GUEST_ALLOWED_MODELS = [
    // "deepseek/deepseek-chat-v3.1:free",
    // "deepseek/deepseek-r1-0528:free",
    "openai/gpt-oss-20b:free",
    "moonshotai/kimi-k2:free",
    "z-ai/glm-4.5-air:free"
];

// Helper function to check if a model is allowed for guests
export function isModelAllowedForGuests(modelName: string): boolean {
    return GUEST_ALLOWED_MODELS.includes(modelName);
}
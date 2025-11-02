export interface ProviderIconConfig {
	iconPath: string;
}

export const providerConfig: Record<string, ProviderIconConfig> = {
	Anthropic: { iconPath: "/ai-provider-icons/claude-favicon.png" },
	OpenAI: { iconPath: "/ai-provider-icons/chatgpt-favicon.png" },
	Google: { iconPath: "/ai-provider-icons/gemini-favicon.png" },
	Meta: { iconPath: "/ai-provider-icons/meta-favicon.png" },
	Mistral: { iconPath: "/ai-provider-icons/mistral-favicon.png" },
	DeepSeek: { iconPath: "/ai-provider-icons/deepseek-favicon.png" },
	xAI: { iconPath: "/ai-provider-icons/xai-favicon.png" },
	Alibaba: { iconPath: "/ai-provider-icons/qwen-favicon.png" },
	Moonshot: { iconPath: "/ai-provider-icons/kimi-favicon.png" },
	ZAI: { iconPath: "/ai-provider-icons/zai-favicon.png" },
	StabilityAI: { iconPath: "/ai-provider-icons/stabilityai-favicon.png" },
	KlingAI: { iconPath: "/ai-provider-icons/klingai-favicon.png" },
	BlackForestLabs: { iconPath: "/ai-provider-icons/bfl-favicon.png" },
	LumaLabs: { iconPath: "/ai-provider-icons/lumalabs-favicon.png" }
};
import type { AIModelConfig } from './types.js';

/**
 * Task types that the router can detect
 */
export enum TaskType {
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  CREATIVE_WRITING = 'creative_writing',
  QUICK_QUESTION = 'quick_question',
  IMAGE_GENERATION = 'image_generation',
  VIDEO_GENERATION = 'video_generation',
  REASONING_MATH = 'reasoning_math',
  RESEARCH_ANALYSIS = 'research_analysis',
  CONVERSATION = 'conversation',
  TRANSLATION = 'translation',
  DATA_ANALYSIS = 'data_analysis',
  MULTIMODAL = 'multimodal'
}

/**
 * Model selection result with reasoning
 */
export interface ModelSelection {
  modelName: string;
  taskType: TaskType;
  reasoning: string;
  confidence: number; // 0-1 score
}

/**
 * Keyword patterns for task detection
 */
const TASK_PATTERNS = {
  [TaskType.CODE_GENERATION]: [
    /\b(write|create|generate|build|implement|code|function|class|api|endpoint)\b.*\b(code|script|program|function|app|website|application)\b/i,
    /\b(python|javascript|typescript|java|rust|go|c\+\+|react|vue|svelte|node)\b/i,
    /\b(debug|fix|refactor|optimize)\b.*\b(code|function|bug)\b/i,
    /```/,  // Code blocks
    /\bcan you (help me )?(write|create|make)\b/i
  ],
  [TaskType.CODE_REVIEW]: [
    /\b(review|analyze|check|examine|evaluate)\b.*\b(code|implementation|function)\b/i,
    /\bwhat('s| is) wrong (with|in)\b.*\b(code|function)\b/i,
    /\b(improve|better|cleaner)\b.*\b(code|implementation)\b/i
  ],
  [TaskType.CREATIVE_WRITING]: [
    /\b(write|create|compose|draft)\b.*\b(story|poem|essay|article|blog|novel|script|lyrics)\b/i,
    /\b(creative|creative writing|fiction|narrative)\b/i,
    /\btell me (a story|about)/i
  ],
  [TaskType.QUICK_QUESTION]: [
    /^(what|who|when|where|why|how|is|are|can|does|do)\b/i,
    /\?$/,
    /^(define|explain|describe)\b/i
  ],
  [TaskType.IMAGE_GENERATION]: [
    /\b(generate|create|make|draw|paint|design)\b.*\b(image|picture|photo|illustration|artwork|logo)\b/i,
    /\bshow me (a picture|an image)/i
  ],
  [TaskType.VIDEO_GENERATION]: [
    /\b(generate|create|make|produce)\b.*\b(video|animation|clip|footage)\b/i,
    /\bvideo of/i
  ],
  [TaskType.REASONING_MATH]: [
    /\b(solve|calculate|compute|prove|theorem|equation|formula)\b/i,
    /\b(math|mathematics|algebra|calculus|geometry|physics)\b/i,
    /\b(step by step|reasoning|logical|deduce)\b/i,
    /\d+\s*[\+\-\*\/\^]\s*\d+/  // Math expressions
  ],
  [TaskType.RESEARCH_ANALYSIS]: [
    /\b(research|analyze|investigate|study|examine|explore)\b/i,
    /\b(summary|summarize|compare|contrast|evaluate)\b.*\b(paper|article|document)\b/i,
    /\bwhat (do you think|are the implications|is the impact)/i
  ],
  [TaskType.TRANSLATION]: [
    /\b(translate|translation)\b/i,
    /\bfrom\b.*\bto\b.*\b(english|spanish|french|german|chinese|japanese)\b/i
  ],
  [TaskType.DATA_ANALYSIS]: [
    /\b(analyze|analysis|insights|trends|patterns)\b.*\b(data|dataset|statistics)\b/i,
    /\b(csv|json|excel|spreadsheet)\b/i
  ],
  [TaskType.MULTIMODAL]: [
    /\b(image|picture|photo)\b.*\b(analyze|describe|explain|what is)\b/i,
    /\bwhat (is in|does) (this|the) (image|picture)/i
  ]
};

/**
 * Model preferences by task type
 */
const TASK_MODEL_PREFERENCES = {
  [TaskType.CODE_GENERATION]: [
    'openai/gpt-5',
    'anthropic/claude-opus-4.1',
    'qwen/qwen3-coder',
    'x-ai/grok-code-fast-1',
    'anthropic/claude-sonnet-4'
  ],
  [TaskType.CODE_REVIEW]: [
    'anthropic/claude-opus-4.1',
    'openai/gpt-5',
    'anthropic/claude-sonnet-4',
    'qwen/qwen3-coder'
  ],
  [TaskType.CREATIVE_WRITING]: [
    'anthropic/claude-sonnet-4',
    'anthropic/claude-opus-4.1',
    'openai/gpt-5',
    'openai/gpt-5-chat'
  ],
  [TaskType.QUICK_QUESTION]: [
    'openai/gpt-4o-mini',
    'google/gemini-2.5-flash-lite',
    'anthropic/claude-3.5-haiku',
    'openai/gpt-5-mini'
  ],
  [TaskType.IMAGE_GENERATION]: [
    'google/gemini-2.5-pro',
    'openai/dall-e-3',
    'stability/stable-diffusion'
  ],
  [TaskType.VIDEO_GENERATION]: [
    'kling/kling-v1',
    'luma/dream-machine',
    'alibaba/i2vgen-xl'
  ],
  [TaskType.REASONING_MATH]: [
    'deepseek/deepseek-r1-0528',
    'openai/o3-mini',
    'openai/o1',
    'qwen/qwen3-235b-a22b-thinking-2507'
  ],
  [TaskType.RESEARCH_ANALYSIS]: [
    'anthropic/claude-opus-4.1',
    'openai/gpt-5',
    'google/gemini-2.5-pro',
    'anthropic/claude-sonnet-4'
  ],
  [TaskType.TRANSLATION]: [
    'openai/gpt-5',
    'google/gemini-2.5-pro',
    'anthropic/claude-opus-4.1'
  ],
  [TaskType.DATA_ANALYSIS]: [
    'anthropic/claude-opus-4.1',
    'openai/gpt-5',
    'google/gemini-2.5-pro'
  ],
  [TaskType.MULTIMODAL]: [
    'openai/gpt-5',
    'anthropic/claude-opus-4.1',
    'google/gemini-2.5-pro',
    'openai/gpt-4o-mini'
  ],
  [TaskType.CONVERSATION]: [
    'openai/gpt-5-chat',
    'anthropic/claude-sonnet-4',
    'google/gemini-2.5-flash',
    'openai/gpt-5-mini'
  ]
};

/**
 * Analyze a prompt to detect the task type
 */
export function detectTaskType(prompt: string, hasImageAttachment: boolean = false): TaskType {
  // If there's an image attachment, it's likely multimodal
  if (hasImageAttachment) {
    return TaskType.MULTIMODAL;
  }

  // Check each task type's patterns
  const scores: { [key: string]: number } = {};

  for (const [taskType, patterns] of Object.entries(TASK_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        score++;
      }
    }
    if (score > 0) {
      scores[taskType] = score;
    }
  }

  // Find task type with highest score
  if (Object.keys(scores).length > 0) {
    const bestMatch = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    return bestMatch as TaskType;
  }

  // Default to conversation for general queries
  return TaskType.CONVERSATION;
}

/**
 * Get task type display name
 */
export function getTaskTypeDisplayName(taskType: TaskType): string {
  const names: { [key in TaskType]: string } = {
    [TaskType.CODE_GENERATION]: 'Code Generation',
    [TaskType.CODE_REVIEW]: 'Code Review',
    [TaskType.CREATIVE_WRITING]: 'Creative Writing',
    [TaskType.QUICK_QUESTION]: 'Quick Question',
    [TaskType.IMAGE_GENERATION]: 'Image Generation',
    [TaskType.VIDEO_GENERATION]: 'Video Generation',
    [TaskType.REASONING_MATH]: 'Reasoning & Math',
    [TaskType.RESEARCH_ANALYSIS]: 'Research & Analysis',
    [TaskType.CONVERSATION]: 'Conversation',
    [TaskType.TRANSLATION]: 'Translation',
    [TaskType.DATA_ANALYSIS]: 'Data Analysis',
    [TaskType.MULTIMODAL]: 'Image Analysis'
  };
  return names[taskType];
}

/**
 * Select the best model for a given task
 */
export function selectBestModel(
  prompt: string,
  availableModels: AIModelConfig[],
  hasImageAttachment: boolean = false
): ModelSelection {
  // Detect task type
  const taskType = detectTaskType(prompt, hasImageAttachment);

  // Get preferred models for this task
  const preferredModels = TASK_MODEL_PREFERENCES[taskType] || TASK_MODEL_PREFERENCES[TaskType.CONVERSATION];

  // Filter to only available and unlocked models
  const availableUnlockedModels = availableModels.filter(m => !m.isLocked);

  // Try to find first available preferred model
  for (const preferredModelName of preferredModels) {
    const model = availableUnlockedModels.find(m => m.name === preferredModelName);
    if (model) {
      return {
        modelName: model.name,
        taskType,
        reasoning: `Selected ${model.displayName} - optimized for ${getTaskTypeDisplayName(taskType).toLowerCase()}`,
        confidence: 0.9
      };
    }
  }

  // Fallback: select first available model that matches task requirements
  let fallbackModel: AIModelConfig | undefined;

  if (taskType === TaskType.IMAGE_GENERATION) {
    fallbackModel = availableUnlockedModels.find(m => m.supportsImageGeneration);
  } else if (taskType === TaskType.VIDEO_GENERATION) {
    fallbackModel = availableUnlockedModels.find(m => m.supportsVideoGeneration);
  } else if (taskType === TaskType.MULTIMODAL) {
    fallbackModel = availableUnlockedModels.find(m => m.supportsImageInput);
  } else if (taskType === TaskType.CODE_GENERATION || taskType === TaskType.CODE_REVIEW) {
    fallbackModel = availableUnlockedModels.find(m => m.supportsFunctions);
  }

  // Last resort: first available unlocked model
  if (!fallbackModel && availableUnlockedModels.length > 0) {
    fallbackModel = availableUnlockedModels[0];
  }

  if (fallbackModel) {
    return {
      modelName: fallbackModel.name,
      taskType,
      reasoning: `Selected ${fallbackModel.displayName} - available model for ${getTaskTypeDisplayName(taskType).toLowerCase()}`,
      confidence: 0.6
    };
  }

  // Absolute fallback if no models available (shouldn't happen)
  throw new Error('No available models found for auto-selection');
}

/**
 * Explain why a model was selected (for UI display)
 */
export function getSelectionExplanation(selection: ModelSelection): string {
  return `🤖 Auto-selected: ${selection.reasoning}`;
}

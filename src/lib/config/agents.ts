/**
 * Agent Configuration System
 * Defines specialized agents for different types of tasks
 * Similar to Claude Code's agent system
 */

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  description: string;
  capabilities: string[];
  recommendedFor: string[];
  modelPreference?: string;
  temperature?: number;
  systemPrompt: string;
  color: string;
}

export const AGENTS: Agent[] = [
  {
    id: 'general',
    name: 'General Assistant',
    emoji: '🤖',
    description: 'Versatile AI assistant for general queries and tasks',
    capabilities: [
      'General conversation',
      'Information lookup',
      'Basic reasoning',
      'Content generation'
    ],
    recommendedFor: [
      'Simple questions',
      'General information',
      'Casual conversation',
      'Quick tasks'
    ],
    temperature: 0.7,
    systemPrompt: 'You are a helpful, friendly AI assistant. Provide clear, accurate, and concise responses.',
    color: 'blue'
  },
  {
    id: 'code',
    name: 'Code Expert',
    emoji: '👨‍💻',
    description: 'Specialized in programming, debugging, and software development',
    capabilities: [
      'Code generation',
      'Debugging',
      'Code review',
      'Architecture design',
      'Best practices',
      'Multiple languages'
    ],
    recommendedFor: [
      'Writing code',
      'Fixing bugs',
      'Code explanation',
      'Software architecture',
      'Technical documentation'
    ],
    modelPreference: 'anthropic/claude-sonnet-4',
    temperature: 0.3,
    systemPrompt: 'You are an expert software engineer. Write clean, efficient, well-documented code. Explain technical concepts clearly. Follow best practices and modern patterns.',
    color: 'purple'
  },
  {
    id: 'research',
    name: 'Research Analyst',
    emoji: '🔬',
    description: 'Deep analysis, research, and comprehensive information gathering',
    capabilities: [
      'In-depth research',
      'Data analysis',
      'Critical thinking',
      'Source evaluation',
      'Comprehensive reports'
    ],
    recommendedFor: [
      'Research projects',
      'Data analysis',
      'Market research',
      'Academic work',
      'Detailed investigations'
    ],
    temperature: 0.5,
    systemPrompt: 'You are a thorough research analyst. Provide well-researched, detailed, and accurate information. Cite sources when possible. Think critically and consider multiple perspectives.',
    color: 'green'
  },
  {
    id: 'creative',
    name: 'Creative Writer',
    emoji: '✍️',
    description: 'Creative content generation, storytelling, and artistic expression',
    capabilities: [
      'Creative writing',
      'Storytelling',
      'Marketing copy',
      'Brand voice',
      'Content ideation'
    ],
    recommendedFor: [
      'Creative writing',
      'Marketing content',
      'Brand messaging',
      'Story development',
      'Content strategy'
    ],
    temperature: 0.9,
    systemPrompt: 'You are a creative writer with a gift for storytelling and engaging content. Be imaginative, original, and compelling. Adapt tone and style to the task.',
    color: 'pink'
  },
  {
    id: 'business',
    name: 'Business Strategist',
    emoji: '💼',
    description: 'Business strategy, planning, and professional communications',
    capabilities: [
      'Business strategy',
      'Market analysis',
      'Professional writing',
      'Project planning',
      'Decision support'
    ],
    recommendedFor: [
      'Business plans',
      'Strategy development',
      'Professional emails',
      'Reports and proposals',
      'Decision-making'
    ],
    temperature: 0.6,
    systemPrompt: 'You are a seasoned business strategist and consultant. Provide strategic insights, data-driven recommendations, and professional advice. Be practical and results-oriented.',
    color: 'indigo'
  },
  {
    id: 'educator',
    name: 'Educational Tutor',
    emoji: '👨‍🏫',
    description: 'Teaching, explaining complex topics, and learning support',
    capabilities: [
      'Clear explanations',
      'Step-by-step guidance',
      'Concept breakdown',
      'Study assistance',
      'Knowledge assessment'
    ],
    recommendedFor: [
      'Learning new topics',
      'Understanding concepts',
      'Study help',
      'Skill development',
      'Educational content'
    ],
    temperature: 0.5,
    systemPrompt: 'You are a patient, knowledgeable educator. Break down complex topics into understandable parts. Use examples, analogies, and step-by-step explanations. Encourage learning.',
    color: 'amber'
  },
  {
    id: 'technical',
    name: 'Technical Writer',
    emoji: '📋',
    description: 'Technical documentation, API docs, and system documentation',
    capabilities: [
      'Technical documentation',
      'API documentation',
      'User guides',
      'System specs',
      'Process documentation'
    ],
    recommendedFor: [
      'API documentation',
      'User manuals',
      'Technical guides',
      'System documentation',
      'Process workflows'
    ],
    temperature: 0.3,
    systemPrompt: 'You are a technical writer. Create clear, accurate, and well-structured documentation. Use appropriate formatting, examples, and diagrams. Focus on usability.',
    color: 'cyan'
  },
  {
    id: 'data',
    name: 'Data Scientist',
    emoji: '📊',
    description: 'Data analysis, statistics, and data-driven insights',
    capabilities: [
      'Data analysis',
      'Statistical analysis',
      'Data visualization',
      'Pattern recognition',
      'Predictive modeling'
    ],
    recommendedFor: [
      'Data analysis',
      'Statistical questions',
      'Data interpretation',
      'Visualization guidance',
      'ML/AI topics'
    ],
    temperature: 0.4,
    systemPrompt: 'You are a data scientist. Analyze data rigorously, apply statistical methods appropriately, and communicate findings clearly. Be precise with numbers and methodology.',
    color: 'emerald'
  }
];

export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find(agent => agent.id === id);
}

export function getRecommendedAgents(prompt: string): Agent[] {
  const lowercasePrompt = prompt.toLowerCase();
  const scored = AGENTS.map(agent => {
    let score = 0;

    // Check if prompt contains keywords related to agent's capabilities
    for (const keyword of agent.recommendedFor) {
      if (lowercasePrompt.includes(keyword.toLowerCase())) {
        score += 2;
      }
    }

    // Keyword matching
    const keywords = {
      code: ['code', 'programming', 'debug', 'function', 'api', 'software', 'develop'],
      research: ['research', 'analyze', 'study', 'investigate', 'data', 'information'],
      creative: ['write', 'story', 'creative', 'marketing', 'content', 'brand'],
      business: ['business', 'strategy', 'plan', 'professional', 'proposal'],
      educator: ['learn', 'teach', 'explain', 'understand', 'how does', 'what is'],
      technical: ['documentation', 'docs', 'manual', 'guide', 'specification'],
      data: ['data', 'statistics', 'analyze', 'visualize', 'dataset', 'chart']
    };

    const agentKeywords = keywords[agent.id as keyof typeof keywords] || [];
    for (const keyword of agentKeywords) {
      if (lowercasePrompt.includes(keyword)) {
        score += 1;
      }
    }

    return { agent, score };
  });

  // Return top 3 recommended agents
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.agent);
}

export function getDefaultAgent(): Agent {
  return AGENTS[0]; // General Assistant
}

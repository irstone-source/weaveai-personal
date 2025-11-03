/**
 * AI-Powered Conversation Tagging Service
 * Automatically analyzes and tags conversations for better organization and retrieval
 */

import { OpenAI } from 'openai';
import { db } from '$lib/server/db';
import { importedConversations, importedMessages } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// Configuration
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const TAGGING_MODEL = 'gpt-4o-mini'; // Fast and cheap for tagging
const MAX_MESSAGES_FOR_ANALYSIS = 10; // Sample messages for context

// ============================================================================
// Types
// ============================================================================

export interface ConversationTags {
  // Primary categories
  type: string[]; // technical, creative, planning, research, personal, business
  domain: string[]; // web-dev, AI, design, marketing, etc.
  intent: string[]; // problem-solving, brainstorming, learning, decision-making

  // Specific topics
  topics: string[]; // react, nextjs, database, seo, etc.

  // Project/entity references
  projects: string[]; // project names mentioned

  // Sentiment/tone
  sentiment: string; // productive, exploratory, troubleshooting, casual

  // All tags combined
  all: string[];
}

export interface TaggingResult {
  conversationId: string;
  tags: string[];
  confidence: number;
}

// ============================================================================
// Tag Generation Functions
// ============================================================================

/**
 * Generate tags for a conversation using GPT-4
 */
export async function generateConversationTags(
  conversationTitle: string,
  messageSample: Array<{ role: string; content: string }>
): Promise<string[]> {

  if (!process.env.OPENAI_API_KEY) {
    console.warn('[Tagging] OpenAI API key not configured');
    return [];
  }

  try {
    // Build analysis prompt
    const messagesContext = messageSample
      .map(m => `${m.role === 'human' ? 'User' : 'Assistant'}: ${m.content.substring(0, 500)}`)
      .join('\n\n');

    const prompt = `Analyze this conversation and generate relevant tags.

Title: "${conversationTitle}"

Sample messages:
${messagesContext}

Generate 5-10 highly relevant tags that describe:
1. Type (technical, creative, planning, research, personal, business, etc.)
2. Domain (web-dev, AI, design, marketing, data, etc.)
3. Intent (problem-solving, brainstorming, learning, debugging, etc.)
4. Specific topics (react, nextjs, python, seo, etc.)
5. Project references (if any project names are mentioned)

Return ONLY a JSON array of lowercase, hyphenated tags. No explanations.
Example: ["technical", "web-dev", "react", "problem-solving", "debugging"]`;

    const response = await openai.chat.completions.create({
      model: TAGGING_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a conversation analysis expert. Generate accurate, relevant tags for conversations. Always respond with valid JSON array only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent tagging
      max_tokens: 200
    });

    const content = response.choices[0].message.content || '[]';

    // Parse JSON response
    try {
      const tags = JSON.parse(content);

      if (!Array.isArray(tags)) {
        console.warn('[Tagging] Response was not an array:', content);
        return [];
      }

      // Validate and clean tags
      return tags
        .filter(tag => typeof tag === 'string' && tag.length > 0)
        .map(tag => tag.toLowerCase().trim())
        .slice(0, 10); // Max 10 tags

    } catch (parseError) {
      console.error('[Tagging] Failed to parse JSON:', content);
      return [];
    }

  } catch (error: any) {
    console.error('[Tagging] Error generating tags:', error.message);
    return [];
  }
}

/**
 * Generate tags for a conversation by ID
 */
export async function tagConversation(
  conversationId: string
): Promise<string[]> {

  try {
    // Get conversation
    const [conversation] = await db
      .select()
      .from(importedConversations)
      .where(eq(importedConversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Get sample messages
    const messages = await db
      .select()
      .from(importedMessages)
      .where(eq(importedMessages.conversationId, conversationId))
      .limit(MAX_MESSAGES_FOR_ANALYSIS);

    // Build message sample
    const messageSample = messages.map(m => ({
      role: m.sender,
      content: m.text
    }));

    // Generate tags
    const tags = await generateConversationTags(conversation.name, messageSample);

    // Update conversation in database
    await db
      .update(importedConversations)
      .set({
        tags: tags,
        tagsGenerated: true,
        updatedAt: new Date()
      })
      .where(eq(importedConversations.id, conversationId));

    console.log(`[Tagging] Tagged conversation "${conversation.name}" with ${tags.length} tags`);

    return tags;

  } catch (error: any) {
    console.error('[Tagging] Error tagging conversation:', error.message);
    throw error;
  }
}

/**
 * Batch tag multiple conversations
 */
export async function tagConversationsBatch(
  conversationIds: string[],
  options: {
    concurrency?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number, current: string) => void;
  } = {}
): Promise<TaggingResult[]> {

  const { concurrency = 5, delayMs = 100, onProgress } = options;
  const results: TaggingResult[] = [];

  // Process in batches for concurrency control
  for (let i = 0; i < conversationIds.length; i += concurrency) {
    const batch = conversationIds.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (convId) => {
        try {
          const tags = await tagConversation(convId);
          return {
            conversationId: convId,
            tags,
            confidence: 1
          };
        } catch (error: any) {
          console.error(`[Tagging] Failed to tag ${convId}:`, error.message);
          return {
            conversationId: convId,
            tags: [],
            confidence: 0
          };
        }
      })
    );

    // Collect results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);

        if (onProgress) {
          onProgress(results.length, conversationIds.length, result.value.conversationId);
        }
      }
    }

    // Rate limiting delay between batches
    if (i + concurrency < conversationIds.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Get all unique tags across all conversations
 */
export async function getAllTags(userId: string): Promise<Record<string, number>> {
  try {
    const conversations = await db
      .select({
        tags: importedConversations.tags
      })
      .from(importedConversations)
      .where(eq(importedConversations.userId, userId));

    const tagCounts: Record<string, number> = {};

    for (const conv of conversations) {
      const tags = (conv.tags as string[]) || [];
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    return tagCounts;

  } catch (error) {
    console.error('[Tagging] Error getting all tags:', error);
    return {};
  }
}

/**
 * Find conversations by tags
 */
export async function findConversationsByTags(
  userId: string,
  tags: string[],
  options: {
    matchAll?: boolean; // If true, require all tags. If false, match any tag.
    limit?: number;
  } = {}
): Promise<Array<{ id: string; name: string; tags: string[]; matchedTags: string[] }>> {

  const { matchAll = false, limit = 50 } = options;

  try {
    const conversations = await db
      .select({
        id: importedConversations.id,
        name: importedConversations.name,
        tags: importedConversations.tags,
        createdAt: importedConversations.chatgptCreatedAt
      })
      .from(importedConversations)
      .where(eq(importedConversations.userId, userId))
      .limit(1000); // Get more than needed for filtering

    // Filter and score by tag matches
    const results = conversations
      .map(conv => {
        const convTags = (conv.tags as string[]) || [];
        const matchedTags = tags.filter(tag => convTags.includes(tag));

        if (matchAll && matchedTags.length !== tags.length) {
          return null;
        }

        if (!matchAll && matchedTags.length === 0) {
          return null;
        }

        return {
          id: conv.id,
          name: conv.name,
          tags: convTags,
          matchedTags,
          score: matchedTags.length
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;

  } catch (error) {
    console.error('[Tagging] Error finding conversations by tags:', error);
    return [];
  }
}

/**
 * Suggest similar tags based on partial input
 */
export async function suggestTags(
  userId: string,
  partial: string,
  limit: number = 10
): Promise<Array<{ tag: string; count: number }>> {

  const allTags = await getAllTags(userId);

  const suggestions = Object.entries(allTags)
    .filter(([tag]) => tag.includes(partial.toLowerCase()))
    .sort((a, b) => b[1] - a[1]) // Sort by count
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));

  return suggestions;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract common tag patterns from conversation title
 */
function extractQuickTags(title: string): string[] {
  const tags: string[] = [];
  const lower = title.toLowerCase();

  // Technology keywords
  const techKeywords = [
    'react', 'nextjs', 'vue', 'angular', 'typescript', 'javascript', 'python',
    'node', 'api', 'database', 'sql', 'nosql', 'mongodb', 'postgres',
    'docker', 'kubernetes', 'aws', 'azure', 'vercel', 'netlify',
    'css', 'tailwind', 'sass', 'html', 'webpack', 'vite'
  ];

  for (const keyword of techKeywords) {
    if (lower.includes(keyword)) {
      tags.push(keyword);
    }
  }

  // Action keywords -> intent tags
  if (lower.match(/\b(how|debug|fix|error|issue|problem)\b/)) {
    tags.push('problem-solving');
  }
  if (lower.match(/\b(design|create|build|make)\b/)) {
    tags.push('creative');
  }
  if (lower.match(/\b(plan|strategy|approach)\b/)) {
    tags.push('planning');
  }
  if (lower.match(/\b(learn|understand|explain)\b/)) {
    tags.push('learning');
  }

  return [...new Set(tags)];
}

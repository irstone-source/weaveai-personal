/**
 * Conversation Context Service
 * Retrieves relevant conversation history to provide context for AI responses
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { generateEmbedding } from '$lib/server/integrations/embedding-service';
import { db } from '$lib/server/db';
import { importedMessages, importedConversations } from '$lib/server/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

// ============================================================================
// Configuration
// ============================================================================

const PINECONE_INDEX = process.env.PINECONE_INDEX_NAME || 'weaveai-personal';
const DEFAULT_TOP_K = 5;
const MAX_CONTEXT_LENGTH = 4000; // Max characters in context prompt

// ============================================================================
// Types
// ============================================================================

export interface ConversationContextOptions {
  topK?: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
  sources?: Array<'openai' | 'anthropic'>;
  tags?: string[];
  matchAllTags?: boolean;
  includeConversationName?: boolean;
  maxContextLength?: number;
}

export interface RelevantMessage {
  messageId: string;
  conversationId: string;
  text: string;
  conversationName: string;
  source: 'openai' | 'anthropic';
  sender: 'human' | 'assistant';
  similarity: number;
  timestamp: Date;
  tags?: string[];
}

export interface ConversationContext {
  relevantMessages: RelevantMessage[];
  contextPrompt: string;
  messageCount: number;
  conversationCount: number;
}

// ============================================================================
// Pinecone Client
// ============================================================================

let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone | null {
  if (!process.env.PINECONE_API_KEY) return null;

  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
  }

  return pineconeClient;
}

// ============================================================================
// Context Retrieval Functions
// ============================================================================

/**
 * Get relevant conversation context for a query
 */
export async function getConversationContext(
  query: string,
  userId: string,
  options: ConversationContextOptions = {}
): Promise<ConversationContext> {
  const {
    topK = DEFAULT_TOP_K,
    timeRange,
    sources,
    tags,
    matchAllTags = false,
    includeConversationName = true,
    maxContextLength = MAX_CONTEXT_LENGTH
  } = options;

  try {
    // 1. Pre-filter by tags if requested (two-stage search)
    let allowedConversationIds: Set<string> | null = null;

    if (tags && tags.length > 0) {
      const tagFilterQuery = db
        .select({ id: importedConversations.id })
        .from(importedConversations)
        .where(eq(importedConversations.userId, userId));

      const taggedConversations = await tagFilterQuery;

      // Filter conversations that match tag criteria
      allowedConversationIds = new Set(
        taggedConversations
          .filter(conv => {
            const convTags = (conv as any).tags || [];
            if (!Array.isArray(convTags)) return false;

            if (matchAllTags) {
              // AND logic: conversation must have all requested tags
              return tags.every(tag => convTags.includes(tag));
            } else {
              // OR logic: conversation must have at least one requested tag
              return tags.some(tag => convTags.includes(tag));
            }
          })
          .map(conv => conv.id)
      );

      // If no conversations match tags, return empty
      if (allowedConversationIds.size === 0) {
        return {
          relevantMessages: [],
          contextPrompt: '',
          messageCount: 0,
          conversationCount: 0
        };
      }
    }

    // 2. Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // 3. Search Pinecone for similar messages
    const pinecone = getPineconeClient();
    if (!pinecone) {
      console.warn('[Conversation Context] Pinecone not configured');
      return {
        relevantMessages: [],
        contextPrompt: '',
        messageCount: 0,
        conversationCount: 0
      };
    }

    const index = pinecone.index(PINECONE_INDEX);

    // Build filter
    const filter: any = {
      userId: { $eq: userId }
    };

    if (sources && sources.length > 0) {
      filter.source = { $in: sources };
    }

    if (timeRange) {
      filter.createdAt = {
        $gte: timeRange.start.toISOString(),
        $lte: timeRange.end.toISOString()
      };
    }

    // Query Pinecone
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: topK * 2, // Get more results to filter/deduplicate
      filter,
      includeMetadata: true
    });

    // 4. Process and deduplicate results
    const relevantMessages: RelevantMessage[] = [];
    const seenConversations = new Set<string>();

    for (const match of searchResults.matches) {
      if (!match.metadata) continue;

      const conversationId = match.metadata.conversationId as string;

      // Filter by tag-allowed conversations if tags were specified
      if (allowedConversationIds && !allowedConversationIds.has(conversationId)) {
        continue;
      }

      // Deduplicate: max 2 messages per conversation
      const conversationMessageCount = relevantMessages.filter(
        m => m.conversationId === conversationId
      ).length;

      if (conversationMessageCount >= 2) continue;

      relevantMessages.push({
        messageId: match.metadata.messageId as string,
        conversationId,
        text: match.metadata.text as string,
        conversationName: match.metadata.conversationName as string,
        source: match.metadata.source as 'openai' | 'anthropic',
        sender: match.metadata.sender as 'human' | 'assistant',
        similarity: match.score || 0,
        timestamp: new Date(match.metadata.createdAt as string)
      });

      seenConversations.add(conversationId);

      // Stop if we have enough messages
      if (relevantMessages.length >= topK) break;
    }

    // 4. Format context prompt
    const contextPrompt = formatContextPrompt(
      relevantMessages,
      includeConversationName,
      maxContextLength
    );

    return {
      relevantMessages,
      contextPrompt,
      messageCount: relevantMessages.length,
      conversationCount: seenConversations.size
    };

  } catch (error) {
    console.error('[Conversation Context] Error retrieving context:', error);
    return {
      relevantMessages: [],
      contextPrompt: '',
      messageCount: 0,
      conversationCount: 0
    };
  }
}

/**
 * Get recent conversation history (time-based, no semantic search)
 */
export async function getRecentConversationHistory(
  userId: string,
  options: {
    limit?: number;
    days?: number;
    sources?: Array<'openai' | 'anthropic'>;
  } = {}
): Promise<RelevantMessage[]> {
  const { limit = 10, days = 7, sources } = options;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Query database for recent messages
    const query = db
      .select({
        messageId: importedMessages.id,
        conversationId: importedMessages.conversationId,
        text: importedMessages.text,
        sender: importedMessages.sender,
        timestamp: importedMessages.createdAt,
        conversationName: importedConversations.name,
        source: importedConversations.summary // Using summary to store source temporarily
      })
      .from(importedMessages)
      .innerJoin(
        importedConversations,
        eq(importedMessages.conversationId, importedConversations.id)
      )
      .where(
        and(
          eq(importedConversations.userId, userId),
          gte(importedMessages.createdAt, cutoffDate)
        )
      )
      .orderBy(desc(importedMessages.createdAt))
      .limit(limit);

    const results = await query;

    return results.map(r => ({
      messageId: r.messageId,
      conversationId: r.conversationId,
      text: r.text,
      conversationName: r.conversationName,
      source: 'openai' as const, // Default to openai for now
      sender: r.sender as 'human' | 'assistant',
      similarity: 0,
      timestamp: r.timestamp
    }));

  } catch (error) {
    console.error('[Conversation Context] Error retrieving recent history:', error);
    return [];
  }
}

/**
 * Get messages from a specific conversation
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<RelevantMessage[]> {
  try {
    const results = await db
      .select({
        messageId: importedMessages.id,
        conversationId: importedMessages.conversationId,
        text: importedMessages.text,
        sender: importedMessages.sender,
        timestamp: importedMessages.createdAt,
        conversationName: importedConversations.name
      })
      .from(importedMessages)
      .innerJoin(
        importedConversations,
        eq(importedMessages.conversationId, importedConversations.id)
      )
      .where(
        and(
          eq(importedMessages.conversationId, conversationId),
          eq(importedConversations.userId, userId)
        )
      )
      .orderBy(importedMessages.createdAt);

    return results.map(r => ({
      messageId: r.messageId,
      conversationId: r.conversationId,
      text: r.text,
      conversationName: r.conversationName,
      source: 'openai' as const,
      sender: r.sender as 'human' | 'assistant',
      similarity: 1,
      timestamp: r.timestamp
    }));

  } catch (error) {
    console.error('[Conversation Context] Error retrieving conversation messages:', error);
    return [];
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format relevant messages into a context prompt
 */
function formatContextPrompt(
  messages: RelevantMessage[],
  includeConversationName: boolean,
  maxLength: number
): string {
  if (messages.length === 0) return '';

  let prompt = 'Here is relevant context from your previous conversations:\n\n';

  for (const msg of messages) {
    const source = msg.source === 'openai' ? 'ChatGPT' : 'Claude';
    const role = msg.sender === 'human' ? 'You' : source;

    let messageText = '';

    if (includeConversationName) {
      messageText += `[From: "${msg.conversationName}"]\n`;
    }

    messageText += `${role}: ${msg.text}\n\n`;

    // Check if adding this message would exceed max length
    if (prompt.length + messageText.length > maxLength) {
      const remainingSpace = maxLength - prompt.length;
      if (remainingSpace > 100) {
        // Add truncated version
        messageText = messageText.substring(0, remainingSpace - 3) + '...';
        prompt += messageText;
      }
      break;
    }

    prompt += messageText;
  }

  prompt += '---\n\nUse this context to inform your response, but don\'t mention it explicitly unless relevant.\n';

  return prompt;
}

/**
 * Format messages as a conversation history
 */
export function formatConversationHistory(messages: RelevantMessage[]): string {
  if (messages.length === 0) return 'No conversation history available.';

  let history = '';
  let currentConversation = '';

  for (const msg of messages) {
    if (currentConversation !== msg.conversationName) {
      if (currentConversation !== '') {
        history += '\n---\n\n';
      }
      history += `## ${msg.conversationName}\n\n`;
      currentConversation = msg.conversationName;
    }

    const role = msg.sender === 'human' ? 'You' : 'AI';
    const timestamp = msg.timestamp.toLocaleString();
    history += `**${role}** (${timestamp}):\n${msg.text}\n\n`;
  }

  return history;
}

/**
 * Get conversation statistics
 */
export async function getConversationStats(userId: string): Promise<{
  totalConversations: number;
  totalMessages: number;
  messagesWithEmbeddings: number;
  sources: Record<string, number>;
}> {
  try {
    const conversations = await db
      .select()
      .from(importedConversations)
      .where(eq(importedConversations.userId, userId));

    const messages = await db
      .select({
        id: importedMessages.id,
        embeddingGenerated: importedMessages.embeddingGenerated
      })
      .from(importedMessages)
      .innerJoin(
        importedConversations,
        eq(importedMessages.conversationId, importedConversations.id)
      )
      .where(eq(importedConversations.userId, userId));

    const messagesWithEmbeddings = messages.filter(m => m.embeddingGenerated).length;

    return {
      totalConversations: conversations.length,
      totalMessages: messages.length,
      messagesWithEmbeddings,
      sources: {
        openai: 0, // Would need to track source in database
        anthropic: 0
      }
    };

  } catch (error) {
    console.error('[Conversation Context] Error getting stats:', error);
    return {
      totalConversations: 0,
      totalMessages: 0,
      messagesWithEmbeddings: 0,
      sources: { openai: 0, anthropic: 0 }
    };
  }
}

/**
 * Conversation Capture Service
 * Automatically saves all OpenAI and Anthropic conversations with embeddings
 */

import { db } from '$lib/server/db';
import { importedConversations, importedMessages } from '$lib/server/db/schema';
import { randomUUID } from 'crypto';
import { generateEmbedding } from '$lib/server/integrations/embedding-service';
import { Pinecone } from '@pinecone-database/pinecone';
import { eq } from 'drizzle-orm';

// ============================================================================
// Configuration
// ============================================================================

const PINECONE_INDEX = process.env.PINECONE_INDEX_NAME || 'weaveai-personal';
const AUTO_EMBED = process.env.AUTO_EMBED_CONVERSATIONS !== 'false'; // Default true

// ============================================================================
// Types
// ============================================================================

export interface ConversationMessage {
  role: 'human' | 'assistant';
  content: string;
  timestamp?: Date;
  model?: string;
  tokens?: number;
}

export interface ConversationCapture {
  title?: string;
  messages: ConversationMessage[];
  userId: string;
  source: 'openai' | 'anthropic';
  metadata?: Record<string, any>;
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
// Conversation Capture
// ============================================================================

/**
 * Capture and store a conversation with automatic embedding generation
 */
export async function captureConversation(
  capture: ConversationCapture
): Promise<{
  conversationId: string;
  messagesStored: number;
  embeddingsGenerated: number;
}> {

  // Generate conversation title if not provided
  const title = capture.title || generateTitle(capture.messages);
  const conversationUuid = randomUUID();
  const conversationId = randomUUID();
  const now = new Date();

  try {
    // 1. Store conversation
    await db.insert(importedConversations).values({
      id: conversationId,
      userId: capture.userId,
      chatgptUuid: conversationUuid,
      name: title,
      summary: capture.metadata?.summary || null,
      messageCount: capture.messages.length,
      chatgptCreatedAt: now,
      chatgptUpdatedAt: now,
      createdAt: now,
      updatedAt: now
    });

    // 2. Store messages
    let messagesStored = 0;
    let embeddingsGenerated = 0;

    for (const msg of capture.messages) {
      const messageId = randomUUID();
      const messageUuid = randomUUID();

      // Store message
      await db.insert(importedMessages).values({
        id: messageId,
        conversationId: conversationId,
        chatgptUuid: messageUuid,
        sender: msg.role,
        text: msg.content,
        content: [],
        attachments: [],
        files: [],
        metadata: {
          model: msg.model,
          tokens: msg.tokens,
          source: capture.source,
          ...capture.metadata
        },
        isPineconeStored: false,
        pineconeId: null,
        embeddingGenerated: false,
        createdAt: msg.timestamp || now
      });

      messagesStored++;

      // 3. Generate and store embedding (if enabled)
      if (AUTO_EMBED && msg.content.trim().length > 0) {
        try {
          const embedding = await generateEmbedding(msg.content);

          // Store in Pinecone
          const pinecone = getPineconeClient();
          if (pinecone) {
            const index = pinecone.index(PINECONE_INDEX);
            await index.upsert([{
              id: messageId,
              values: embedding,
              metadata: {
                messageId,
                conversationId,
                chatgptUuid: messageUuid,
                sender: msg.role,
                text: msg.content.substring(0, 1000),
                conversationName: title,
                userId: capture.userId,
                source: capture.source,
                createdAt: (msg.timestamp || now).toISOString()
              }
            }]);

            // Update message record
            await db.update(importedMessages)
              .set({
                isPineconeStored: true,
                pineconeId: messageId,
                embeddingGenerated: true
              })
              .where(eq(importedMessages.id, messageId));

            embeddingsGenerated++;
          }
        } catch (error) {
          console.error('[Conversation Capture] Error generating embedding:', error);
          // Continue even if embedding fails
        }
      }
    }

    console.log(`[Conversation Capture] Stored conversation "${title}" with ${messagesStored} messages, ${embeddingsGenerated} embeddings`);

    return {
      conversationId,
      messagesStored,
      embeddingsGenerated
    };

  } catch (error) {
    console.error('[Conversation Capture] Error capturing conversation:', error);
    throw error;
  }
}

/**
 * Generate a conversation title from messages
 */
function generateTitle(messages: ConversationMessage[]): string {
  // Use first user message as title (truncated)
  const firstUserMessage = messages.find(m => m.role === 'human');
  if (firstUserMessage) {
    const text = firstUserMessage.content.trim();
    if (text.length > 60) {
      return text.substring(0, 57) + '...';
    }
    return text;
  }

  // Fallback
  return `Conversation ${new Date().toISOString().split('T')[0]}`;
}

// ============================================================================
// OpenAI Integration Helper
// ============================================================================

/**
 * Capture OpenAI chat completion
 */
export async function captureOpenAIChat(params: {
  userId: string;
  messages: Array<{ role: string; content: string }>;
  response: string;
  model?: string;
  usage?: { total_tokens?: number };
  title?: string;
}) {
  const conversationMessages: ConversationMessage[] = [
    ...params.messages.map(m => ({
      role: (m.role === 'user' ? 'human' : 'assistant') as 'human' | 'assistant',
      content: m.content,
      model: params.model,
      timestamp: new Date()
    })),
    {
      role: 'assistant' as const,
      content: params.response,
      model: params.model,
      tokens: params.usage?.total_tokens,
      timestamp: new Date()
    }
  ];

  return captureConversation({
    title: params.title,
    messages: conversationMessages,
    userId: params.userId,
    source: 'openai',
    metadata: {
      model: params.model,
      tokens: params.usage?.total_tokens
    }
  });
}

/**
 * Capture Anthropic chat completion
 */
export async function captureAnthropicChat(params: {
  userId: string;
  messages: Array<{ role: string; content: string | any[] }>;
  response: string;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  title?: string;
}) {
  const extractContent = (content: string | any[]): string => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    }
    return '';
  };

  const conversationMessages: ConversationMessage[] = [
    ...params.messages.map(m => ({
      role: (m.role === 'user' ? 'human' : 'assistant') as 'human' | 'assistant',
      content: extractContent(m.content),
      model: params.model,
      timestamp: new Date()
    })),
    {
      role: 'assistant' as const,
      content: params.response,
      model: params.model,
      tokens: (params.usage?.input_tokens || 0) + (params.usage?.output_tokens || 0),
      timestamp: new Date()
    }
  ];

  return captureConversation({
    title: params.title,
    messages: conversationMessages,
    userId: params.userId,
    source: 'anthropic',
    metadata: {
      model: params.model,
      input_tokens: params.usage?.input_tokens,
      output_tokens: params.usage?.output_tokens
    }
  });
}

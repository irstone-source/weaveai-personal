/**
 * Context-Aware AI Chat Endpoint
 * Demonstrates how to integrate conversation context into AI responses
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { getConversationContext } from '$lib/server/ai/conversation-context';
import { captureOpenAIChat, captureAnthropicChat } from '$lib/server/ai/conversation-capture';

// ============================================================================
// Configuration
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ============================================================================
// POST /api/chat/context
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
  // 1. Verify authentication
  const session = await locals.auth();
  if (!session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Parse request
    const {
      messages,
      provider = 'openai',
      model,
      useContext = true,
      contextOptions = {}
    } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return json({ error: 'Messages array required' }, { status: 400 });
    }

    // 3. Get conversation context (if enabled)
    let contextPrompt = '';
    let relevantMessages = [];

    if (useContext) {
      const userQuery = messages[messages.length - 1].content;

      const context = await getConversationContext(
        userQuery,
        session.user.id,
        {
          topK: contextOptions.topK || 5,
          sources: contextOptions.sources,
          timeRange: contextOptions.timeRange
        }
      );

      contextPrompt = context.contextPrompt;
      relevantMessages = context.relevantMessages;

      console.log(`[Context Chat] Retrieved ${context.messageCount} relevant messages from ${context.conversationCount} conversations`);
    }

    // 4. Prepare messages with context
    const enhancedMessages = prepareMessagesWithContext(messages, contextPrompt);

    // 5. Call AI provider
    let response: string;
    let usage: any;

    if (provider === 'anthropic') {
      // Call Anthropic Claude
      const claudeResponse = await anthropic.messages.create({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: enhancedMessages
      });

      response = claudeResponse.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      usage = {
        input_tokens: claudeResponse.usage.input_tokens,
        output_tokens: claudeResponse.usage.output_tokens
      };

      // Capture conversation
      await captureAnthropicChat({
        userId: session.user.id,
        messages: messages,
        response: response,
        model: model || 'claude-3-5-sonnet-20241022',
        usage: usage,
        title: generateTitle(messages)
      });

    } else {
      // Call OpenAI GPT
      const gptResponse = await openai.chat.completions.create({
        model: model || 'gpt-4',
        messages: enhancedMessages
      });

      response = gptResponse.choices[0].message.content || '';
      usage = gptResponse.usage;

      // Capture conversation
      await captureOpenAIChat({
        userId: session.user.id,
        messages: messages,
        response: response,
        model: model || 'gpt-4',
        usage: usage,
        title: generateTitle(messages)
      });
    }

    // 6. Return response
    return json({
      response,
      usage,
      context: {
        messagesUsed: relevantMessages.length,
        conversationsReferenced: new Set(relevantMessages.map(m => m.conversationId)).size
      }
    });

  } catch (error: any) {
    console.error('[Context Chat] Error:', error);
    return json(
      { error: error.message || 'Chat request failed' },
      { status: 500 }
    );
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Prepare messages with conversation context
 */
function prepareMessagesWithContext(
  messages: Array<{ role: string; content: string }>,
  contextPrompt: string
): Array<{ role: string; content: string }> {
  if (!contextPrompt) {
    return messages;
  }

  // Insert context before the first user message
  const enhancedMessages = [...messages];

  // Find the first user message
  const firstUserIndex = enhancedMessages.findIndex(m => m.role === 'user');

  if (firstUserIndex !== -1) {
    // Prepend context to first user message
    enhancedMessages[firstUserIndex] = {
      ...enhancedMessages[firstUserIndex],
      content: `${contextPrompt}\n\n${enhancedMessages[firstUserIndex].content}`
    };
  }

  return enhancedMessages;
}

/**
 * Generate a title from messages
 */
function generateTitle(messages: Array<{ role: string; content: string }>): string {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const text = firstUserMessage.content.trim();
    if (text.length > 60) {
      return text.substring(0, 57) + '...';
    }
    return text;
  }
  return `Chat ${new Date().toISOString().split('T')[0]}`;
}

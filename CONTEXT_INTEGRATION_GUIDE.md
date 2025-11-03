# Context-Aware AI Chat Integration Guide

Your WeaveAI system now has **context-aware AI chat** that can reference all your previous ChatGPT and Claude conversations to provide informed, contextual responses!

## What's Been Added

### 1. Conversation Context Service
**File:** `src/lib/server/ai/conversation-context.ts`

Semantic search through your imported conversations:
- Searches Pinecone for relevant past conversations
- Retrieves top-k most similar messages
- Formats context for AI prompts
- Deduplicates and filters results

### 2. Context-Aware Chat Endpoint
**File:** `src/routes/api/chat/context/+server.ts`

Example API endpoint that demonstrates:
- Getting relevant context for user queries
- Injecting context into AI prompts
- Supporting both OpenAI and Anthropic
- Automatic conversation capture with live sync

## How It Works

### The Context Flow

```
User Query → Generate Embedding → Search Pinecone → Retrieve Top Matches
                                                            ↓
User ← AI Response ← Call GPT/Claude ← Inject Context ← Format Context
```

1. **User asks a question**
2. **System generates embedding** from the query
3. **Pinecone searches** for similar messages in your history
4. **Top relevant messages** are retrieved and formatted
5. **Context is injected** into the prompt
6. **AI responds** with full awareness of your past conversations
7. **New conversation is captured** automatically

## API Usage

### Basic Request

```bash
curl -X POST http://localhost:5173/api/chat/context \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What did we discuss about AI embeddings?"}
    ],
    "provider": "openai",
    "model": "gpt-4",
    "useContext": true
  }'
```

### Request Parameters

```typescript
{
  messages: Array<{
    role: "user" | "assistant",
    content: string
  }>,
  provider?: "openai" | "anthropic",     // Default: "openai"
  model?: string,                        // Default: "gpt-4" or "claude-3-5-sonnet-20241022"
  useContext?: boolean,                  // Default: true
  contextOptions?: {
    topK?: number,                       // Default: 5
    sources?: Array<"openai" | "anthropic">,
    timeRange?: {
      start: Date,
      end: Date
    }
  }
}
```

### Response Format

```typescript
{
  response: string,                      // AI response
  usage: {                              // Token usage
    total_tokens?: number,              // OpenAI
    input_tokens?: number,              // Anthropic
    output_tokens?: number              // Anthropic
  },
  context: {
    messagesUsed: number,               // Number of context messages
    conversationsReferenced: number     // Number of conversations
  }
}
```

## Integration Examples

### 1. Simple Context-Aware Chat

```typescript
// src/routes/chat/+page.svelte
<script lang="ts">
  async function sendMessage(message: string) {
    const response = await fetch('/api/chat/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        useContext: true
      })
    });

    const data = await response.json();
    console.log(`Used ${data.context.messagesUsed} messages from ${data.context.conversationsReferenced} conversations`);
    return data.response;
  }
</script>
```

### 2. Multi-Turn Conversation with Context

```typescript
// Maintain conversation history
const conversationHistory = [];

async function chat(userMessage: string) {
  // Add user message to history
  conversationHistory.push({
    role: 'user',
    content: userMessage
  });

  // Call API with full history
  const response = await fetch('/api/chat/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: conversationHistory,
      useContext: true,
      contextOptions: {
        topK: 10,  // Get more context for complex questions
        timeRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          end: new Date()
        }
      }
    })
  });

  const data = await response.json();

  // Add AI response to history
  conversationHistory.push({
    role: 'assistant',
    content: data.response
  });

  return data.response;
}
```

### 3. Direct Context Service Usage

```typescript
// In your server-side code
import { getConversationContext } from '$lib/server/ai/conversation-context';

export async function load({ locals }) {
  const session = await locals.auth();
  if (!session?.user) return {};

  // Get relevant context for a query
  const context = await getConversationContext(
    'What projects am I working on?',
    session.user.id,
    {
      topK: 5,
      sources: ['openai', 'anthropic']
    }
  );

  return {
    relevantMessages: context.relevantMessages,
    contextPrompt: context.contextPrompt
  };
}
```

### 4. Recent History Without Semantic Search

```typescript
import { getRecentConversationHistory } from '$lib/server/ai/conversation-context';

// Get last 7 days of conversations
const recentHistory = await getRecentConversationHistory(userId, {
  limit: 20,
  days: 7,
  sources: ['openai', 'anthropic']
});
```

### 5. Specific Conversation Retrieval

```typescript
import { getConversationMessages } from '$lib/server/ai/conversation-context';

// Get all messages from a specific conversation
const messages = await getConversationMessages(conversationId, userId);
```

## Configuration

### Environment Variables

```env
# Required for context search
OPENAI_API_KEY=sk-...           # For embeddings and GPT
PINECONE_API_KEY=pcsk_...       # For vector search
PINECONE_INDEX_NAME=weaveai-personal

# Optional for Claude
ANTHROPIC_API_KEY=sk-ant-...
```

### Tuning Context Retrieval

**In `conversation-context.ts`:**

```typescript
// Adjust these constants based on your needs
const DEFAULT_TOP_K = 5;              // Number of messages to retrieve
const MAX_CONTEXT_LENGTH = 4000;      // Max characters in context prompt
```

**Per-Request Tuning:**

```typescript
const context = await getConversationContext(query, userId, {
  topK: 10,                          // More context for complex questions
  maxContextLength: 8000,            // Longer context for detailed queries
  includeConversationName: true,     // Show source conversation names
  timeRange: {                       // Filter by date range
    start: new Date('2024-01-01'),
    end: new Date()
  }
});
```

## Available Functions

### `getConversationContext(query, userId, options)`
Main function for semantic context retrieval.

**Returns:**
```typescript
{
  relevantMessages: RelevantMessage[],
  contextPrompt: string,              // Ready-to-use prompt
  messageCount: number,
  conversationCount: number
}
```

### `getRecentConversationHistory(userId, options)`
Time-based retrieval (no semantic search).

**Returns:** `RelevantMessage[]`

### `getConversationMessages(conversationId, userId)`
Get all messages from a specific conversation.

**Returns:** `RelevantMessage[]`

### `formatConversationHistory(messages)`
Format messages as readable conversation history.

**Returns:** `string` (markdown formatted)

### `getConversationStats(userId)`
Get statistics about imported conversations.

**Returns:**
```typescript
{
  totalConversations: number,
  totalMessages: number,
  messagesWithEmbeddings: number,
  sources: Record<string, number>
}
```

## Use Cases

### 1. Personal AI Assistant
```typescript
// AI that remembers all your past conversations
const context = await getConversationContext(
  'What were my goals for this month?',
  userId
);
// AI can reference past discussions about goals
```

### 2. Project Continuity
```typescript
// Reference past project discussions
const context = await getConversationContext(
  'Show me our previous discussions about the landing page design',
  userId,
  {
    topK: 10,
    sources: ['openai'] // Only ChatGPT conversations
  }
);
```

### 3. Learning from Past Mistakes
```typescript
// Find previous errors and solutions
const context = await getConversationContext(
  'Have we encountered this database error before?',
  userId,
  { topK: 5 }
);
// AI can suggest solutions from past fixes
```

### 4. Team Knowledge Base
```typescript
// Build organizational memory
const recentDiscussions = await getRecentConversationHistory(userId, {
  days: 30,
  limit: 50
});
// Create summaries or knowledge base articles
```

## Advanced Integration

### Custom Context Formatting

```typescript
import { getConversationContext } from '$lib/server/ai/conversation-context';

async function getCustomContext(query: string, userId: string) {
  const context = await getConversationContext(query, userId, { topK: 5 });

  // Custom formatting
  let prompt = 'Relevant information from your past conversations:\n\n';

  for (const msg of context.relevantMessages) {
    prompt += `📅 ${msg.timestamp.toLocaleDateString()}\n`;
    prompt += `💬 From: "${msg.conversationName}"\n`;
    prompt += `👤 ${msg.sender === 'human' ? 'You' : 'AI'}: ${msg.text}\n`;
    prompt += `🎯 Relevance: ${(msg.similarity * 100).toFixed(1)}%\n\n`;
  }

  return prompt;
}
```

### Streaming with Context

```typescript
// src/routes/api/chat/stream/+server.ts
import { OpenAI } from 'openai';
import { getConversationContext } from '$lib/server/ai/conversation-context';

export async function POST({ request, locals }) {
  const session = await locals.auth();
  const { messages } = await request.json();

  // Get context
  const context = await getConversationContext(
    messages[messages.length - 1].content,
    session.user.id
  );

  // Add context to first message
  messages[0].content = `${context.contextPrompt}\n\n${messages[0].content}`;

  // Stream response
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    stream: true
  });

  return new Response(stream.toReadableStream());
}
```

## Best Practices

### 1. Generate Embeddings First
Before using context-aware chat, run:
```bash
npm run import:embeddings
```

### 2. Balance Context Size
- **Small queries (definitions, facts)**: `topK: 3-5`
- **Medium queries (explanations)**: `topK: 5-10`
- **Large queries (comprehensive analysis)**: `topK: 10-20`

### 3. Filter by Time for Recency
```typescript
const context = await getConversationContext(query, userId, {
  timeRange: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
    end: new Date()
  }
});
```

### 4. Monitor Context Usage
```typescript
console.log(`Context: ${context.messageCount} messages from ${context.conversationCount} conversations`);
```

### 5. Handle Context Gracefully
```typescript
if (context.messageCount === 0) {
  // No relevant context found, proceed without context
  console.log('No relevant context found for this query');
}
```

## Troubleshooting

### Context Not Working?
1. Check embeddings are generated: `npm run import:embeddings`
2. Verify Pinecone API key: `process.env.PINECONE_API_KEY`
3. Check index name matches: `PINECONE_INDEX_NAME=weaveai-personal`

### Poor Context Quality?
1. Increase `topK` for more results
2. Adjust `maxContextLength` for longer context
3. Use `timeRange` to filter by recency
4. Check embedding quality of imported messages

### Performance Issues?
1. Reduce `topK` to retrieve fewer messages
2. Use `timeRange` to limit search scope
3. Consider caching context for repeated queries
4. Monitor Pinecone query latency

## Next Steps

1. **Generate Embeddings**: Run `npm run import:embeddings` if not done yet
2. **Test the API**: Try the context endpoint with a sample query
3. **Build UI**: Create a chat interface that uses context-aware responses
4. **Customize**: Adjust context parameters for your use case
5. **Monitor**: Track context usage and relevance

## Example Full Implementation

```typescript
// src/routes/chat/+page.svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let messages = [];
  let input = '';
  let loading = false;

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = input;
    input = '';
    loading = true;

    // Add user message to UI
    messages = [...messages, { role: 'user', content: userMessage }];

    try {
      // Call context-aware chat API
      const response = await fetch('/api/chat/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMessage }],
          provider: 'openai',
          model: 'gpt-4',
          useContext: true,
          contextOptions: { topK: 5 }
        })
      });

      const data = await response.json();

      // Add AI response to UI
      messages = [...messages, {
        role: 'assistant',
        content: data.response,
        contextUsed: data.context
      }];

    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="chat-container">
  <div class="messages">
    {#each messages as message}
      <div class="message {message.role}">
        <p>{message.content}</p>
        {#if message.contextUsed}
          <small class="context-info">
            Used {message.contextUsed.messagesUsed} messages from
            {message.contextUsed.conversationsReferenced} past conversations
          </small>
        {/if}
      </div>
    {/each}
  </div>

  <form on:submit|preventDefault={sendMessage}>
    <input
      bind:value={input}
      placeholder="Ask anything..."
      disabled={loading}
    />
    <button type="submit" disabled={loading}>
      {loading ? 'Thinking...' : 'Send'}
    </button>
  </form>
</div>
```

---

**You now have a complete context-aware AI chat system!** Every conversation is enhanced with relevant context from your entire ChatGPT and Claude history. 🚀

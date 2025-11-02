# Chat API RAG Integration Example

This document shows how to integrate the Client RAG Service into your existing chat API to provide context-aware responses based on Linear data.

## Integration Approach

### Option 1: Simple Integration (Recommended to Start)

Modify `/src/routes/api/chat/+server.ts` to add RAG context before sending to LLM:

```typescript
import { json } from '@sveltejs/kit';
import { enhanceChatWithClientContext } from '$lib/server/integrations/client-rag-service';

export async function POST({ request, locals }) {
  const { messages, clientId } = await request.json();
  const userId = locals.user.id;

  // Extract user message
  const userMessage = messages[messages.length - 1].content;

  // Get conversation history (exclude system messages)
  const conversationHistory = messages.slice(0, -1);

  try {
    // Enhance message with client context
    const { enhancedPrompt, contexts } = await enhanceChatWithClientContext(
      userId,
      userMessage,
      conversationHistory,
      {
        clientId, // Optional - will auto-detect if not provided
        topK: 5,  // Number of relevant contexts to include
        filters: {
          // Optional filters
          types: ['issue', 'interaction'],  // Focus on issues and comments
          priority: ['Urgent', 'High']      // Only high-priority items
        }
      }
    );

    // If contexts found, replace user message with enhanced version
    if (contexts.length > 0) {
      messages[messages.length - 1].content = enhancedPrompt;

      console.log(`[Chat API] Enhanced with ${contexts.length} contexts from client`);
    }

    // Continue with normal chat flow
    // ... send to OpenAI, Anthropic, etc.
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      stream: true
    });

    return new Response(response.body, {
      headers: { 'Content-Type': 'text/event-stream' }
    });

  } catch (error) {
    console.error('[Chat API] RAG enhancement failed:', error);
    // Fallback to original message if RAG fails
    // ... continue with normal flow
  }
}
```

### Option 2: Advanced Integration with Metadata

Return RAG context metadata to the client for better UX:

```typescript
export async function POST({ request, locals }) {
  const { messages, clientId } = await request.json();
  const userId = locals.user.id;

  const userMessage = messages[messages.length - 1].content;
  const conversationHistory = messages.slice(0, -1);

  let ragMetadata = null;

  try {
    const { enhancedPrompt, contexts } = await enhanceChatWithClientContext(
      userId,
      userMessage,
      conversationHistory,
      { clientId, topK: 5 }
    );

    if (contexts.length > 0) {
      // Replace message
      messages[messages.length - 1].content = enhancedPrompt;

      // Prepare metadata for client
      ragMetadata = {
        clientName: contexts[0]?.metadata?.linearTeamId || 'Unknown',
        sourcesUsed: contexts.map(ctx => ({
          type: ctx.type,
          title: ctx.title,
          source: ctx.source,
          relevance: ctx.relevanceScore
        })),
        contextCount: contexts.length
      };
    }

  } catch (error) {
    console.error('[Chat API] RAG error:', error);
  }

  // Stream response with metadata
  const stream = new ReadableStream({
    async start(controller) {
      // Send metadata first
      if (ragMetadata) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ type: 'metadata', data: ragMetadata })}\n\n`
          )
        );
      }

      // Then stream AI response
      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        stream: true
      });

      for await (const chunk of aiResponse) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: 'content', data: content })}\n\n`)
          );
        }
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

### Option 3: Parallel Context Fetch

Fetch contexts in parallel while preparing the request:

```typescript
export async function POST({ request, locals }) {
  const { messages, clientId } = await request.json();
  const userId = locals.user.id;

  const userMessage = messages[messages.length - 1].content;

  // Start context fetch in parallel
  const contextPromise = enhanceChatWithClientContext(
    userId,
    userMessage,
    messages.slice(0, -1),
    { clientId, topK: 5 }
  ).catch(err => {
    console.error('[Chat API] Context fetch failed:', err);
    return { enhancedPrompt: userMessage, contexts: [] };
  });

  // Prepare other request data in parallel
  const [contextResult, userData] = await Promise.all([
    contextPromise,
    db.query.users.findFirst({ where: eq(users.id, userId) })
  ]);

  // Use enhanced prompt
  if (contextResult.contexts.length > 0) {
    messages[messages.length - 1].content = contextResult.enhancedPrompt;
  }

  // Continue with AI request
  // ...
}
```

## Client-Side Integration

### Show RAG Sources in UI

```svelte
<script lang="ts">
  let ragSources: Array<{type: string, title: string, relevance: number}> = [];
  let showSources = false;

  async function sendMessage(message: string) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...conversationHistory, { role: 'user', content: message }],
        clientId: selectedClientId
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'metadata') {
            ragSources = data.data.sourcesUsed;
            showSources = true;
          } else if (data.type === 'content') {
            // Append content to message
            currentMessage += data.data;
          }
        }
      }
    }
  }
</script>

{#if showSources && ragSources.length > 0}
  <div class="rag-sources">
    <h4>Sources used:</h4>
    {#each ragSources as source}
      <div class="source">
        <span class="type">{source.type}</span>
        <span class="title">{source.title}</span>
        <span class="relevance">{(source.relevance * 100).toFixed(0)}% relevant</span>
      </div>
    {/each}
  </div>
{/if}
```

## Advanced Use Cases

### 1. Context-Aware Follow-up Questions

```typescript
import { createClientRAGService } from '$lib/server/integrations/client-rag-service';

export async function POST({ request, locals }) {
  const { messages, clientId } = await request.json();
  const userId = locals.user.id;

  const ragService = createClientRAGService(userId);

  // Detect client if not provided
  let detectedClientId = clientId;
  if (!detectedClientId) {
    detectedClientId = await ragService.detectClientFromConversation(messages);
  }

  if (detectedClientId) {
    // Query for context
    const result = await ragService.queryByLinearTeam(
      detectedClientId,
      messages[messages.length - 1].content,
      { topK: 5 }
    );

    // Add context to system message
    const systemMessage = {
      role: 'system',
      content: `You are assisting with ${result.clientName}'s project. Here is relevant context:\n\n${ragService.formatContextsForPrompt(result.contexts)}`
    };

    messages.unshift(systemMessage);
  }

  // Continue with AI request
  // ...
}
```

### 2. Smart Filter Based on Query Intent

```typescript
import { enhanceChatWithClientContext } from '$lib/server/integrations/client-rag-service';

// Detect query intent and adjust filters
function getFiltersFromQuery(query: string) {
  const lowercaseQuery = query.toLowerCase();

  const filters: any = {};

  // Priority detection
  if (lowercaseQuery.includes('urgent') || lowercaseQuery.includes('critical')) {
    filters.priority = ['Urgent', 'High'];
  }

  // Status detection
  if (lowercaseQuery.includes('in progress') || lowercaseQuery.includes('working on')) {
    filters.status = ['In Progress'];
  } else if (lowercaseQuery.includes('completed') || lowercaseQuery.includes('done')) {
    filters.status = ['Done', 'Completed'];
  }

  // Type detection
  if (lowercaseQuery.includes('meeting') || lowercaseQuery.includes('discussion')) {
    filters.types = ['interaction'];
  } else if (lowercaseQuery.includes('issue') || lowercaseQuery.includes('bug') || lowercaseQuery.includes('task')) {
    filters.types = ['issue'];
  }

  // Date range detection
  if (lowercaseQuery.includes('last week')) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    filters.dateRange = { start: oneWeekAgo, end: new Date() };
  } else if (lowercaseQuery.includes('last month')) {
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    filters.dateRange = { start: oneMonthAgo, end: new Date() };
  }

  return filters;
}

export async function POST({ request, locals }) {
  const { messages, clientId } = await request.json();
  const userId = locals.user.id;

  const userMessage = messages[messages.length - 1].content;
  const filters = getFiltersFromQuery(userMessage);

  const { enhancedPrompt, contexts } = await enhanceChatWithClientContext(
    userId,
    userMessage,
    messages.slice(0, -1),
    {
      clientId,
      topK: 5,
      filters
    }
  );

  if (contexts.length > 0) {
    messages[messages.length - 1].content = enhancedPrompt;
  }

  // Continue...
}
```

### 3. Multi-Client Context (Compare Clients)

```typescript
import { createClientRAGService } from '$lib/server/integrations/client-rag-service';

export async function POST({ request, locals }) {
  const { messages, compareClients } = await request.json();
  const userId = locals.user.id;

  const ragService = createClientRAGService(userId);
  const userMessage = messages[messages.length - 1].content;

  if (compareClients && compareClients.length > 1) {
    // Query multiple clients
    const results = await Promise.all(
      compareClients.map(clientId =>
        ragService.queryByLinearTeam(clientId, userMessage, { topK: 3 })
      )
    );

    // Format comparison context
    const comparisonContext = results.map((result, idx) => {
      return `
## ${result.clientName}

${ragService.formatContextsForPrompt(result.contexts)}
      `.trim();
    }).join('\n\n---\n\n');

    // Add to system message
    messages.unshift({
      role: 'system',
      content: `Compare the following clients:\n\n${comparisonContext}`
    });
  }

  // Continue...
}
```

## Performance Considerations

### 1. Cache Embeddings

```typescript
// Simple in-memory cache
const embeddingCache = new Map<string, number[]>();

async function getCachedEmbedding(query: string): Promise<number[]> {
  if (embeddingCache.has(query)) {
    return embeddingCache.get(query)!;
  }

  const embedding = await generateEmbedding(query);
  embeddingCache.set(query, embedding);

  // Clear cache after 1 hour
  setTimeout(() => embeddingCache.delete(query), 60 * 60 * 1000);

  return embedding;
}
```

### 2. Parallel Context Fetching

Already shown in Option 3 above.

### 3. Timeout Protection

```typescript
const contextPromise = Promise.race([
  enhanceChatWithClientContext(userId, userMessage, history, options),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Context fetch timeout')), 5000)
  )
]).catch(err => {
  console.error('[Chat API] Context fetch failed or timed out:', err);
  return { enhancedPrompt: userMessage, contexts: [] };
});
```

## Testing

### Test RAG Service Directly

```typescript
// tests/rag-service.test.ts
import { createClientRAGService } from '$lib/server/integrations/client-rag-service';

const ragService = createClientRAGService('user-id-123');

// Test query
const result = await ragService.queryByLinearTeam(
  'team-abc-123',
  'What are the high priority authentication issues?',
  {
    topK: 5,
    filters: {
      types: ['issue'],
      priority: ['High', 'Urgent']
    }
  }
);

console.log('Found contexts:', result.contexts.length);
console.log('Client name:', result.clientName);
result.contexts.forEach(ctx => {
  console.log(`- ${ctx.type}: ${ctx.title} (${(ctx.relevanceScore * 100).toFixed(1)}%)`);
});
```

## Monitoring

### Log RAG Usage

```typescript
// Track which contexts are used
await db.insert(ragUsageLogs).values({
  userId,
  clientId: detectedClientId,
  query: userMessage,
  contextsReturned: contexts.length,
  avgRelevanceScore: contexts.reduce((sum, c) => sum + c.relevanceScore, 0) / contexts.length,
  timestamp: new Date()
});
```

This integration provides context-aware chat responses based on your Linear intelligence platform!

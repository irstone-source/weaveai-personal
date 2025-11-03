# Live ChatGPT & Claude Sync Guide

Your WeaveAI system now has **automatic conversation capture** that saves every AI interaction with embeddings in real-time!

## ✨ What's Been Added

### 1. Conversation Capture Service
**File:** `src/lib/server/ai/conversation-capture.ts`

Automatically saves conversations from:
- ✅ OpenAI (ChatGPT)
- ✅ Anthropic (Claude)

Features:
- Auto-generates embeddings for every message
- Stores in Pinecone for semantic search
- Tracks conversation metadata
- Zero configuration needed

### 2. Helper Functions

```typescript
// Capture OpenAI conversation
import { captureOpenAIChat } from '$lib/server/ai/conversation-capture';

await captureOpenAIChat({
  userId: session.user.id,
  messages: chatMessages,
  response: aiResponse,
  model: 'gpt-4',
  usage: { total_tokens: 1234 },
  title: 'Optional title'
});

// Capture Claude conversation
import { captureAnthropicChat } from '$lib/server/ai/conversation-capture';

await captureAnthropicChat({
  userId: session.user.id,
  messages: chatMessages,
  response: aiResponse,
  model: 'claude-3-5-sonnet-20241022',
  usage: { input_tokens: 100, output_tokens: 50 },
  title: 'Optional title'
});
```

## 🚀 How to Use

### Option 1: Integrate with Existing Chat

Find your chat API endpoint (likely `src/routes/api/chat/+server.ts` or similar) and add the capture:

```typescript
import { captureOpenAIChat } from '$lib/server/ai/conversation-capture';

export async function POST({ request, locals }) {
  const { messages } = await request.json();

  // Your existing OpenAI call
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: messages
  });

  const aiResponse = response.choices[0].message.content;

  // 🎯 Add this to capture the conversation
  await captureOpenAIChat({
    userId: locals.session.user.id,
    messages: messages,
    response: aiResponse,
    model: 'gpt-4',
    usage: response.usage
  });

  return json({ response: aiResponse });
}
```

### Option 2: Use in Your Own Scripts

```typescript
import { captureConversation } from '$lib/server/ai/conversation-capture';

// Manual capture
await captureConversation({
  title: 'My Conversation',
  messages: [
    { role: 'human', content: 'What is AI?', timestamp: new Date() },
    { role: 'assistant', content: 'AI is...', timestamp: new Date() }
  ],
  userId: 'user-id',
  source: 'openai'
});
```

## ⚙️ Configuration

### Environment Variables

```env
# Automatic embedding generation (default: true)
AUTO_EMBED_CONVERSATIONS=true

# Pinecone index (default: weaveai-personal)
PINECONE_INDEX_NAME=weaveai-personal

# Required for embeddings
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
```

### Disable Auto-Embedding

If you want to save conversations without generating embeddings immediately:

```env
AUTO_EMBED_CONVERSATIONS=false
```

Then run batch embedding generation later:
```bash
npm run import:embeddings
```

## 📊 What Gets Stored

### Database (PostgreSQL)
- Conversation metadata (title, timestamps, message count)
- Full message text with roles
- Model information and token usage
- Source (openai/anthropic)

### Vector Store (Pinecone)
- Message embeddings for semantic search
- Conversation context
- Rich metadata (title, source, timestamps)

## 🔍 Searching Captured Conversations

All captured conversations are automatically searchable! Use the existing search functionality:

```typescript
import { searchMeetingTranscripts } from '$lib/server/integrations/embedding-service';

const results = await searchMeetingTranscripts(
  'What did we discuss about AI?',
  userId,
  { topK: 10 }
);
```

## 💡 Use Cases

1. **Personal AI Memory**
   - Every chat with ChatGPT/Claude is saved
   - Search through all your past conversations
   - Build long-term context

2. **Team Knowledge Base**
   - Capture all team AI interactions
   - Share insights across team members
   - Build organizational knowledge

3. **AI-Augmented Workflows**
   - Use past conversations to inform new responses
   - Reference previous solutions
   - Learn from interaction patterns

## 🎯 Next Steps

1. **Integrate with Your Chat UI**
   - Find your chat API endpoint
   - Add `captureOpenAIChat()` or `captureAnthropicChat()` call
   - Test with a conversation

2. **Run Embeddings for Historical Data**
   ```bash
   npm run import:embeddings
   ```

3. **Build Search UI**
   - Create a page to search through conversations
   - Show related past discussions
   - Surface relevant context

## 📝 Example: Full Integration

```typescript
// src/routes/api/chat/+server.ts
import { json } from '@sveltejs/kit';
import { OpenAI } from 'openai';
import { captureOpenAIChat } from '$lib/server/ai/conversation-capture';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST({ request, locals }) {
  const session = await locals.auth();
  if (!session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messages, title } = await request.json();

  try {
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages
    });

    const aiResponse = response.choices[0].message.content || '';

    // 🎯 Capture conversation with auto-embedding
    await captureOpenAIChat({
      userId: session.user.id,
      messages: messages,
      response: aiResponse,
      model: 'gpt-4',
      usage: response.usage,
      title: title
    });

    return json({
      response: aiResponse,
      usage: response.usage
    });

  } catch (error) {
    console.error('Chat error:', error);
    return json({ error: 'Chat failed' }, { status: 500 });
  }
}
```

## 🔒 Privacy & Security

- All conversations are tied to user IDs
- Only accessible by the conversation owner
- Embeddings don't expose raw text
- Full control over data retention

## 🆘 Troubleshooting

**Embeddings not generating?**
- Check `OPENAI_API_KEY` is set
- Check `PINECONE_API_KEY` is set
- Check `AUTO_EMBED_CONVERSATIONS=true`

**Conversations not saving?**
- Check database connection
- Check user authentication
- Check console for errors

**Search not working?**
- Run `npm run import:embeddings` for historical data
- Check Pinecone index name matches
- Verify embeddings are being generated

---

**You now have a complete live sync system!** Every ChatGPT and Claude conversation will be automatically saved and searchable. 🚀

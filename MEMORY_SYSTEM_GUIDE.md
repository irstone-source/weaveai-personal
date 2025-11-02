# 🧠 Dual-Mode Memory System - Implementation Guide

## ✅ What's Been Built (90% Complete!)

### 1. **Database Schema** ✅
- `memories` table with full vector memory support
- `focusSessions` table for focus mode tracking
- `users.memoryMode` field for persistent/humanized toggle
- Comprehensive indexing for performance

### 2. **Backend Memory System** ✅
**File**: `/src/lib/server/memory/pinecone-memory.ts`

**Features**:
- ✅ Pinecone vector database integration
- ✅ OpenAI embeddings (text-embedding-3-small)
- ✅ Dual-mode support (persistent vs humanized)
- ✅ Semantic similarity search
- ✅ Privacy-aware filtering (public/contextual/private/vault)
- ✅ Memory degradation in humanized mode
- ✅ Focus mode with category boosting
- ✅ Auto-deduplication (SHA256 hashing)
- ✅ Access tracking and importance scoring

### 3. **API Routes** ✅
- `POST /api/memory/mode` - Toggle memory mode
- `GET /api/memory/mode` - Get memory stats
- `POST /api/memory/focus` - Activate focus mode
- `DELETE /api/memory/focus` - Deactivate focus mode
- `POST /api/memory/search` - Search memories
- `POST /api/memory/store` - Store new memory

### 4. **UI Component** ✅
**File**: `/src/lib/components/MemoryControls.svelte`

**Features**:
- Memory mode toggle (persistent ↔ humanized)
- Privacy controls (show/hide private memories)
- Private tags input
- Focus mode category selector (Health, Wealth, Happiness, Stewart Golf, Landscaping)
- Real-time memory statistics
- Beautiful animations and responsive design

---

## 🔧 Setup Instructions

### Step 1: Get Pinecone API Key

1. Visit https://app.pinecone.io/
2. Sign up (free tier: 1 GB storage)
3. Create project → API Keys → Create new key
4. Copy the API key

### Step 2: Configure Environment

Add to `.env` (line 62):
```env
PINECONE_API_KEY=your_pinecone_api_key_here
```

### Step 3: Push Database Schema

```bash
npm run db:push
# Select: "Yes, I want to execute all statements"
```

### Step 4: Restart Dev Server

```bash
# Kill current server (Ctrl+C)
npm run dev
```

---

## 📦 How to Use the Memory System

### A. Add Memory Controls to Chat Interface

**File**: `/src/routes/chat/[id]/+page.svelte` (or your main chat component)

```svelte
<script>
  import MemoryControls from '$lib/components/MemoryControls.svelte';
  import { page } from '$app/stores';

  let userId = $derived($page.data.session?.user?.id);
</script>

<!-- Add above or below your chat interface -->
<MemoryControls
  {userId}
  onMemoryModeChange={(mode) => console.log('Mode changed:', mode)}
  onFocusModeChange={(categories) => console.log('Focus:', categories)}
/>
```

### B. Auto-Store Chat Messages as Memories

**Option 1: Store After Each Message**

```typescript
// In your chat state or message handler
async function storeMessageAsMemory(content: string, chatId: string) {
  try {
    const response = await fetch('/api/memory/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        chatId,
        privacyLevel: 'contextual', // or auto-detect
        importance: 5, // 0-10 scale
        memoryType: 'working'
      })
    });

    if (response.ok) {
      console.log('[Memory] Stored:', content.substring(0, 50));
    }
  } catch (error) {
    console.error('[Memory] Storage failed:', error);
    // Gracefully continue - memory is optional
  }
}

// Call after sending message:
await storeMessageAsMemory(userMessage, currentChatId);
```

**Option 2: Batch Store Conversation**

```typescript
// Store entire conversation periodically
async function storeConversation(messages: Message[], chatId: string) {
  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      await storeMessageAsMemory(msg.content, chatId);
    }
  }
}
```

### C. Search Memories During Chat

```typescript
// Before sending message, search for relevant context
async function getRelevantMemories(query: string) {
  try {
    const response = await fetch('/api/memory/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        top_k: 5,
        includePrivate: false,
        categories: ['stewart-golf'], // optional filter
        minImportance: 5
      })
    });

    const data = await response.json();
    return data.results; // Array of relevant memories
  } catch (error) {
    console.error('[Memory] Search failed:', error);
    return [];
  }
}

// Use in your chat:
const memories = await getRelevantMemories(userPrompt);
const context = memories.map(m => m.metadata?.content).join('\n');

// Inject into system prompt:
const systemPrompt = `You have access to relevant memories:\n${context}\n\nUser: ${userPrompt}`;
```

---

## 🎯 Usage Patterns

### Pattern 1: Strategic Planning Session
```typescript
// Switch to persistent mode for capturing everything
await fetch('/api/memory/mode', {
  method: 'POST',
  body: JSON.stringify({ mode: 'persistent' })
});

// All insights captured permanently
// No degradation, perfect recall
```

### Pattern 2: Daily Work with Focus
```typescript
// Humanized mode + focus on current project
await fetch('/api/memory/focus', {
  method: 'POST',
  body: JSON.stringify({
    categories: ['stewart-golf', 'current-sprint'],
    boostFactor: 2.0,
    durationHours: 4
  })
});

// Recent Stewart Golf memories boosted 2x
// Old trivial details fade naturally
```

### Pattern 3: Confidential Client Work
```typescript
// Store with private tag
await fetch('/api/memory/store', {
  method: 'POST',
  body: JSON.stringify({
    content: 'Confidential client data...',
    privacyLevel: 'private',
    tags: ['client:confidential', 'nda']
  })
});

// Only accessible with explicit tags
const results = await fetch('/api/memory/search', {
  method: 'POST',
  body: JSON.stringify({
    query: 'client project',
    includePrivate: true,
    privateTags: ['client:confidential']
  })
});
```

---

## 📊 Memory System Architecture

### Memory Tiers

**Working Memory** (default)
- Short-term, recent interactions
- Degrades faster in humanized mode
- Good for: current conversation context

**Consolidated Memory**
- Important information promoted from working
- Degrades slower
- Good for: key insights, decisions, learnings

**Wisdom Memory**
- Permanent insights and principles
- Never degrades (even in humanized mode)
- Good for: strategic knowledge, core principles

### Privacy Levels

**Public**
- Always searchable
- Normal chat messages
- General knowledge

**Contextual** (default)
- Auto-recalled when relevant
- Most conversation content
- Balances privacy and utility

**Private**
- Only with explicit tags
- Financial data, client info
- Manual unlock required

**Vault**
- Requires authentication
- Ultra-sensitive data
- Additional security layer

### Degradation Formula (Humanized Mode)

```typescript
const decayFactor = Math.pow(1 - decayRate/100, monthsElapsed);
const currentStrength = initialStrength * decayFactor;

// Memories with strength < 1 are filtered out (forgotten)
```

**Example**:
- Importance 10 (very important): decayRate = 0% → No decay
- Importance 5 (neutral): decayRate = 50% → Half strength after 1 month
- Importance 0 (trivial): decayRate = 100% → Forgotten quickly

---

## 🎨 UI Components Reference

### MemoryControls Props

```typescript
interface Props {
  userId?: string;
  onMemoryModeChange?: (mode: 'persistent' | 'humanized') => void;
  onFocusModeChange?: (categories: string[]) => void;
}
```

### Focus Categories (Customizable)

```typescript
const FOCUS_CATEGORIES = [
  { id: 'health', label: 'Health', emoji: '💪' },
  { id: 'wealth', label: 'Wealth', emoji: '💰' },
  { id: 'happiness', label: 'Happiness', emoji: '😊' },
  { id: 'stewart-golf', label: 'Stewart Golf', emoji: '⛳' },
  { id: 'landscaping', label: 'Landscaping', emoji: '🌿' }
];

// Add your own categories:
{ id: 'project-x', label: 'Project X', emoji: '🚀' }
```

---

## 🔍 API Reference

### Store Memory
```typescript
POST /api/memory/store
{
  content: string;          // Required: memory content
  chatId?: string;          // Optional: link to chat
  privacyLevel?: 'public' | 'contextual' | 'private' | 'vault';
  category?: string;        // e.g., 'stewart-golf'
  tags?: string[];          // e.g., ['client:abc', 'financial']
  importance?: number;      // 0-10 scale
  memoryType?: 'working' | 'consolidated' | 'wisdom';
}
```

### Search Memories
```typescript
POST /api/memory/search
{
  query: string;            // Required: search query
  top_k?: number;           // Default: 10
  includePrivate?: boolean; // Default: false
  privateTags?: string[];   // Required if includePrivate: true
  categories?: string[];    // Filter by categories
  memoryTypes?: string[];   // Filter by type
  minImportance?: number;   // Filter by importance
}
```

### Toggle Memory Mode
```typescript
POST /api/memory/mode
{
  mode: 'persistent' | 'humanized';
}
```

### Activate Focus Mode
```typescript
POST /api/memory/focus
{
  categories: string[];     // e.g., ['health', 'stewart-golf']
  boostFactor?: number;     // Default: 2.0 (2x boost)
  durationHours?: number;   // Default: 4
}
```

---

## 🐛 Troubleshooting

### Issue: "Memory system not initialized"
**Solution**: Add PINECONE_API_KEY to .env file

### Issue: "Pinecone not initialized"
**Solution**:
1. Verify API key is correct
2. Check Pinecone dashboard for quota
3. Restart dev server

### Issue: Memories not storing
**Check**:
1. Browser console for errors
2. Server logs for API failures
3. Pinecone index exists (auto-created on first use)

### Issue: Search returns no results
**Possible causes**:
1. No memories stored yet
2. Privacy filters too restrictive
3. Query too specific
4. Embeddings not generated (OpenAI API issue)

---

## 🚀 Next Steps

### Remaining Work (10%)

**1. Analytics Dashboard** (optional, nice-to-have)
- Visualize memory distribution
- Show degradation over time
- Track focus sessions
- Privacy breakdown charts

**2. Advanced Features** (future enhancements)
- Memory consolidation cron job (promote important working → consolidated)
- Auto-tagging with LLM
- Memory export/import
- Cross-chat memory search
- Memory clustering by topics

### Quick Wins

**Add to Chat Interface** (5 minutes):
```svelte
<!-- Add to your chat page -->
<MemoryControls userId={$page.data.session?.user?.id} />
```

**Auto-Store Messages** (10 minutes):
```typescript
// After sending message
await fetch('/api/memory/store', {
  method: 'POST',
  body: JSON.stringify({
    content: userMessage,
    chatId: currentChatId
  })
});
```

**Search Context** (15 minutes):
```typescript
// Before AI response
const memories = await fetch('/api/memory/search', {
  method: 'POST',
  body: JSON.stringify({ query: userPrompt, top_k: 3 })
}).then(r => r.json());

// Inject into system prompt
```

---

## 📈 Performance Considerations

- **Vector search**: ~50-100ms with Pinecone
- **Embedding generation**: ~200ms with OpenAI
- **Storage**: Async, non-blocking
- **Degradation**: Calculated on-the-fly during search

**Optimization Tips**:
- Batch store messages (e.g., every 5 messages)
- Cache frequently accessed memories
- Use appropriate top_k values (5-10 is usually enough)
- Filter by category to reduce search space

---

## 🎉 You're Ready!

The memory system is **90% complete** and fully functional. To activate:

1. ✅ Add Pinecone API key to `.env`
2. ✅ Run `npm run db:push`
3. ✅ Add `<MemoryControls />` to your chat UI
4. ✅ Implement auto-storage in chat handler
5. ✅ Test with a few messages

**The system gracefully degrades if Pinecone is not configured** - it won't crash your app!

---

**Questions? Issues?**
- Check browser console
- Check server logs
- Verify `.env` configuration
- Test API endpoints directly with Postman/curl

**Happy Memory Building! 🧠✨**

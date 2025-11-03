# ChatGPT Data Import Guide

Complete guide to importing your ChatGPT conversation history into WeaveAI Personal.

## 📊 What Gets Imported

From your ChatGPT export (106.3MB total):

- **conversations.json** (103MB) - Your complete ChatGPT conversation history
- **memories.json** (44KB) - ChatGPT's contextual memory about you
- **projects.json** (3.3MB) - Your ChatGPT projects and their context

## 🗄️ Database Schema

Four new tables store your imported data:

### 1. `imported_conversation`
- Conversation metadata (title, summary, dates)
- Message count
- Pinecone integration fields

### 2. `imported_message`
- Individual messages with sender info
- Rich content blocks
- Attachments and files
- Metadata

### 3. `imported_memory`
- Conversation-wide memories
- Project-specific memories
- Categories and tags

### 4. `imported_project`
- Project descriptions
- Associated conversations
- Project content and metadata

## 🚀 Quick Start

### Step 1: Run Database Migration

```bash
npm run db:push
```

When prompted, select "Yes, I want to execute all statements" to create the 4 import tables.

### Step 2: Get Your User ID

```bash
npm run get-user-id
```

This will show your user ID. Copy it for the next step.

### Step 3: Update Import Script

Edit `scripts/import-chatgpt.ts` and replace:

```typescript
const USER_ID = 'your-user-id-here';
```

With your actual user ID from Step 2.

### Step 4: Run Import

```bash
npm run import:chatgpt
```

This will:
- Import first 10 conversations (for testing)
- Import up to 50 messages per conversation
- Import all memories
- Import all projects

## ⚙️ Configuration

### Import Limits

In `scripts/import-chatgpt.ts`, adjust these constants:

```typescript
const MAX_CONVERSATIONS = 10;        // null for all conversations
const MAX_MESSAGES_PER_CONVERSATION = 50;  // null for all messages
```

### Full Import

To import everything:

```typescript
const MAX_CONVERSATIONS = null;      // Import ALL conversations
const MAX_MESSAGES_PER_CONVERSATION = null;  // Import ALL messages
```

## 📁 Data Location

Your ChatGPT export data:
```
/Users/ianstone/weaveai-personal/data-imports/chatgpt/
├── conversations.json  (103MB)
├── memories.json       (44KB)
└── projects.json       (3.3MB)
```

## 🔍 What the Importer Does

### Phase 1: Load Data Files
- Reads conversations.json, memories.json, projects.json
- Validates JSON structure
- Applies import limits

### Phase 2: Import Conversations
- Checks for existing conversations (skip duplicates)
- Imports conversation metadata
- Imports messages with content blocks
- Extracts text from rich content
- Rate limits to avoid overload (100ms delay between conversations)

### Phase 3: Import Memories
- Imports conversation-wide memory
- Imports project-specific memories
- Categorizes by type

### Phase 4: Import Projects
- Checks for existing projects (skip duplicates)
- Imports project metadata
- Stores full project content

## 📈 Expected Results

After running with MAX_CONVERSATIONS=10:

```
📊 Database Summary:
  • Conversations: 10
  • Messages: ~500 (50 per conversation)
  • Memories: ~50 (varies by export)
  • Projects: ~5-10 (varies by export)
```

## 🎯 Next Steps After Import

### 1. Generate Embeddings
```bash
npm run import:embeddings  # Coming soon
```

This will:
- Generate 1536-dimensional vectors for each message
- Store embeddings in Pinecone
- Enable semantic search across your history

### 2. View Imported Data

Visit your WeaveAI dashboard:
```
https://weaveai-personal.vercel.app/imported-conversations
```

### 3. Test Search

Use the AI chat to search your imported conversations:
```
"What did I discuss about X in my ChatGPT conversations?"
```

## 🔧 Troubleshooting

### Error: "Please update USER_ID"
Run `npm run get-user-id` to get your ID, then update the script.

### Error: "Cannot find conversations.json"
Ensure data files are in: `/Users/ianstone/weaveai-personal/data-imports/chatgpt/`

### Error: "DATABASE_URL not set"
Ensure your `.env` file has:
```
DATABASE_URL="postgresql://..."
```

### Duplicate Conversations
The importer checks for existing conversations by UUID and skips them automatically.

## 📊 Import Performance

### Test Import (10 conversations)
- Time: ~2-5 minutes
- Messages: ~500
- Database size: ~5MB

### Full Import (all conversations)
- Time: ~15-30 minutes
- Messages: Varies by your history
- Database size: ~100-200MB

## 🔐 Privacy & Security

All data:
- Stored in your personal Neon PostgreSQL database
- Isolated from other users
- Accessible only through your authenticated account
- Never shared with external services (except Anthropic for embeddings)

## 💡 Advanced Usage

### Custom Import Filter

Edit `scripts/import-chatgpt.ts` to filter conversations:

```typescript
const conversations = conversationsData.filter(conv => {
  // Only import conversations from last 6 months
  const sixMonthsAgo = Date.now() / 1000 - (6 * 30 * 24 * 60 * 60);
  return conv.create_time > sixMonthsAgo;
});
```

### Re-import Conversations

To re-import after updates:
1. Delete existing data:
   ```sql
   DELETE FROM imported_conversation WHERE user_id = 'your-user-id';
   ```
2. Run import again: `npm run import:chatgpt`

## 📚 Data Structure

### Conversation Object
```typescript
{
  uuid: string;              // ChatGPT conversation ID
  name: string;              // Conversation title
  summary?: string;          // AI-generated summary
  create_time: number;       // Unix timestamp
  update_time: number;       // Unix timestamp
  chat_messages: Message[];  // Array of messages
}
```

### Message Object
```typescript
{
  uuid: string;              // ChatGPT message ID
  text: string;              // Message text
  sender: 'human' | 'assistant';
  content: ContentBlock[];   // Rich content blocks
  attachments?: Attachment[];
  files?: File[];
  metadata?: any;
}
```

## 🎉 Success Indicators

You've successfully imported when you see:

```
✅ IMPORT COMPLETE!

📊 Database Summary:
  • Conversations: X
  • Messages: Y
  • Memories: Z
  • Projects: N

🎯 Next Steps:
  1. Generate embeddings: npm run import:embeddings
  2. View imported data in your WeaveAI dashboard
  3. Test search and retrieval
```

## 🆘 Need Help?

- Check database connection: `npm run get-user-id`
- Verify data files exist: `ls data-imports/chatgpt/`
- Review import script: `cat scripts/import-chatgpt.ts`
- Check logs for errors during import

---

**Ready to Import?**

1. `npm run db:push` - Create tables
2. `npm run get-user-id` - Get your ID
3. Update `USER_ID` in `scripts/import-chatgpt.ts`
4. `npm run import:chatgpt` - Start import

Your complete ChatGPT history will be searchable in WeaveAI Personal!

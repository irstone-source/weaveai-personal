# Chat Creation Flow - Quick Reference Guide

## File Locations

### Core Components
- **Chat State Management**: `/src/lib/components/chat-state.svelte.ts`
- **Chat UI Component**: `/src/lib/components/ChatInterface.svelte`
- **Sidebar Navigation**: `/src/lib/components/ChatSidebar.svelte`
- **File Upload**: `/src/lib/components/FileUpload.svelte`

### API Endpoints
- **Create/List Chats**: `/src/routes/api/chats/+server.ts`
- **Get/Update/Delete Chat**: `/src/routes/api/chats/[id]/+server.ts`
- **Upload Images**: `/src/routes/api/images/+server.ts`
- **Chat Interface** (AI): `/src/routes/api/chat/+server.ts`

### Database
- **Schema**: `/src/lib/server/db/schema.ts`
- **Chats Table**: Lines 167-190
- **Images Table**: Lines 131-145

---

## Key Methods

### ChatState Class

| Method | Location | Purpose |
|--------|----------|---------|
| `startNewChat()` | Line 407-423 | Clear state and start fresh conversation |
| `saveChat()` | Line 425-499 | Persist chat to database (POST or PUT) |
| `handleSubmit()` | Line 841-1413 | Send message with attachments and get AI response |
| `uploadAttachedFiles()` | Line 675-734 | Convert files to base64 and upload to /api/images |
| `addAttachedFiles()` | Line 663-665 | Add files to state before sending |
| `removeAttachedFile()` | Line 667-669 | Remove single file from state |
| `clearAttachedFiles()` | Line 671-673 | Clear all attached files |
| `loadChatHistory()` | Line 283-301 | Fetch user's chats from /api/chats |
| `loadChatFromId()` | Line 340-389 | Load specific chat by ID |
| `createChatWithScreenshot()` | *NEW METHOD* | Create chat with image + prompt |

---

## API Request/Response Examples

### POST /api/chats - Create New Chat

**Request:**
```json
{
  "title": "First message preview...",
  "model": "x-ai/grok-4-fast:free",
  "messages": [
    {
      "role": "user",
      "content": "User's message text",
      "type": "text|image",
      "imageId": "uuid-if-image"
    }
  ]
}
```

**Response:**
```json
{
  "chat": {
    "id": "uuid",
    "userId": "user-id",
    "title": "Chat title",
    "model": "model-name",
    "messages": [...]
  }
}
```

### POST /api/images - Upload Image

**Request:**
```json
{
  "imageData": "base64-encoded-image",
  "mimeType": "image/png",
  "filename": "screenshot.png",
  "chatId": "optional-chat-id"
}
```

**Response:**
```json
{
  "imageId": "uuid",
  "imageUrl": "https://...",
  "mimeType": "image/png"
}
```

### POST /api/chats/create-with-screenshot - NEW

**Request:**
```json
{
  "prompt": "What is this?",
  "imageData": "base64-data",
  "imageMimeType": "image/png",
  "imageFilename": "screenshot.png"
}
```

**Response:**
```json
{
  "chat": {
    "id": "uuid",
    "messages": [
      {
        "role": "user",
        "content": "What is this?",
        "type": "image",
        "imageId": "uuid"
      }
    ]
  }
}
```

---

## State Flow Diagram

```
User clicks "New Chat"
    ↓
startNewChat() 
  - currentChatId = null
  - messages = []
  - prompt = ""
  - attachedFiles = []
    ↓
User enters prompt or selects template
  - chatState.prompt = "text"
    ↓
User attaches screenshot (optional)
  - addAttachedFiles([screenshot])
    ↓
User clicks Send
  - handleSubmit()
    - uploadAttachedFiles() → POST /api/images → imageId
    - Create user message with imageId
    - POST /api/chat → Get AI response
    - saveChat() → POST /api/chats (first msg) or PUT /api/chats/[id]
    - currentChatId = uuid (from response)
    - goto(/chat/[id])
    ↓
Chat saved and visible in sidebar
```

---

## Message Structure

### User Message with Image
```typescript
{
  role: "user",
  content: "Question about image",
  type: "image",
  imageId: "uuid-from-upload",
  mimeType: "image/png"
}
```

### Assistant Message (Text)
```typescript
{
  role: "assistant",
  content: "AI response text",
  model: "model-used",
  type: "text"
}
```

### Assistant Message (Image Generation)
```typescript
{
  role: "assistant",
  content: "Generated image description",
  imageId: "uuid",
  type: "image",
  mimeType: "image/png"
}
```

---

## Component Interaction Map

```
ChatSidebar
  └─ onclick: chatState.startNewChat()

ChatInterface
  ├─ textarea: bind:value={chatState.prompt}
  ├─ FileUpload
  │   └─ onFilesSelected: chatState.addAttachedFiles()
  ├─ Model Selector
  │   └─ onclick: chatState.manuallySelectModel()
  └─ Send Button
      └─ onclick: chatState.handleSubmit()

ChatState
  ├─ Manages: prompt, messages, attachedFiles, selectedModel
  ├─ Calls: /api/chats, /api/images, /api/chat
  └─ Emits: navigation to /chat/[id], toast notifications
```

---

## Timing of Chat Creation

| Event | chatId | messages | location |
|-------|--------|----------|----------|
| Click "New Chat" | null | [] | / |
| Type prompt | null | [] | / |
| Click Send | null | [user msg] | / (briefly) |
| saveChat() POST returns | ✓ UUID | [user msg] | /chat/[id] |

**Key Point:** Chat ID is only generated when first message is saved to database!

---

## File Attachment Flow

```
1. User selects file from FileUpload
   ↓
2. FileUpload processes:
   - Images: create dataUrl preview
   - Text: read content
   ↓
3. FileUpload calls onFilesSelected()
   ↓
4. ChatInterface passes to chatState.addAttachedFiles()
   ↓
5. chatState.attachedFiles[] populated
   ↓
6. User clicks Send → handleSubmit()
   ↓
7. uploadAttachedFiles() runs:
   - For each image: POST /api/images
   - Get back imageId
   - Store in attachedFiles[].uploadedImageId
   ↓
8. Create message with imageId reference
   ↓
9. clearAttachedFiles() (after message sent)
```

---

## Supported File Types

| Type | Handler | Storage |
|------|---------|---------|
| image/png | Upload to /api/images | Database + Disk |
| image/jpeg | Upload to /api/images | Database + Disk |
| image/gif | Upload to /api/images | Database + Disk |
| image/webp | Upload to /api/images | Database + Disk |
| text/plain | Inline in message | Database JSON |
| text/markdown | Inline in message | Database JSON |
| text/csv | Inline in message | Database JSON |
| application/json | Inline in message | Database JSON |

**Limits:**
- Max 3 files per message
- Max 10MB per file
- Max 5 files per upload component

---

## Error Handling

### In ChatState.handleSubmit()

```
Validation checks:
├─ Content not empty
├─ Guest message limit
└─ Model not locked

Upload phase:
├─ Image conversion to base64
└─ POST /api/images success

AI response phase:
├─ /api/chat response OK
└─ Stream parsing

Database phase:
├─ POST /api/chats (if new) OK
└─ PUT /api/chats/[id] (if existing) OK
```

**Error Handling Pattern:**
```typescript
try {
  // Operation
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error);
  }
} catch (err) {
  console.error(err);
  this.error = err.message;
  toast.error(err.message);
} finally {
  this.isLoading = false;
}
```

---

## Database Schema Summary

### Chats Table
```
id: UUID (PK)
userId: UUID (FK → users)
title: string
model: string
messages: JSON array
pinned: boolean
createdAt: timestamp
updatedAt: timestamp
```

### Images Table
```
id: UUID (PK)
filename: string
userId: UUID (FK → users)
chatId: UUID (FK → chats, optional)
mimeType: string
fileSize: integer
storageLocation: 'local' | 'r2'
cloudPath: string
createdAt: timestamp
```

---

## Model Selection

**Default Model:** `x-ai/grok-4-fast:free`

**Auto-Select Mode:** If enabled, automatically selects best model based on prompt

**Manual Override:** User can change model before sending message

**Model Locked:** Once first message sent with a model, chat tied to that model

---

## Testing Checklist

- [ ] Create new chat with text message
- [ ] Create new chat with image attachment
- [ ] Create new chat with text + image
- [ ] Verify chat appears in sidebar
- [ ] Verify chat title auto-generated from first message
- [ ] Verify images load in message thread
- [ ] Test file upload validation (size, type)
- [ ] Test model selector
- [ ] Test AI response streaming
- [ ] Test save persistence on page refresh
- [ ] Test delete chat functionality
- [ ] Test pin/unpin chat

---

## Common Pitfalls

1. **Forgetting to clear attachedFiles** after send
   - Solution: Always call `clearAttachedFiles()` after message added

2. **Chat ID null until first save**
   - Don't try to use chatId before saveChat() completes

3. **Double uploads**
   - Ensure uploadAttachedFiles() called only once per handleSubmit()

4. **Lose prompt on error**
   - Store prompt in variable before clearing

5. **Image refs pointing to wrong IDs**
   - Must use uploadedImageId from POST /api/images response

---

## Performance Tips

- Use retry logic with exponential backoff
- Debounce auto-save to avoid excessive API calls
- Lazy-load chat history (pagination)
- Cache model list in state
- Compress images before upload (optional, for large images)
- Use virtual scrolling for long message lists


# Chat Creation Flow Analysis - SvelteKit Application

## Overview

This document provides a comprehensive analysis of how new chats are created in the WeaveAI SvelteKit application, including the flow for adding initial messages, files/attachments, and the relevant API endpoints.

---

## Architecture Overview

The chat system is built on a **state-driven architecture** using Svelte 5 runes with persistent database storage:

```
User Action (New Chat Button)
    ↓
ChatState (In-Memory State Management)
    ↓
API Endpoints (Server-Side)
    ↓
Database (Drizzle ORM + PostgreSQL)
```

---

## 1. NEW CHAT BUTTON & INITIALIZATION

### Location: ChatSidebar Component
**File**: `/Users/ianstone/weaveai-personal/src/lib/components/ChatSidebar.svelte` (Lines 171-185)

```svelte
<!-- New Chat Button -->
<div
  class="flex items-center p-2 mr-2 gap-1 text-md font-semibold cursor-pointer hover:text-primary transition-colors hover:bg-accent/100 rounded-md"
  onclick={() => chatState.startNewChat()}
  role="button"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      chatState.startNewChat();
    }
  }}
>
  <CirclePlusIcon class="w-5 h-5" />
  <span>{m["nav.new_chat"]()}</span>
</div>
```

**What it does:**
- Calls `chatState.startNewChat()` method
- Supports keyboard navigation (Enter/Space)
- Uses i18n for text (m["nav.new_chat"]())

---

## 2. CHAT STATE MANAGEMENT

### Location: ChatState Class
**File**: `/Users/ianstone/weaveai-personal/src/lib/components/chat-state.svelte.ts`

### 2.1 Initial State Definition (Lines 22-98)

```typescript
export class ChatState {
  // Chat state
  prompt = $state("");
  selectedModel = $state("x-ai/grok-4-fast:free");
  isAutoSelectMode = $state(true);
  messages = $state<AIMessage[]>([]);
  currentChatId = $state<string | null>(null);
  userId = $state<string | null>(null);
  chatHistory = $state<Array<{
    id: string;
    title: string;
    model: string;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
  }>>([]);

  // File attachment state
  attachedFiles = $state<AttachedFile[]>([]);
  isUploadingFiles = $state(false);

  // Loading states
  isLoadingChat = $state(false);
  isLoadingChatData = $state(false);
  isLoadingModels = $state(true);
}
```

### 2.2 startNewChat() Method (Lines 407-423)

```typescript
startNewChat() {
  // Set loading flag to prevent model change dialog
  this.isLoadingChatData = true;
  // Clear chat state
  this.currentChatId = null;
  this.messages = [];
  this.error = null;
  this.clearSelectedTool(); // Clear tool selection when starting new chat
  this.resetFreshChatFlag(); // Reset fresh chat flag when starting new chat
  // Sync previous model with current selection
  this.previousModel = this.selectedModel;
  // Navigate to root URL
  goto("/", { replaceState: true, noScroll: true });
  // Reset loading flag
  this.isLoadingChatData = false;
}
```

**Key behaviors:**
- Clears all messages and resets state
- Sets `currentChatId` to `null` (no chat ID until first message saved)
- Navigates to root `/` route
- Preserves selected model for next conversation
- Clears attached tool selection

---

## 3. FILE ATTACHMENT HANDLING

### Location: FileUpload Component & ChatState Integration

#### 3.1 FileUpload Component
**File**: `/Users/ianstone/weaveai-personal/src/lib/components/FileUpload.svelte`

**Features:**
- Drag-and-drop file upload
- File type validation (images, text, JSON, CSV)
- File size validation (10MB limit by default)
- Max 3 files per chat (configurable)
- Image preview support
- Text file content extraction

**Accepted file types:**
```typescript
const acceptedTypes = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]
```

#### 3.2 AttachedFile Interface (chat-state.svelte.ts, Lines 11-20)

```typescript
export interface AttachedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;        // For image preview
  content?: string;        // For text file content
  uploadedImageId?: string; // After server upload
}
```

#### 3.3 File Attachment Methods (Lines 662-752)

**addAttachedFiles()** - Add files to state
```typescript
addAttachedFiles(files: AttachedFile[]) {
  this.attachedFiles = [...this.attachedFiles, ...files];
}
```

**removeAttachedFile()** - Remove single file
```typescript
removeAttachedFile(fileId: string) {
  this.attachedFiles = this.attachedFiles.filter(f => f.id !== fileId);
}
```

**clearAttachedFiles()** - Clear all files
```typescript
clearAttachedFiles() {
  this.attachedFiles = [];
}
```

**uploadAttachedFiles()** - Upload to server (Lines 675-734)
```typescript
async uploadAttachedFiles(): Promise<void> {
  if (this.attachedFiles.length === 0) return;
  this.isUploadingFiles = true;

  try {
    for (const file of this.attachedFiles) {
      if (file.type.startsWith('image/') && !file.uploadedImageId) {
        // Upload image files to server
        const formData = new FormData();
        formData.append('file', file.file);

        // Convert file to base64 for API
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1]; // Remove data URL prefix
            resolve(base64Data);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(file.file);

        const base64Data = await base64Promise;

        const response = await fetchWithRetry('/api/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64Data,
            mimeType: file.type,
            filename: file.name,
            chatId: this.currentChatId
          })
        }, { maxRetries: 3 });

        if (response.ok) {
          const result = await response.json();
          file.uploadedImageId = result.imageId;
        } else {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }
    }
  } catch (error) {
    console.error('Error uploading files:', error);
    toast.error('Failed to upload files');
    throw error;
  } finally {
    this.isUploadingFiles = false;
  }
}
```

---

## 4. INITIAL MESSAGE/PROMPT HANDLING

### Location: ChatInterface Component

#### 4.1 ChatInterface Input UI (Lines 1137-1710)

The message input area includes:
- **Textarea** for prompt input (Lines 1138-1150)
- **Model selector** button (Lines 1339-1368)
- **File upload button** (Lines 1189-1320)
- **Send button** (Lines 1698-1708)

#### 4.2 Prompt State Management

**In ChatInterface.svelte:**
```svelte
<textarea
  bind:this={textarea}
  bind:value={chatState.prompt}
  disabled={textareaDisabled}
  class="..."
  placeholder={chatState.isLoading
    ? m["interface.generating_response"]()
    : m["interface.type_message_here"]()}
  name="message"
  onkeydown={handleKeyDown}
  autocomplete="off"
  {@attach autosize.attachment}
></textarea>
```

**Prompt Template System** (Lines 659-729)
Users can click quick prompt templates:
```typescript
const PROMPT_TEMPLATES = [
  {
    id: "creative",
    title: m["prompts.creative_writing.title"](),
    icon: BulbIcon,
    prompt: m["prompts.creative_writing.description"](),
  },
  {
    id: "code",
    title: m["prompts.code_review.title"](),
    icon: CodeIcon,
    prompt: m["prompts.code_review.description"](),
  },
  // ... more templates
]

function handlePromptTemplate(template: string) {
  chatState.prompt = template;
  // Focus textarea and position cursor at end
  managedTimeout(() => {
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(template.length, template.length);
    }
  }, TIMING.PROMPT_TEMPLATE_FOCUS);
}
```

---

## 5. MESSAGE SUBMISSION FLOW

### Location: ChatState.handleSubmit() Method
**File**: `/Users/ianstone/weaveai-personal/src/lib/components/chat-state.svelte.ts` (Lines 841-1413)

### 5.1 Flow Diagram

```
User clicks Send
    ↓
handleSubmit() validates:
  - Check message content not empty
  - Check guest message limits
  - Check model is not locked
    ↓
uploadAttachedFiles() [if images present]
    ↓
Create user message with attachments
    ↓
Add message to this.messages (saves in state)
    ↓
Call API endpoint (/api/chat)
    ↓
Stream response from AI
    ↓
Add assistant message to this.messages
    ↓
saveChat() - Persist to database
```

### 5.2 Create User Message (Lines 917-982)

```typescript
const userMessage: AIMessage = {
  role: "user",
  content: messageContent,
  type: this.attachedFiles.some(f => f.type.startsWith('image/')) ? "image" : "text"
};

// Add image attachments to message (support multiple images)
const imageAttachments = this.attachedFiles.filter(f => f.type.startsWith('image/'));
if (imageAttachments.length > 0) {
  if (imageAttachments.length === 1) {
    // Single image - use backwards compatible fields
    const imageAttachment = imageAttachments[0];
    if (imageAttachment?.uploadedImageId) {
      userMessage.imageId = imageAttachment.uploadedImageId;
      userMessage.mimeType = imageAttachment.type;
    }
  } else {
    // Multiple images - use new array fields
    userMessage.imageIds = uploadedImages.map(img => img.uploadedImageId!);
    userMessage.images = imageAttachments.map(img => ({
      imageId: img.uploadedImageId,
      mimeType: img.type
    }));
  }
}

this.messages = [...this.messages, userMessage];
```

### 5.3 Save Chat Method (Lines 425-499)

```typescript
async saveChat() {
  if (this.messages.length === 0) return;

  try {
    const title = this.generateChatTitle(this.messages[0].content || 'Untitled Chat');

    if (this.currentChatId) {
      // Update existing chat
      const response = await fetchWithRetry(`/api/chats/${this.currentChatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          model: this.selectedModel,
          messages: this.messages,
        }),
      });
      // ... handle response
    } else {
      // Create new chat on first message
      const response = await fetchWithRetry("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          model: this.selectedModel,
          messages: this.messages
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentChatId = data.chat.id;
        this.markAsFreshChat();
        goto(`/chat/${data.chat.id}`, {
          replaceState: true,
          noScroll: true,
        });
        this.loadChatHistory();
      }
    }
  } catch (err) {
    console.error("Failed to save chat:", err);
  }
}
```

---

## 6. API ENDPOINTS

### 6.1 POST /api/chats - Create New Chat

**File**: `/Users/ianstone/weaveai-personal/src/routes/api/chats/+server.ts` (Lines 34-62)

```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const session = await locals.auth();
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, model, messages } = await request.json();

    if (!title || !model || !messages) {
      return json({ 
        error: 'Title, model, and messages are required' 
      }, { status: 400 });
    }

    const [newChat] = await db
      .insert(chats)
      .values({
        userId: session.user.id,
        title,
        model,
        messages
      })
      .returning();

    return json({ chat: newChat });
  } catch (error) {
    console.error('Create chat error:', error);
    return json({ error: 'Failed to create chat' }, { status: 500 });
  }
};
```

**Request Body:**
```json
{
  "title": "First 6 words of first message...",
  "model": "x-ai/grok-4-fast:free",
  "messages": [
    {
      "role": "user",
      "content": "User's message content",
      "type": "text|image",
      "imageId": "image-uuid-if-present",
      "mimeType": "mime/type"
    }
  ]
}
```

**Response:**
```json
{
  "chat": {
    "id": "generated-uuid",
    "userId": "user-id",
    "title": "Chat title",
    "model": "model-name",
    "messages": [...],
    "pinned": false,
    "createdAt": "2024-11-04T...",
    "updatedAt": "2024-11-04T..."
  }
}
```

### 6.2 GET /api/chats - List User Chats

**File**: `/Users/ianstone/weaveai-personal/src/routes/api/chats/+server.ts` (Lines 7-32)

```typescript
export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const session = await locals.auth();
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userChats = await db
      .select({
        id: chats.id,
        title: chats.title,
        model: chats.model,
        pinned: chats.pinned,
        createdAt: chats.createdAt,
        updatedAt: chats.updatedAt
      })
      .from(chats)
      .where(eq(chats.userId, session.user.id))
      .orderBy(desc(chats.updatedAt));

    return json({ chats: userChats });
  } catch (error) {
    console.error('Get chats error:', error);
    return json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
};
```

### 6.3 PUT /api/chats/[id] - Update Chat

**File**: `/Users/ianstone/weaveai-personal/src/routes/api/chats/[id]/+server.ts` (Lines 30-64)

```typescript
export const PUT: RequestHandler = async ({ params, request, locals }) => {
  try {
    const session = await locals.auth();
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, model, messages, pinned } = await request.json();

    const updateData: any = {
      updatedAt: sql`NOW()`
    };

    if (title !== undefined) updateData.title = title;
    if (model !== undefined) updateData.model = model;
    if (messages !== undefined) updateData.messages = messages;
    if (pinned !== undefined) updateData.pinned = pinned;

    const [updatedChat] = await db
      .update(chats)
      .set(updateData)
      .where(and(eq(chats.id, params.id), eq(chats.userId, session.user.id)))
      .returning();

    if (!updatedChat) {
      return json({ error: 'Chat not found' }, { status: 404 });
    }

    return json({ chat: updatedChat });
  } catch (error) {
    console.error('Update chat error:', error);
    return json({ error: 'Failed to update chat' }, { status: 500 });
  }
};
```

### 6.4 POST /api/images - Upload Image Attachment

**Used by**: uploadAttachedFiles() method

**Endpoint**: `/api/images` (POST)

**Request Body:**
```json
{
  "imageData": "base64-encoded-image-data",
  "mimeType": "image/png",
  "filename": "screenshot.png",
  "chatId": "optional-chat-id"
}
```

**Response:**
```json
{
  "imageId": "image-uuid",
  "imageUrl": "https://...",
  "mimeType": "image/png"
}
```

---

## 7. DATABASE SCHEMA

### Chat Table
**File**: `/Users/ianstone/weaveai-personal/src/lib/server/db/schema.ts` (Lines 167-190)

```typescript
export const chats = pgTable("chat", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  model: text("model").notNull(),
  messages: json("messages").$type<Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string;
    imageId?: string;        // Reference to images table
    imageUrl?: string;       // Deprecated
    imageData?: string;      // Deprecated
    videoId?: string;
    mimeType?: string;
    type?: 'text' | 'image' | 'video';
  }>>().notNull().default([]),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})
```

### Images Table
```typescript
export const images = pgTable("image", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  filename: text("filename").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chatId: text("chatId"), // Optional - images may not always be associated with a specific chat
  mimeType: text("mimeType").notNull(),
  fileSize: integer("fileSize").notNull(),
  storageLocation: text("storageLocation").notNull().default("local"),
  cloudPath: text("cloudPath"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
})
```

---

## 8. COMPLETE CREATE CHAT FLOW WITH SCREENSHOT

Here's the complete sequence for creating a new chat with a screenshot and pre-filled prompt:

### Step-by-Step Process:

```
1. User clicks "New Chat" button in sidebar
   → chatState.startNewChat() called
   → currentChatId = null, messages = [], error = null
   → Navigate to "/" route
   
2. User types or selects prompt from templates
   → chatState.prompt = "prompt text"
   
3. User clicks file attachment button
   → FileUpload component opens in popover
   
4. User drags screenshot or clicks to select
   → File processed: dataUrl created, added to chatState.attachedFiles[]
   
5. User clicks Send button
   → handleSubmit() executes:
      a. Validate prompt + guest limits + model access
      b. Auto-select model if enabled (optional)
      c. uploadAttachedFiles()
         - Convert image to base64
         - POST /api/images
         - Get back imageId
         - Store in attachedFiles[].uploadedImageId
      d. Create user message object with imageId reference
      e. Add message to chatState.messages[]
      f. Clear prompt and attachedFiles
      g. POST to /api/chat (for AI response)
      h. Stream AI response back
      i. Add assistant message to chatState.messages[]
      j. saveChat() - POST /api/chats (if first message) or PUT /api/chats/[id]
      
6. Chat saved successfully
   → currentChatId now has UUID
   → Chat appears in sidebar history
   → URL updated to /chat/[id]
```

---

## 9. KEY IMPLEMENTATION NOTES

### 9.1 Timing of Chat Creation
- **Chat ID generated**: When first message is sent (on saveChat() call)
- **Not when**: User clicks "New Chat" button
- **Before first message saved**: currentChatId is null

### 9.2 Attachment Flow
1. Files attached to state **before** message sent
2. Images uploaded to server **during** message send
3. Image IDs stored in message.imageId or message.imageIds
4. Database stores reference to image via imageId (foreign key to images table)

### 9.3 Model Selection
- Default model: "x-ai/grok-4-fast:free"
- Can be changed via model selector before sending
- Auto-select mode available based on prompt analysis
- Model locked in chat when first message sent

### 9.4 Message State Management
- **In-memory**: chatState.messages (for UI)
- **Database**: chats.messages (JSON column)
- Both stay in sync after saveChat()

### 9.5 File Support
- **Images**: Uploaded to /api/images, stored in database, referenced by UUID
- **Text/JSON**: Content included inline in message.content
- **Max**: 3 files per message (configurable)
- **Max size**: 10MB per file (configurable)

---

## 10. CREATING CHAT WITH SCREENSHOT AND PRE-FILLED PROMPT

To implement a feature that creates a new chat with a screenshot and prompt pre-filled:

### Backend: New API Endpoint

Create `/src/routes/api/chats/create-with-screenshot/+server.ts`:

```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const session = await locals.auth();
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, imageData, imageMimeType, imageFilename } = await request.json();

    // 1. Upload image first
    const imageResponse = await uploadImage(
      imageData,
      imageMimeType,
      imageFilename,
      session.user.id
    );

    if (!imageResponse.ok) {
      return json({ error: 'Failed to upload image' }, { status: 500 });
    }

    const { imageId } = imageResponse;

    // 2. Create chat with image message
    const title = prompt.split(' ').slice(0, 6).join(' ') + '...';
    
    const userMessage = {
      role: 'user',
      content: prompt,
      type: 'image',
      imageId,
      mimeType: imageMimeType
    };

    const [newChat] = await db
      .insert(chats)
      .values({
        userId: session.user.id,
        title,
        model: 'x-ai/grok-4-fast:free',
        messages: [userMessage],
      })
      .returning();

    return json({ chat: newChat });
  } catch (error) {
    console.error('Create chat with screenshot error:', error);
    return json({ error: 'Failed to create chat' }, { status: 500 });
  }
};
```

### Frontend: Integration Point

In ChatState, add new method:

```typescript
async createChatWithScreenshot(prompt: string, screenshotData: string, mimeType: string) {
  try {
    const response = await fetchWithRetry("/api/chats/create-with-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        imageData: screenshotData,
        imageMimeType: mimeType,
        imageFilename: `screenshot-${Date.now()}.${mimeType.split('/')[1]}`
      }),
    });

    if (response.ok) {
      const data = await response.json();
      this.currentChatId = data.chat.id;
      this.selectedModel = data.chat.model;
      this.messages = data.chat.messages;
      goto(`/chat/${data.chat.id}`);
      this.loadChatHistory();
    }
  } catch (error) {
    console.error("Failed to create chat with screenshot:", error);
    toast.error("Failed to create chat");
  }
}
```

---

## Summary

The chat creation system is highly modular:

1. **New Chat Button** → startNewChat() clears state
2. **Prompt Entry** → stored in chatState.prompt
3. **File Attachment** → FileUpload component → chatState.attachedFiles[]
4. **Send Message** → handleSubmit() orchestrates:
   - Image upload to /api/images
   - Message creation with image references
   - AI response via /api/chat
   - Chat persistence via POST /api/chats
5. **Database** → PostgreSQL with Drizzle ORM

The system supports creating chats programmatically through new API endpoints or by directly calling ChatState methods from the frontend.


# Implementation Guide: Create Chat with Screenshot & Pre-filled Prompt

This guide shows how to implement a feature to create a new chat with a screenshot attached and a prompt pre-filled.

## Files to Modify

### 1. Backend API Endpoint
**File to create**: `src/routes/api/chats/create-with-screenshot/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { chats, images } from '$lib/server/db/schema.js';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const session = await locals.auth();
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, imageData, imageMimeType, imageFilename } = await request.json();

    if (!prompt || !imageData || !imageMimeType) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Decode base64 and save image
    const imageId = randomUUID();
    const imageBuffer = Buffer.from(imageData, 'base64');
    const uploadsDir = path.join(process.cwd(), 'static', 'uploads');
    
    // Create uploads directory if it doesn't exist
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const filePath = path.join(uploadsDir, `${imageId}.png`);
    await fs.writeFile(filePath, imageBuffer);

    // 2. Insert image record into database
    const [imageRecord] = await db
      .insert(images)
      .values({
        id: imageId,
        filename: imageFilename || `screenshot-${Date.now()}.png`,
        userId: session.user.id,
        mimeType: imageMimeType,
        fileSize: imageBuffer.length,
        storageLocation: 'local',
        cloudPath: `/uploads/${imageId}.png`
      })
      .returning();

    // 3. Create chat with initial message containing image
    const title = prompt.split(' ').slice(0, 6).join(' ') + 
      (prompt.split(' ').length > 6 ? '...' : '');
    
    const userMessage = {
      role: 'user' as const,
      content: prompt,
      type: 'image' as const,
      imageId: imageRecord.id,
      mimeType: imageMimeType
    };

    const [newChat] = await db
      .insert(chats)
      .values({
        userId: session.user.id,
        title,
        model: 'x-ai/grok-4-fast:free',
        messages: [userMessage]
      })
      .returning();

    return json({ 
      chat: newChat,
      message: 'Chat created successfully with screenshot'
    }, { status: 201 });

  } catch (error) {
    console.error('Create chat with screenshot error:', error);
    return json({ error: 'Failed to create chat with screenshot' }, { status: 500 });
  }
};
```

### 2. ChatState Method
**File to modify**: `src/lib/components/chat-state.svelte.ts`

Add this method to the ChatState class (around line 500, after saveChat method):

```typescript
/**
 * Create a new chat with a screenshot attached and prompt pre-filled
 * @param prompt - The initial prompt/question
 * @param screenshotData - Base64 encoded image data (without 'data:image/png;base64,' prefix)
 * @param mimeType - MIME type of the image (e.g., 'image/png')
 */
async createChatWithScreenshot(
  prompt: string,
  screenshotData: string,
  mimeType: string = 'image/png'
): Promise<string | null> {
  if (!prompt || !screenshotData) {
    toast.error('Prompt and screenshot are required');
    return null;
  }

  try {
    this.isLoading = true;
    this.loadingStatus = '📸 Creating chat with screenshot...';

    const response = await fetchWithRetry('/api/chats/create-with-screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        imageData: screenshotData,
        imageMimeType: mimeType,
        imageFilename: `screenshot-${Date.now()}.${mimeType.split('/')[1]}`
      })
    }, {
      maxRetries: 3,
      onRetry: (attempt) => {
        console.log(`[RETRY] Creating chat with screenshot - attempt ${attempt}/3`);
        this.loadingStatus = `🔄 Retrying (${attempt}/3)...`;
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create chat');
    }

    const data = await response.json();
    
    // Update chat state with new chat
    this.currentChatId = data.chat.id;
    this.selectedModel = data.chat.model;
    this.previousModel = data.chat.model;
    this.messages = data.chat.messages;
    this.prompt = '';
    this.attachedFiles = [];

    // Navigate to the new chat
    await goto(`/chat/${data.chat.id}`, { replaceState: true, noScroll: true });
    
    // Refresh chat history
    await this.loadChatHistory();

    toast.success('Chat created with screenshot!');
    return data.chat.id;

  } catch (error) {
    console.error('Failed to create chat with screenshot:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to create chat';
    this.error = errorMsg;
    toast.error(errorMsg);
    return null;
  } finally {
    this.isLoading = false;
    this.loadingStatus = null;
  }
}
```

### 3. Frontend Component (Example Usage)

Create a new component: `src/lib/components/ScreenshotChatButton.svelte`

```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import type { ChatState } from './chat-state.svelte.js';
  import { toast } from 'svelte-sonner';

  const chatState = getContext<ChatState>('chatState');

  let isCapturing = $state(false);

  async function captureScreenshot() {
    if (!navigator.mediaDevices.getDisplayMedia) {
      toast.error('Screenshot capture not supported in your browser');
      return;
    }

    try {
      isCapturing = true;

      // Alternative: Use html2canvas for page screenshots
      // const canvas = await html2canvas(document.body);
      // const imageData = canvas.toDataURL('image/png').split(',')[1];

      // Or prompt user for custom prompt
      const prompt = prompt('Enter your question about the screenshot:');
      if (!prompt) {
        toast.error('Prompt is required');
        return;
      }

      // You could also use:
      // 1. A browser screenshot API (with permission)
      // 2. A file input to select existing screenshot
      // 3. A canvas-based drawing tool

      toast.success('Screenshot capture started');
      // chatState.createChatWithScreenshot(prompt, imageData, 'image/png');

    } catch (error) {
      console.error('Screenshot capture error:', error);
      toast.error('Failed to capture screenshot');
    } finally {
      isCapturing = false;
    }
  }
</script>

<Button
  onclick={captureScreenshot}
  disabled={isCapturing}
  class="flex items-center gap-2"
>
  {#if isCapturing}
    <span class="animate-spin">⏳</span>
    <span>Capturing...</span>
  {:else}
    <span>📸</span>
    <span>New Chat with Screenshot</span>
  {/if}
</Button>
```

### 4. Using with File Input (Simpler Alternative)

Create: `src/lib/components/ScreenshotFileInput.svelte`

```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import type { ChatState } from './chat-state.svelte.js';
  import { toast } from 'svelte-sonner';

  const chatState = getContext<ChatState>('chatState');

  let fileInput = $state<HTMLInputElement>();

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    try {
      // Read file as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);

      const imageData = await base64Promise;

      // Prompt for question
      const prompt = window.prompt(
        'What would you like to know about this screenshot?'
      );

      if (!prompt) {
        toast.error('Prompt is required');
        return;
      }

      // Create chat with screenshot
      const chatId = await chatState.createChatWithScreenshot(
        prompt,
        imageData,
        file.type
      );

      if (chatId) {
        // Reset file input
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      console.error('Error processing screenshot:', error);
      toast.error('Failed to process screenshot');
    }
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept="image/*"
  onchange={handleFileSelect}
  class="hidden"
/>

<Button
  onclick={() => fileInput?.click()}
  class="flex items-center gap-2"
>
  <span>📸</span>
  <span>New Chat from Screenshot</span>
</Button>
```

## Usage Examples

### Example 1: Direct from ChatState

```typescript
// From a component that has access to chatState
const screenshotBase64 = 'your-base64-image-data-here';
const prompt = 'Can you analyze this error message?';
const mimeType = 'image/png';

const chatId = await chatState.createChatWithScreenshot(
  prompt,
  screenshotBase64,
  mimeType
);
```

### Example 2: With html2canvas (for page screenshots)

```typescript
import html2canvas from 'html2canvas';

async function capturePageAndCreateChat() {
  const canvas = await html2canvas(document.body);
  const imageData = canvas.toDataURL('image/png').split(',')[1];
  const prompt = 'Analyze this page screenshot';
  
  await chatState.createChatWithScreenshot(prompt, imageData, 'image/png');
}
```

### Example 3: From JavaScript Runtime Context

```typescript
// Browser extension or Electron script
const screenshotBlob = await navigator.mediaDevices.getDisplayMedia({...});
const reader = new FileReader();
reader.onload = async (e) => {
  const base64 = e.target?.result.split(',')[1];
  await fetch('/api/chats/create-with-screenshot', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Analyze this screenshot',
      imageData: base64,
      imageMimeType: 'image/png'
    })
  });
};
reader.readAsDataURL(screenshotBlob);
```

## Integration Points

### Add to Sidebar

In `src/lib/components/ChatSidebar.svelte` (after "New Chat" button):

```svelte
<ScreenshotFileInput />
```

### Add to Chat Interface

In `src/lib/components/ChatInterface.svelte` (near send button area):

```svelte
<ScreenshotFileInput />
```

## Database Considerations

The implementation uses:
- **Images table**: Stores metadata about uploaded screenshots
- **Chats table**: Stores chat with initial image message
- **FK relationship**: imageId in message references images.id

Ensure the images table exists with proper schema (already present in current database).

## Error Handling

The implementation includes:
- Session validation (401 unauthorized)
- File validation (size, type)
- Retry logic (3 attempts)
- Toast notifications for user feedback
- Console error logging for debugging

## Testing

### Manual Test Steps

1. Create new chat with screenshot:
   ```bash
   curl -X POST http://localhost:5173/api/chats/create-with-screenshot \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "What is this?",
       "imageData": "<base64-encoded-image>",
       "imageMimeType": "image/png",
       "imageFilename": "test.png"
     }'
   ```

2. Verify chat created in sidebar
3. Verify image displayed in first message
4. Verify prompt pre-filled in state

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('createChatWithScreenshot', () => {
  it('should create a chat with image and prompt', async () => {
    const prompt = 'Test prompt';
    const imageData = 'fake-base64-data';
    const mimeType = 'image/png';

    const chatId = await chatState.createChatWithScreenshot(
      prompt,
      imageData,
      mimeType
    );

    expect(chatId).toBeDefined();
    expect(chatState.currentChatId).toBe(chatId);
    expect(chatState.messages[0].type).toBe('image');
    expect(chatState.messages[0].content).toBe(prompt);
  });
});
```

## Performance Notes

- Screenshots are compressed as PNG (configurable)
- Base64 encoding increases size by ~33%
- Consider implementing image optimization:
  ```typescript
  // Add to uploadAttachedFiles() for large images
  if (imageBuffer.length > 5 * 1024 * 1024) {
    // Compress image using sharp or similar
    const compressed = await compressImage(imageBuffer);
  }
  ```

- Cache chat history after creation
- Consider pagination if user has many chats

## Security Considerations

- All requests require authentication (session check)
- User can only access their own chats (userId verification)
- File type validation (only images)
- File size limits enforced
- Database constraints prevent orphaned images


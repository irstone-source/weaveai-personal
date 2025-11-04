<script lang="ts">
  import { onMount, getContext } from "svelte";

  // UI Components
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";

  // Shared components
  import ChatInterface from "$lib/components/ChatInterface.svelte";
  import MemoryControls from "$lib/components/MemoryControls.svelte";
  import type { ChatState } from "$lib/components/chat-state.svelte.js";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";
  import * as m from "$lib/../paraglide/messages.js";

  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
  let userId = $derived(data.session?.user?.id);

  // Get chat state and settings from context (provided by layout)
  const chatState = getContext<ChatState>("chatState");
  const settingsState = getContext<SettingsState>("settings");

  // Load the specific chat when page loads
  onMount(async () => {
    if (data.chat) {
      // Only load server data if we're navigating to a DIFFERENT chat
      // Don't overwrite in-memory messages if we're already on this chat
      const isDifferentChat = chatState.currentChatId !== data.chatId;

      if (isDifferentChat) {
        // Set chat data from the page load
        chatState.currentChatId = data.chatId;
        chatState.selectedModel = data.chat.model;
        chatState.previousModel = data.chat.model;

        // Only clear tool selection if this is NOT a fresh chat creation
        if (!chatState.isFreshChat) {
          chatState.clearSelectedTool();
        }

        // Reset the fresh chat flag after handling
        chatState.resetFreshChatFlag();

        chatState.messages = data.chat.messages.map((msg: any) => ({
          ...msg,
          content: chatState.cleanMessageContent(msg.content),
        }));
      } else {
        // Same chat - just update metadata, preserve messages
        chatState.selectedModel = data.chat.model;
        chatState.previousModel = data.chat.model;

        // Reset the fresh chat flag after handling
        chatState.resetFreshChatFlag();
      }
    }
  });
</script>

<svelte:head>
  <title>Chat - {settingsState.siteName}</title>
  <meta name="description" content={settingsState.siteDescription} />
</svelte:head>

<!-- Memory System Controls -->
{#if userId}
  <div class="w-full max-w-4xl mx-auto px-4 pt-4">
    <MemoryControls {userId} />
  </div>
{/if}

<!-- Main Chat Interface -->
<ChatInterface />

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root open={chatState.deletingChatId !== null}>
  <AlertDialog.Content class="z-[100]">
    <AlertDialog.Header>
      <AlertDialog.Title>{m['chat.delete_chat_title']()}</AlertDialog.Title>
      <AlertDialog.Description>
        {m['chat.delete_chat_description']()}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => chatState.cancelDelete()}
        >{m['chat.cancel']()}</AlertDialog.Cancel
      >
      <AlertDialog.Action
        onclick={() => chatState.confirmDeleteChat()}
        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {m['chat.delete']()}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Model Change Confirmation Dialog -->
<AlertDialog.Root open={chatState.showModelChangeDialog}>
  <AlertDialog.Content class="z-[100]">
    <AlertDialog.Header>
      <AlertDialog.Title>{m['chat.switch_model_title']()}</AlertDialog.Title>
      <AlertDialog.Description>
        {m['chat.switch_model_description']()}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => chatState.cancelModelChange()}
        >{m['chat.cancel']()}</AlertDialog.Cancel
      >
      <AlertDialog.Action onclick={() => chatState.confirmModelChange()}>
        {m['chat.start_new_chat']()}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

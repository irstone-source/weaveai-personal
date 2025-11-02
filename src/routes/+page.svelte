<script lang="ts">
  import { onMount, getContext } from "svelte";

  // UI Components
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";

  // Shared components
  import ChatInterface from "$lib/components/ChatInterface.svelte";
  import type { ChatState } from "$lib/components/chat-state.svelte.js";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";
  import * as m from "$lib/../paraglide/messages.js";

  // Get chat state and settings from context (provided by layout)
  const chatState = getContext<ChatState>("chatState");
  const settingsState = getContext<SettingsState>("settings");

  onMount(() => {
    // Clear any existing chat when visiting index route for new conversations
    chatState.currentChatId = null;
    chatState.messages = [];
    chatState.error = null;
    chatState.clearSelectedTool(); // Clear tool selection when visiting index
    chatState.resetFreshChatFlag(); // Reset fresh chat flag when visiting index
    // Keep selected model for continuity
  });
</script>

<svelte:head>
  <title>{settingsState.siteName}</title>
  <meta name="description" content={settingsState.siteDescription} />
</svelte:head>

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

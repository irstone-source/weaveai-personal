<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import ThemeToggle from "$lib/components/theme-toggle.svelte";

  const errorStatus = $derived(page.status);
  const errorMessage = $derived(
    page.error?.message || "An unexpected error occurred"
  );
</script>

<svelte:head>
  <title>Error - AI Chat Interface</title>
</svelte:head>

<!-- Main content area that works with sidebar layout -->
<main class="flex flex-col h-screen w-full">
  <!-- Header with Sidebar Trigger and Theme Toggle -->
  <header class="border-b p-4 flex items-center justify-between">
    <Sidebar.Trigger class="cursor-pointer" />
    <ThemeToggle />
  </header>

  <div class="flex-1 flex items-center justify-center p-4">
    <Card.Root class="w-full max-w-md">
      <Card.Header class="text-center">
        <Card.Title class="text-2xl font-bold text-destructive">
          {#if errorStatus === 404}
            Chat Not Found
          {:else if errorStatus === 401}
            Unauthorized
          {:else}
            Error {errorStatus}
          {/if}
        </Card.Title>
        <Card.Description class="text-muted-foreground">
          {#if errorStatus === 404}
            The chat you're looking for doesn't exist or has been deleted.
          {:else if errorStatus === 401}
            You don't have permission to access this chat.
          {:else}
            {errorMessage}
          {/if}
        </Card.Description>
      </Card.Header>
      <Card.Content class="text-center space-y-4">
        <div class="text-sm text-muted-foreground">
          {#if errorStatus === 404}
            The chat may have been deleted or the link may be incorrect.
          {:else if errorStatus === 401}
            Please make sure you're signed in and have access to this chat.
          {:else}
            Please try again or contact support if the problem persists.
          {/if}
        </div>
        <div class="flex gap-2 justify-center">
          <Button variant="outline" onclick={() => goto("/")}>New Chat</Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</main>

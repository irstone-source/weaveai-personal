<script lang="ts">
  import "../app.css";
  import { browser } from "$app/environment";
  import { invalidateAll } from "$app/navigation";
  import { setContext } from "svelte";
  import { page } from "$app/state";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/components/ui/sonner";

  // UI Components
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  // Shared components
  import ChatSidebar from "$lib/components/ChatSidebar.svelte";
  import Header from "$lib/components/Header.svelte";
  import Favicon from "$lib/components/Favicon.svelte";
  import { ChatState } from "$lib/components/chat-state.svelte.js";
  import { SettingsState } from "$lib/stores/settings.svelte.js";

  let { children, data } = $props();

  // Extract settings from data and create settings state
  const settingsState = new SettingsState(data.settings);
  
  // Update settings when data changes
  $effect(() => {
    if (data.settings) {
      settingsState.setSettings(data.settings);
    }
  });

  // Check if current route is an auth route (login/register/reset-password/verify-email), standalone page (pricing, landing), or admin route
  const isStandalonePage = $derived(
    page.url.pathname === "/login" || page.url.pathname === "/register" || page.url.pathname === "/pricing" || page.url.pathname === "/landing" || page.url.pathname === "/terms" || page.url.pathname === "/privacy" || page.url.pathname.startsWith("/admin") || page.url.pathname === "/reset-password" || page.url.pathname.startsWith("/reset-password/") || page.url.pathname === "/verify-email" || page.url.pathname.startsWith("/verify-email/")
  );

  // Create global chat state that persists across route changes
  const chatState = new ChatState();

  // Create reactive session state
  let currentSession = $state(data.session);

  // Update session when data changes (e.g., after login)
  $effect(() => {
    currentSession = data.session;
  });

  // Provide chat state, session, and settings to all child components via context
  setContext("chatState", chatState);
  setContext("session", () => currentSession);
  setContext("settings", settingsState);

  // Set up chat state to react to session changes
  chatState.setupSessionReactivity(() => currentSession);

  // Check if we just returned from an OAuth flow and refresh data
  $effect(() => {
    if (browser) {
      // Check for auth callback parameters in the URL
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("code") || urlParams.get("state")) {
        // Clear the URL params and refresh data
        window.history.replaceState({}, "", window.location.pathname);
        invalidateAll();
      }
    }
  });
</script>

<ModeWatcher defaultMode={(data.adminDefaults?.theme as "system" | "dark" | "light" | undefined) || "dark"} disableTransitions={false} />

<!-- Global Favicon Management -->
<Favicon />

{#if isStandalonePage}
  <!-- Standalone pages without sidebar (auth, pricing) -->
  {@render children()}
{:else}
  <!-- Main app with sidebar -->
  <Sidebar.Provider>
    <!-- Global Sidebar that persists across routes -->
    <ChatSidebar {chatState} />

    <!-- Main content area with header -->
    <div class="flex flex-col h-screen w-full">
      <!-- Global Header -->
      <Header {data} />
      
      <!-- Page content area -->
      <div class="flex-1 overflow-auto">
        {@render children()}
      </div>
    </div>
  </Sidebar.Provider>
{/if}

<Toaster position="top-center" />

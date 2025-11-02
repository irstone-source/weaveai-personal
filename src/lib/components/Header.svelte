<script lang="ts">
  import { goto } from "$app/navigation";
  import { getContext } from "svelte";

  // UI Components
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import ThemeToggle from "$lib/components/theme-toggle.svelte";

  // Icons
  import {
    SettingsIcon,
    UpgradeIcon,
    ExternalLinkIcon,
  } from "$lib/icons/index.js";

  import type { Session } from "@auth/sveltekit";
  import * as m from "$lib/../paraglide/messages.js";

  // Get props from parent
  let { data } = $props();

  // Get session from context (provided by layout)
  const getSession = getContext<() => Session | null>("session");
  const session = $derived(getSession?.());
</script>

<!-- Header with Sidebar Trigger, Auth Controls and Theme Toggle -->
<header class="border-b p-4 flex items-center justify-between">
  <div class="flex items-center gap-4">
    <Sidebar.Trigger class="cursor-pointer" />

    <!-- Admin notification and dashboard button -->
    {#if session?.user?.isAdmin}
      <div class="flex items-center gap-3">
        <span class="text-sm text-muted-foreground"
          >You're logged in as Admin</span
        >
        <Button
          variant="outline"
          size="sm"
          onclick={() => window.open("/admin", "_blank", "noopener,noreferrer")}
          class="cursor-pointer mr-2"
        >
          <ExternalLinkIcon class="w-4 h-4" />
          Admin Dashboard
        </Button>
      </div>
    {/if}
  </div>

  <div class="flex items-center gap-2">
    {#if session?.user}
      {#if session.user.planTier === "free"}
        <Button
          variant="outline"
          size="sm"
          onclick={() => goto("/pricing")}
          class="mr-2.5 cursor-pointer"
        >
          <UpgradeIcon class="w-4 h-4" />
          {m["auth.upgrade_plan"]()}
        </Button>
      {/if}
      <SettingsIcon
        class="cursor-pointer w-4 h-4"
        onclick={() => goto("/settings")}
      />
    {:else}
      <Button
        variant="outline"
        size="sm"
        onclick={() => goto("/register")}
        class="cursor-pointer"
      >
        {m["auth.sign_up"]()}
      </Button>
    {/if}
    <ThemeToggle />
  </div>
</header>

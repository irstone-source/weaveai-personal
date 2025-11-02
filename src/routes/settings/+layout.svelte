<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as m from "$lib/../paraglide/messages.js";

  // Import icons
  import {
    UserIcon,
    SettingsIcon,
    CreditCardIcon,
    AnalyticsIcon,
    ShieldIcon,
  } from "$lib/icons/index.js";

  let { children } = $props();

  // Settings navigation items with icons
  const settingsNav = [
    {
      id: "profile",
      label: m["settings.nav_profile"](),
      path: "/settings/profile",
      icon: UserIcon,
    },
    {
      id: "account",
      label: m["settings.nav_account"](),
      path: "/settings/account",
      icon: SettingsIcon,
    },
    {
      id: "billing",
      label: m["settings.nav_billing"](),
      path: "/settings/billing",
      icon: CreditCardIcon,
    },
    {
      id: "usage",
      label: m["settings.nav_usage"](),
      path: "/settings/usage",
      icon: AnalyticsIcon,
    },
    {
      id: "privacy",
      label: m["settings.nav_privacy"](),
      path: "/settings/privacy",
      icon: ShieldIcon,
    },
  ];

  // Get current active nav item based on pathname
  const activeNavItem = $derived(() => {
    const currentPath = page.url.pathname;
    return (
      settingsNav.find((item) => currentPath.startsWith(item.path))?.id ||
      "profile"
    );
  });
</script>

<svelte:head>
  <title>{m["settings.page_title"]()}</title>
</svelte:head>

<div class="min-h-screen p-6">
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="cursor-default mb-8 space-y-2">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">{m["settings.title"]()}</h1>
      </div>
    </div>

    <div class="grid md:grid-cols-[240px_1fr]">
      <!-- Settings Sidebar -->
      <Card.Root class="h-fit py-0 mb-4 bg-transparent border-none shadow-none">
        <Card.Content class="p-0 mr-8">
          <nav class="space-y-2">
            {#each settingsNav as navItem}
              {@const Icon = navItem.icon}
              <button
                class="cursor-pointer w-full text-left px-3 py-1.5 text-md rounded-md transition-colors flex items-center gap-3 {activeNavItem() ===
                navItem.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'}"
                onclick={() => goto(navItem.path)}
              >
                <Icon class="w-4.5 h-4.5" />
                {navItem.label}
              </button>
            {/each}
          </nav>
        </Card.Content>
      </Card.Root>

      <!-- Main Content Area -->
      <div>
        {@render children()}
      </div>
    </div>
  </div>
</div>

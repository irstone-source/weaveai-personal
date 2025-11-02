<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import * as NavigationMenu from "$lib/components/ui/navigation-menu/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { MenuIcon } from "$lib/icons/index.js";
  import { IsMobile } from "$lib/hooks/is-mobile.svelte.js";

  let { children, data } = $props();

  // Mobile detection
  const isMobile = new IsMobile();
  let mobileNavOpen = $state(false);

  // Admin navigation items
  const adminNav = [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/admin",
    },
    {
      id: "analytics",
      label: "Analytics",
      path: "/admin/analytics",
    },
    {
      id: "users",
      label: "Users",
      path: "/admin/users",
    },
    {
      id: "payments",
      label: "Payments",
      path: "/admin/payments",
    },
    {
      id: "subscriptions",
      label: "Subscriptions",
      path: "/admin/subscriptions",
    },
    {
      id: "settings",
      label: "Site Settings",
      path: "/admin/settings",
    },
  ];

  // Get current active nav item based on pathname
  const activeNavItem = $derived(() => {
    const currentPath = page.url.pathname;

    // Handle exact match for dashboard
    if (currentPath === "/admin") return "dashboard";

    // Sort navigation items by path length (longest first) to match more specific routes first
    const sortedNav = [...adminNav].sort(
      (a, b) => b.path.length - a.path.length
    );

    // Find the matching route (excluding dashboard since it's handled above)
    const matchedItem = sortedNav.find(
      (item) => item.id !== "dashboard" && currentPath.startsWith(item.path)
    );

    return matchedItem?.id || "dashboard";
  });
</script>

<svelte:head>
  <title>Admin Dashboard - {data.settings.siteName}</title>
  <meta name="description" content={data.settings.siteDescription} />
</svelte:head>

<div class="min-h-screen bg-background">
  <!-- Admin Header -->
  <header
    class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div class="w-full h-14 flex justify-between items-center px-6">
      <!-- Left: Go back to app button -->
      <Button
        variant="ghost"
        size="sm"
        onclick={() => goto("/")}
        class="text-sm font-medium cursor-pointer"
      >
        ← Go back to app
      </Button>

      <!-- Center: Navigation Menu (Desktop only) -->
      {#if !isMobile.current}
        <NavigationMenu.Root>
          <NavigationMenu.List>
            {#each adminNav as navItem}
              <NavigationMenu.Item>
                <NavigationMenu.Link
                  href={navItem.path}
                  class="group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 {activeNavItem() ===
                  navItem.id
                    ? 'bg-accent text-accent-foreground'
                    : ''}"
                >
                  {navItem.label}
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            {/each}
          </NavigationMenu.List>
        </NavigationMenu.Root>
      {/if}

      <!-- Right: Spacer (Desktop) / Hamburger Button (Mobile) -->
      {#if isMobile.current}
        <!-- Mobile: Hamburger Button -->
        <Button
          variant="ghost"
          size="sm"
          onclick={() => mobileNavOpen = true}
          class="p-2"
        >
          <MenuIcon class="h-5 w-5" />
        </Button>
      {:else}
        <!-- Desktop: Spacer for balance -->
        <div class="w-[140px]"></div>
      {/if}
    </div>
  </header>

  <!-- Mobile Navigation Sheet -->
  <Sheet.Root bind:open={mobileNavOpen}>
    <Sheet.Content side="left" class="w-64">
      <Sheet.Header>
        <Sheet.Title>Admin Navigation</Sheet.Title>
        <Sheet.Description>
          Navigate through the admin dashboard
        </Sheet.Description>
      </Sheet.Header>
      <div class="flex flex-col gap-2 py-4">
        {#each adminNav as navItem}
          <Button
            variant={activeNavItem() === navItem.id ? "secondary" : "ghost"}
            class="justify-start w-full"
            onclick={() => {
              goto(navItem.path);
              mobileNavOpen = false;
            }}
          >
            {navItem.label}
          </Button>
        {/each}
      </div>
    </Sheet.Content>
  </Sheet.Root>

  <!-- Main Content -->
  <main class="container mx-auto px-6 py-8">
    {@render children()}
  </main>
</div>

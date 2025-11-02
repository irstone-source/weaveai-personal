<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  // Stats data with real database counts
  const stats = $derived([
    {
      title: "Total Users",
      value: data.totalUsers.toLocaleString(),
      description: "Registered users",
      trend: null,
    },
    {
      title: "Total Chats",
      value: data.totalChats.toLocaleString(),
      description: "Conversations created",
      trend: null,
    },
    {
      title: "Images Generated",
      value: data.totalImages.toLocaleString(),
      description: "Total images generated",
      trend: null,
    },
    {
      title: "Videos Generated",
      value: data.totalVideos.toLocaleString(),
      description: "Total videos generated",
      trend: null,
    },
    {
      title: "Total Revenue",
      value: `$${(Number(data.totalRevenue) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      description: "Revenue from payments",
      trend: null,
    },
    {
      title: "Active Subscriptions",
      value: data.activeSubscriptions.toLocaleString(),
      description: "Current active subscriptions",
      trend: null,
    },
  ]);

  // Recent activity data from server
  const recentActivity = $derived(data.recentActivity);
</script>

<svelte:head>
  <title>Admin Dashboard - {data.settings.siteName}</title>
</svelte:head>

<div class="space-y-8">
  <!-- Page Header -->
  <div>
    <h1 class="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
    <p class="text-muted-foreground">
      Monitor your platform's performance and activity.
    </p>
  </div>

  <!-- Stats Grid -->
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {#each stats as stat}
      <Card.Root>
        <Card.Header
          class="flex flex-row items-center justify-between space-y-0 pb-2"
        >
          <Card.Title class="text-sm font-medium">{stat.title}</Card.Title>
        </Card.Header>
        <Card.Content>
          <div class="text-2xl font-bold">{stat.value}</div>
          <p class="text-xs text-muted-foreground">{stat.description}</p>
          {#if stat.trend}
            <p class="text-xs text-green-600 mt-1">{stat.trend}</p>
          {/if}
        </Card.Content>
      </Card.Root>
    {/each}
  </div>

  <!-- Recent Activity & Quick Actions -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <!-- Recent Activity -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Recent Activity</Card.Title>
        <Card.Description
          >Latest user actions across the platform</Card.Description
        >
      </Card.Header>
      <Card.Content>
        <div class="space-y-3">
          {#if recentActivity.length > 0}
            {#each recentActivity as activity}
              <div
                class="flex items-center justify-between border-b pb-2 last:border-b-0"
              >
                <div class="space-y-1">
                  <p class="text-sm font-medium">{activity.user}</p>
                  <p class="text-xs text-muted-foreground">{activity.action}</p>
                </div>
                <p class="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            {/each}
          {:else}
            <div class="text-center py-4">
              <p class="text-sm text-muted-foreground">No recent activity</p>
            </div>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Quick Actions -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Quick Actions</Card.Title>
        <Card.Description>Common administrative tasks</Card.Description>
      </Card.Header>
      <Card.Content>
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="outline"
            class="h-auto flex-col gap-2 p-4 cursor-pointer"
            onclick={() => goto("/admin/analytics")}
          >
            <div class="text-lg">📊</div>
            <span>Analytics</span>
          </Button>
          <Button
            variant="outline"
            class="h-auto flex-col gap-2 p-4 cursor-pointer"
            onclick={() => goto("/admin/users")}
          >
            <div class="text-lg">👥</div>
            <span>Manage Users</span>
          </Button>
          <Button
            variant="outline"
            class="h-auto flex-col gap-2 p-4 cursor-pointer"
            onclick={() => goto("/admin/payments")}
          >
            <div class="text-lg">💳</div>
            <span>Manage Payments</span>
          </Button>
          <Button
            variant="outline"
            class="h-auto flex-col gap-2 p-4 cursor-pointer"
            onclick={() => goto("/admin/subscriptions")}
          >
            <div class="text-lg">📋</div>
            <span>Manage Subscriptions</span>
          </Button>
          <Button
            variant="outline"
            class="h-auto flex-col gap-2 p-4 cursor-pointer"
            onclick={() => goto("/admin/settings")}
          >
            <div class="text-lg">⚙️</div>
            <span>Settings</span>
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</div>

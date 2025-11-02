<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Pagination from "$lib/components/ui/pagination/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  // Import icons
  import { GemIcon } from "$lib/icons/index.js";

  let { data } = $props();

  // Pagination state
  let currentPage = $state(data.currentPage);

  // Handle page changes
  function handlePageChange(newPage: number) {
    currentPage = newPage;
    const url = new URL(page.url);
    url.searchParams.set("page", newPage.toString());
    goto(url.toString());
  }

  // Calculate showing range
  const showingStart = $derived(() => {
    if (data.totalPlans === 0) return 0;
    return (data.currentPage - 1) * data.plansPerPage + 1;
  });

  const showingEnd = $derived(() => {
    const end = data.currentPage * data.plansPerPage;
    return end > data.totalPlans ? data.totalPlans : end;
  });

  // Format price from cents to dollars
  function formatPrice(amountInCents: number, currency: string) {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  }

  // Format tier for display
  function formatTier(tier: string) {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  }

  // Format billing interval
  function formatBillingInterval(interval: string) {
    return interval === "month" ? "Monthly" : "Yearly";
  }

  // Format limits for display
  function formatLimit(limit: number | null) {
    return limit === null ? "Unlimited" : limit.toLocaleString();
  }

  // Get badge variant for plan tier
  function getTierVariant(tier: string) {
    switch (tier) {
      case "free":
        return "outline";
      case "starter":
        return "secondary";
      case "pro":
        return "default";
      case "advanced":
        return "destructive";
      default:
        return "outline";
    }
  }

  // Handle status toggle
  async function togglePlanStatus(planId: string, currentStatus: boolean) {
    try {
      const response = await fetch(`/api/admin/plans/${planId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        // Refresh the page to show updated status
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to toggle plan status:", error);
    }
  }
</script>

<svelte:head>
  <title>Pricing Plans - Admin Settings</title>
</svelte:head>

<div class="space-y-4">
  <!-- Demo Mode Banner -->
  {#if data.isDemoMode}
    <div
      class="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-md"
    >
      <div class="flex items-center gap-2">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            ></path>
          </svg>
        </div>
        <div>
          <p class="font-medium">Demo Mode Active</p>
          <p class="text-sm">
            All modifications are disabled. This is a read-only demonstration of
            the admin interface.
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Page Header -->
  <div class="flex justify-between items-center">
    <div>
      <h1 class="text-xl font-semibold tracking-tight flex items-center gap-2">
        <GemIcon class="w-6 h-6" />
        Pricing Plans
      </h1>
      <p class="text-muted-foreground">
        Create, edit, and manage subscription pricing plans for the platform.
      </p>
    </div>
    <Button
      onclick={() => goto("/admin/settings/plans/create")}
      disabled={data.isDemoMode}
    >
      {data.isDemoMode ? "Create Plan" : "Create Plan"}
    </Button>
  </div>

  <!-- Plans Table -->
  <Card.Root>
    <Card.Header>
      <Card.Title>All Plans</Card.Title>
      <Card.Description>
        {#if data.totalPlans === 0}
          No plans created
        {:else}
          Showing {showingStart()}-{showingEnd()} of {data.totalPlans} plans
        {/if}
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if data.plans.length === 0}
        <div class="text-center py-8 text-muted-foreground">
          No plans found. <Button
            variant="link"
            onclick={() => goto("/admin/settings/plans/create")}
            disabled={data.isDemoMode}
            >{data.isDemoMode ? "Demo Mode" : "Create your first plan"}</Button
          >
        </div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Plan Name</Table.Head>
              <Table.Head>Tier</Table.Head>
              <Table.Head>Price</Table.Head>
              <Table.Head>Text Limit</Table.Head>
              <Table.Head>Image Limit</Table.Head>
              <Table.Head>Video Limit</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.plans as plan}
              <Table.Row>
                <Table.Cell class="font-medium">
                  {plan.name}
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={getTierVariant(plan.tier)}>
                    {formatTier(plan.tier)}
                  </Badge>
                </Table.Cell>
                <Table.Cell class="font-mono">
                  <div class="space-y-1">
                    <div>{formatPrice(plan.priceAmount, plan.currency)}</div>
                    <div class="text-sm text-muted-foreground">
                      {formatBillingInterval(plan.billingInterval)}
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {formatLimit(plan.textGenerationLimit)}
                </Table.Cell>
                <Table.Cell>
                  {formatLimit(plan.imageGenerationLimit)}
                </Table.Cell>
                <Table.Cell>
                  {formatLimit(plan.videoGenerationLimit)}
                </Table.Cell>
                <Table.Cell>
                  <div class="flex items-center space-x-2">
                    <Switch
                      checked={plan.isActive}
                      onCheckedChange={() =>
                        togglePlanStatus(plan.id, plan.isActive)}
                      disabled={data.isDemoMode}
                    />
                    <Badge variant={plan.isActive ? "default" : "secondary"}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => goto(`/admin/settings/plans/${plan.id}`)}
                    disabled={data.isDemoMode}
                  >
                    {data.isDemoMode ? "Edit" : "Edit"}
                  </Button>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>

        <!-- Pagination -->
        {#if data.totalPages > 1}
          <div class="flex justify-center">
            <Pagination.Root
              count={data.totalPlans}
              perPage={data.plansPerPage}
              bind:page={currentPage}
              siblingCount={1}
            >
              {#snippet children({ pages, currentPage: paginationCurrentPage })}
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.PrevButton
                      onclick={() => {
                        if (paginationCurrentPage > 1) {
                          handlePageChange(paginationCurrentPage - 1);
                        }
                      }}
                    />
                  </Pagination.Item>

                  {#each pages as page (page.key)}
                    {#if page.type === "ellipsis"}
                      <Pagination.Item>
                        <Pagination.Ellipsis />
                      </Pagination.Item>
                    {:else}
                      <Pagination.Item>
                        <Pagination.Link
                          {page}
                          isActive={paginationCurrentPage === page.value}
                          onclick={() => handlePageChange(page.value)}
                        >
                          {page.value}
                        </Pagination.Link>
                      </Pagination.Item>
                    {/if}
                  {/each}

                  <Pagination.Item>
                    <Pagination.NextButton
                      onclick={() => {
                        if (paginationCurrentPage < data.totalPages) {
                          handlePageChange(paginationCurrentPage + 1);
                        }
                      }}
                    />
                  </Pagination.Item>
                </Pagination.Content>
              {/snippet}
            </Pagination.Root>
          </div>
        {/if}
      {/if}
    </Card.Content>
  </Card.Root>
</div>

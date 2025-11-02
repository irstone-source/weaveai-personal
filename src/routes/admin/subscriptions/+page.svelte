<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Pagination from "$lib/components/ui/pagination/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  let { data } = $props();

  // Pagination state
  let currentPage = $state(data.currentPage);

  // Sync local state with server data
  $effect(() => {
    currentPage = data.currentPage;
  });

  // Handle page changes
  function handlePageChange(newPage: number) {
    currentPage = newPage;
    const url = new URL(page.url);
    url.searchParams.set("page", newPage.toString());
    goto(url.toString());
  }

  // Calculate showing range
  const showingStart = $derived(() => {
    if (data.totalSubscriptions === 0) return 0;
    return (data.currentPage - 1) * data.subscriptionsPerPage + 1;
  });

  const showingEnd = $derived(() => {
    const end = data.currentPage * data.subscriptionsPerPage;
    return end > data.totalSubscriptions ? data.totalSubscriptions : end;
  });

  // Format date for display
  function formatDate(date: Date | null) {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  }

  // Format subscription period
  function formatPeriod(start: Date | null, end: Date | null) {
    if (!start || !end) return "N/A";
    return `${formatDate(start)} - ${formatDate(end)}`;
  }

  // Get badge variant for subscription status
  function getStatusVariant(status: string) {
    switch (status) {
      case "active":
        return "default";
      case "trialing":
        return "secondary";
      case "canceled":
      case "incomplete":
      case "incomplete_expired":
        return "outline";
      case "past_due":
      case "unpaid":
        return "destructive";
      default:
        return "secondary";
    }
  }

  // Format plan tier
  function formatPlanTier(planTier: string | null) {
    if (!planTier) return "N/A";
    return planTier.charAt(0).toUpperCase() + planTier.slice(1);
  }

  // Format status for display
  function formatStatus(status: string) {
    // Handle snake_case statuses
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
</script>

<svelte:head>
  <title>Subscription Management - Admin Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <!-- Page Header -->
  <div>
    <h1 class="text-3xl font-bold tracking-tight">Subscription Management</h1>
    <p class="text-muted-foreground">
      View and manage all user subscriptions on the platform.
    </p>
  </div>

  <!-- Subscriptions Table -->
  <Card.Root>
    <Card.Header>
      <Card.Title>All Subscriptions</Card.Title>
      <Card.Description>
        {#if data.totalSubscriptions === 0}
          No subscriptions found
        {:else}
          Showing {showingStart()}-{showingEnd()} of {data.totalSubscriptions} subscriptions
        {/if}
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if data.subscriptions.length === 0}
        <div class="text-center py-8 text-muted-foreground">
          No subscriptions found
        </div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>User</Table.Head>
              <Table.Head>Plan</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Period (Start - End)</Table.Head>
              <Table.Head>Auto-Renew</Table.Head>
              <Table.Head>Created at</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.subscriptions as subscription}
              <Table.Row>
                <Table.Cell class="font-medium">
                  <div class="space-y-1">
                    <div>{subscription.userName || "N/A"}</div>
                    <div class="text-sm text-muted-foreground">
                      {subscription.userEmail || "N/A"}
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell class="font-medium">
                  {formatPlanTier(subscription.planTier)}
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={getStatusVariant(subscription.status)}>
                    {formatStatus(subscription.status)}
                  </Badge>
                </Table.Cell>
                <Table.Cell class="text-sm">
                  {formatPeriod(
                    subscription.currentPeriodStart,
                    subscription.currentPeriodEnd
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    variant={subscription.cancelAtPeriodEnd
                      ? "destructive"
                      : "default"}
                  >
                    {subscription.cancelAtPeriodEnd ? "No" : "Yes"}
                  </Badge>
                </Table.Cell>
                <Table.Cell class="text-sm text-muted-foreground">
                  {formatDate(subscription.createdAt)}
                </Table.Cell>
                <Table.Cell>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => goto(`/admin/users/${subscription.userId}`)}
                  >
                    Edit
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
              count={data.totalSubscriptions}
              perPage={data.subscriptionsPerPage}
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

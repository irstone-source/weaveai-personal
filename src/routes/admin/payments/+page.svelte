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
    if (data.totalPayments === 0) return 0;
    return (data.currentPage - 1) * data.paymentsPerPage + 1;
  });

  const showingEnd = $derived(() => {
    const end = data.currentPage * data.paymentsPerPage;
    return end > data.totalPayments ? data.totalPayments : end;
  });

  // Format amount from cents to dollars
  function formatAmount(amountInCents: number, currency: string) {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  }

  // Format date for display
  function formatDate(date: Date | null) {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  // Get badge variant for payment status
  function getStatusVariant(status: string) {
    switch (status) {
      case "succeeded":
        return "default";
      case "pending":
        return "secondary";
      case "failed":
      case "canceled":
        return "destructive";
      case "refunded":
        return "outline";
      default:
        return "secondary";
    }
  }

  // Format payment method
  function formatPaymentMethod(
    type: string | null,
    brand: string | null,
    last4: string | null
  ) {
    if (!type) return "N/A";

    let method = type.charAt(0).toUpperCase() + type.slice(1);

    if (brand && last4) {
      const brandFormatted = brand.charAt(0).toUpperCase() + brand.slice(1);
      method = `${brandFormatted} •••• ${last4}`;
    }

    return method;
  }
</script>

<svelte:head>
  <title>Payment Management - Admin Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <!-- Page Header -->
  <div>
    <h1 class="text-3xl font-bold tracking-tight">Payment Management</h1>
    <p class="text-muted-foreground">
      View and manage all payment transactions on the platform.
    </p>
  </div>

  <!-- Payments Table -->
  <Card.Root>
    <Card.Header>
      <Card.Title>All Payments</Card.Title>
      <Card.Description>
        {#if data.totalPayments === 0}
          No payments recorded
        {:else}
          Showing {showingStart()}-{showingEnd()} of {data.totalPayments} payments
        {/if}
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if data.payments.length === 0}
        <div class="text-center py-8 text-muted-foreground">
          No payments found
        </div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>User</Table.Head>
              <Table.Head>Amount</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Payment Method</Table.Head>
              <Table.Head>Description</Table.Head>
              <Table.Head>Created at</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.payments as payment}
              <Table.Row>
                <Table.Cell class="font-medium">
                  <div class="space-y-1">
                    <div>{payment.userName || "N/A"}</div>
                    <div class="text-sm text-muted-foreground">
                      {payment.userEmail || "N/A"}
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell class="font-mono">
                  <span class="text-green-600 font-semibold">
                    {formatAmount(payment.amount, payment.currency)}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={getStatusVariant(payment.status)}>
                    {payment.status.charAt(0).toUpperCase() +
                      payment.status.slice(1)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {formatPaymentMethod(
                    payment.paymentMethodType,
                    payment.brand,
                    payment.last4
                  )}
                </Table.Cell>
                <Table.Cell>
                  <div class="max-w-xs truncate">
                    {payment.description || "N/A"}
                  </div>
                </Table.Cell>
                <Table.Cell class="text-sm text-muted-foreground">
                  {formatDate(payment.paidAt || payment.createdAt)}
                </Table.Cell>
                <Table.Cell>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => goto(`/admin/users/${payment.userId}`)}
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
              count={data.totalPayments}
              perPage={data.paymentsPerPage}
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

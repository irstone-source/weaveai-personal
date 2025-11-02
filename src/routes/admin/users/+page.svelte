<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Pagination from "$lib/components/ui/pagination/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import LoaderIcon from "@lucide/svelte/icons/loader";

  let { data } = $props();

  // Constants
  const MAX_SEARCH_QUERY_LENGTH = 100;

  // Pagination state
  let currentPage = $state(data.currentPage);

  // Search state
  let searchQuery = $state(data.searchQuery || "");
  let searchError = $state("");
  let isSearching = $state(false);

  // Sync local state with server data
  $effect(() => {
    currentPage = data.currentPage;
    searchQuery = data.searchQuery || "";
    // Clear loading state when data is updated
    isSearching = false;
  });

  // Handle page changes
  function handlePageChange(newPage: number) {
    currentPage = newPage;
    const url = new URL(page.url);
    url.searchParams.set("page", newPage.toString());
    if (searchQuery) {
      url.searchParams.set("search", searchQuery);
    }
    goto(url.toString());
  }

  // Handle real-time input value updates (no search triggering)
  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;

    // Enforce maximum length
    if (value.length <= MAX_SEARCH_QUERY_LENGTH) {
      searchQuery = value;
    } else {
      // Prevent input if over limit
      target.value = searchQuery;
    }
  }

  // Handle Enter key press for search
  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      performSearch(searchQuery);
    }
  }

  // Perform the actual search
  function performSearch(query: string) {
    try {
      // Prevent multiple simultaneous searches
      if (isSearching) {
        return;
      }

      const trimmedQuery = query.trim();

      // Clear any previous search errors and set loading state
      searchError = "";
      isSearching = true;

      // Validate query length
      if (trimmedQuery.length > MAX_SEARCH_QUERY_LENGTH) {
        searchError = `Search query cannot exceed ${MAX_SEARCH_QUERY_LENGTH} characters`;
        isSearching = false;
        return;
      }

      // Store current URL for comparison
      const currentUrl = page.url.toString();
      const targetUrl = new URL(page.url);

      if (trimmedQuery) {
        targetUrl.searchParams.set("search", trimmedQuery);
      } else {
        targetUrl.searchParams.delete("search");
      }

      // Reset to page 1 when searching
      targetUrl.searchParams.set("page", "1");

      const targetUrlString = targetUrl.toString();

      // Check if URL will actually change
      if (currentUrl === targetUrlString) {
        // URL won't change, so clear loading immediately
        isSearching = false;
        return;
      }

      goto(targetUrlString);

      // Add safety timeout as failsafe
      setTimeout(() => {
        if (isSearching) {
          isSearching = false;
        }
      }, 2000);
    } catch (error) {
      console.error("Search error:", error);
      searchError = "An error occurred while searching. Please try again.";
      isSearching = false;
    }
  }

  // Clear search
  function clearSearch() {
    searchQuery = "";
    searchError = "";
    const url = new URL(page.url);
    url.searchParams.delete("search");
    url.searchParams.set("page", "1");

    goto(url.toString());
  }

  // Calculate showing range
  const showingStart = $derived(() => {
    if (data.totalUsers === 0) return 0;
    return (data.currentPage - 1) * data.usersPerPage + 1;
  });

  const showingEnd = $derived(() => {
    const end = data.currentPage * data.usersPerPage;
    return end > data.totalUsers ? data.totalUsers : end;
  });

  // Format subscription status for display
  function formatSubscriptionStatus(status: string | null) {
    if (!status || status === "incomplete") return "Free";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Get badge variant for subscription status
  function getStatusVariant(status: string | null) {
    switch (status) {
      case "active":
        return "default";
      case "trialing":
        return "secondary";
      case "past_due":
      case "unpaid":
        return "destructive";
      case "canceled":
        return "outline";
      default:
        return "secondary";
    }
  }

  // Format date for display
  function formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }
</script>

<svelte:head>
  <title>User Management - Admin Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <!-- Page Header -->
  <div>
    <h1 class="text-3xl font-bold tracking-tight">User Management</h1>
    <p class="text-muted-foreground">
      Manage and view all registered users on the platform.
    </p>
  </div>

  <!-- Search Bar -->
  <div class="flex items-center space-x-2 mb-3">
    <div class="relative flex-1 max-w-sm">
      {#if isSearching}
        <LoaderIcon
          class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin"
        />
      {:else}
        <SearchIcon
          class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      {/if}
      <Input
        type="text"
        placeholder="Search by partial or full email or user ID..."
        value={searchQuery}
        maxlength={MAX_SEARCH_QUERY_LENGTH}
        oninput={handleSearchInput}
        onkeydown={handleSearchKeydown}
        class="pl-9"
        disabled={isSearching}
        aria-label="Search users by email or user ID"
        aria-describedby="search-instructions"
      />
      {#if searchQuery}
        <button
          type="button"
          onclick={clearSearch}
          class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear search query"
          title="Clear search"
        >
          <XIcon class="h-4 w-4" />
        </button>
      {/if}
    </div>

    <!-- Screen reader instructions -->
    <div id="search-instructions" class="sr-only">
      Press Enter to search, or click the X button to clear the search.
    </div>

    <!-- Screen reader announcements for search results -->
    <div aria-live="polite" aria-atomic="true" class="sr-only">
      {#if data.searchQuery}
        {data.totalUsers === 0
          ? `No users found matching "${data.searchQuery}"`
          : `Found ${data.totalUsers} users matching "${data.searchQuery}"`}
      {/if}
    </div>
  </div>

  <!-- Search Error Display -->
  {#if searchError}
    <div class="rounded-md bg-red-50 p-4 border border-red-200" role="alert">
      <div class="flex">
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Search Error</h3>
          <p class="mt-1 text-sm text-red-700">{searchError}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Users Table -->
  <Card.Root>
    <Card.Header>
      <Card.Title
        >{data.searchQuery ? "Search Results" : "All Users"}</Card.Title
      >
      <Card.Description>
        {#if data.totalUsers === 0}
          {data.searchQuery
            ? `No users found matching "${data.searchQuery}"`
            : "No users registered"}
        {:else if data.searchQuery}
          Showing {showingStart()}-{showingEnd()} of {data.totalUsers} users matching
          "{data.searchQuery}"
        {:else}
          Showing {showingStart()}-{showingEnd()} of {data.totalUsers} users
        {/if}
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if data.users.length === 0}
        <div class="text-center py-8 text-muted-foreground">No users found</div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Name</Table.Head>
              <Table.Head>Email</Table.Head>
              <Table.Head>Subscription Status</Table.Head>
              <Table.Head>Plan</Table.Head>
              <Table.Head>Role</Table.Head>
              <Table.Head>Created at</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.users as user}
              <Table.Row>
                <Table.Cell class="font-medium">
                  {user.name || "N/A"}
                </Table.Cell>
                <Table.Cell>
                  {user.email || "N/A"}
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={getStatusVariant(user.currentSubscriptionStatus || user.subscriptionStatus)}>
                    {formatSubscriptionStatus(user.currentSubscriptionStatus || user.subscriptionStatus)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {user.currentSubscriptionPlanTier
                    ? user.currentSubscriptionPlanTier.charAt(0).toUpperCase() +
                      user.currentSubscriptionPlanTier.slice(1)
                    : "Free"}
                </Table.Cell>
                <Table.Cell>
                  {#if user.isAdmin}
                    Admin
                  {:else}
                    User
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-sm text-muted-foreground">
                  {formatDate(user.createdAt)}
                </Table.Cell>
                <Table.Cell>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => goto(`/admin/users/${user.id}`)}
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
              count={data.totalUsers}
              perPage={data.usersPerPage}
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

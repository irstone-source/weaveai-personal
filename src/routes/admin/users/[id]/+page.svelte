<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Progress } from "$lib/components/ui/progress/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { goto } from "$app/navigation";
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";

  let { data, form }: { data: any; form: ActionData } = $props();

  // Modal state
  let editDialogOpen = $state(false);
  let roleDialogOpen = $state(false);

  // Form state
  let formName = $state(data.user.name || "");
  let formEmail = $state(data.user.email || "");
  let isSubmitting = $state(false);
  let formError = $state("");
  let successMessage = $state("");

  // Role management state
  let isRoleSubmitting = $state(false);
  let roleFormError = $state("");
  let selectedRole = $state(data.user.isAdmin ? "admin" : "user");

  // Reset form when dialog opens
  function openEditDialog() {
    formName = data.user.name || "";
    formEmail = data.user.email || "";
    formError = "";
    roleFormError = "";
    successMessage = "";
    editDialogOpen = true;
  }

  // Role management functions

  function canChangeRole() {
    // Prevent admin from removing their own admin privileges
    return !(data.user.id === data.currentAdminId && selectedRole === "user");
  }

  // Convert role string to boolean for backend
  function getRoleBoolean() {
    return selectedRole === "admin";
  }

  // Handle cancel - reset dropdown to current role
  function handleCancel() {
    selectedRole = data.user.isAdmin ? "admin" : "user";
    roleDialogOpen = false;
  }

  // Keep selectedRole in sync with data changes
  // Only sync when dialog is closed to prevent interference
  $effect(() => {
    if (!roleDialogOpen) {
      selectedRole = data.user.isAdmin ? "admin" : "user";
    }
  });

  // Watch for role changes and open confirmation dialog
  $effect(() => {
    const currentRole = data.user.isAdmin ? "admin" : "user";
    // Only open dialog if role differs AND dialog is not already open
    // This prevents interference with existing dialog states
    if (selectedRole !== currentRole && !roleDialogOpen) {
      roleFormError = "";
      formError = "";
      successMessage = "";
      roleDialogOpen = true;
    }
  });

  // Handle form response
  $effect(() => {
    if (form) {
      isSubmitting = false;
      isRoleSubmitting = false;
      if (form.success) {
        successMessage = form.message || "User updated successfully";
        // Update the data optimistically
        if (form.message?.includes("role") && roleDialogOpen) {
          // Role update - only process if role dialog is open
          data.user.isAdmin = getRoleBoolean();
          roleDialogOpen = false;
          // Clear form response to prevent reprocessing
          setTimeout(() => {
            if (form?.success) {
              form.success = false;
              form.message = "";
            }
          }, 100);
        } else if (!form.message?.includes("role") && editDialogOpen) {
          // User info update - only process if edit dialog is open
          data.user.name = formName;
          data.user.email = formEmail;
          editDialogOpen = false;
        }
        // Clear success message after 3 seconds
        setTimeout(() => (successMessage = ""), 3000);
      } else if (form.error) {
        // Set error based on which dialog is open
        if (roleDialogOpen) {
          roleFormError = form.error;
        } else if (editDialogOpen) {
          formError = form.error;
        }
      }
    }
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

  // Format date for user info (without time)
  function formatDateOnly(date: Date | null) {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  }

  // Format subscription period
  function formatPeriod(start: Date | null, end: Date | null) {
    if (!start || !end) return "N/A";
    const startFormatted = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(start));
    const endFormatted = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(end));
    return `${startFormatted} - ${endFormatted}`;
  }

  // Get badge variant for payment status
  function getPaymentStatusVariant(status: string) {
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

  // Get badge variant for subscription status
  function getSubscriptionStatusVariant(status: string) {
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

  // Format plan tier
  function formatPlanTier(planTier: string | null) {
    if (!planTier) return "N/A";
    return planTier.charAt(0).toUpperCase() + planTier.slice(1);
  }

  // Format status for display
  function formatStatus(status: string) {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Calculate usage percentage
  function calculateUsagePercentage(used: number, limit: number | null) {
    if (limit === null || limit === 0) return 0; // Unlimited or no limit
    return Math.min((used / limit) * 100, 100);
  }

  // Format usage display
  function formatUsage(used: number, limit: number | null) {
    if (limit === null) return `${used.toLocaleString()} / Unlimited`;
    return `${used.toLocaleString()} / ${limit.toLocaleString()}`;
  }

  // Format month name
  function formatMonth(month: number, year: number) {
    const date = new Date(year, month - 1); // month - 1 because Date months are 0-indexed
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
</script>

<svelte:head>
  <title
    >{data.user.name || data.user.email} - User Details - Admin Dashboard</title
  >
</svelte:head>

<div class="space-y-6">
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

  <!-- Page Header with Breadcrumb -->
  <div class="space-y-2">
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <Button
        variant="link"
        class="p-0 h-auto font-normal text-muted-foreground hover:text-foreground"
        onclick={() => goto("/admin/users")}
      >
        Users
      </Button>
      <span>/</span>
      <span>{data.user.name || data.user.email}</span>
    </div>
    <div>
      <h1 class="text-3xl font-bold tracking-tight">User Details</h1>
      <p class="text-muted-foreground">
        Comprehensive information for {data.user.name || data.user.email}
      </p>
    </div>
  </div>

  <!-- Success Message -->
  {#if successMessage}
    <div
      class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md"
    >
      {successMessage}
    </div>
  {/if}

  <!-- User Information -->
  <Card.Root>
    <Card.Header class="flex flex-row items-center justify-between">
      <div>
        <Card.Title>User Information</Card.Title>
        <Card.Description>Basic account details and settings</Card.Description>
      </div>
      <Button
        variant="outline"
        onclick={openEditDialog}
        disabled={data.isDemoMode}
      >
        {data.isDemoMode ? "Edit User" : "Edit User"}
      </Button>
    </Card.Header>
    <Card.Content>
      <Table.Root>
        <Table.Body>
          <Table.Row>
            <Table.Cell class="font-medium w-1/3">Name</Table.Cell>
            <Table.Cell class="text-muted-foreground"
              >{data.user.name || "N/A"}</Table.Cell
            >
          </Table.Row>
          <Table.Row>
            <Table.Cell class="font-medium">Email</Table.Cell>
            <Table.Cell class="text-muted-foreground"
              >{data.user.email || "N/A"}</Table.Cell
            >
          </Table.Row>
          <Table.Row>
            <Table.Cell class="font-medium">Email Verified</Table.Cell>
            <Table.Cell>
              {#if data.user.emailVerified}
                <Badge variant="default"
                  >Verified on {formatDateOnly(data.user.emailVerified)}</Badge
                >
              {:else}
                <Badge variant="outline">Not Verified</Badge>
              {/if}
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell class="font-medium">Current Plan</Table.Cell>
            <Table.Cell class="text-muted-foreground">
              {formatPlanTier(data.user.planTier)}
              {data.user.planTier ? "" : "(Free)"}
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell class="font-medium">Role</Table.Cell>
            <Table.Cell>
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <Select.Root
                    type="single"
                    name="role-select"
                    bind:value={selectedRole}
                    disabled={data.isDemoMode}
                  >
                    <Select.Trigger
                      class="w-40"
                      size="sm"
                      disabled={data.isDemoMode}
                    >
                      {selectedRole === "admin" ? "Admin" : "User"}
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item
                        value="user"
                        label="User"
                        disabled={data.user.id === data.currentAdminId &&
                          data.user.isAdmin}
                      >
                        User
                      </Select.Item>
                      <Select.Item value="admin" label="Admin">
                        Admin
                      </Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
                {#if data.isDemoMode}
                  <span class="text-xs text-muted-foreground">
                    (Demo mode - role changes disabled)
                  </span>
                {/if}
              </div>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell class="font-medium">User ID</Table.Cell>
            <Table.Cell class="text-muted-foreground">{data.user.id}</Table.Cell
            >
          </Table.Row>
          <Table.Row>
            <Table.Cell class="font-medium">Account Created</Table.Cell>
            <Table.Cell class="text-muted-foreground"
              >{formatDate(data.user.createdAt)}</Table.Cell
            >
          </Table.Row>
          <Table.Row>
            <Table.Cell class="font-medium">Account Status</Table.Cell>
            <Table.Cell class="text-muted-foreground italic"
              >Coming soon</Table.Cell
            >
          </Table.Row>
          <Table.Row>
            <Table.Cell class="font-medium">Deactivate Account</Table.Cell>
            <Table.Cell class="text-muted-foreground italic"
              >Coming soon</Table.Cell
            >
          </Table.Row>
        </Table.Body>
      </Table.Root>
    </Card.Content>
  </Card.Root>

  <!-- Usage & Quota -->
  <Card.Root>
    <Card.Header>
      <Card.Title>Usage & Quota</Card.Title>
      <Card.Description>
        Current usage for {formatMonth(data.currentMonth, data.currentYear)}
        {#if data.planLimits}
          on {formatPlanTier(data.planLimits.tier)} plan
        {:else}
          on Free plan
        {/if}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <div class="space-y-6">
        <!-- Text Generation Usage -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-medium">Text Generation</Label>
            <span class="text-sm text-muted-foreground">
              {formatUsage(
                data.usage.textGenerationCount,
                data.planLimits?.textGenerationLimit || null
              )}
            </span>
          </div>
          {#if data.planLimits?.textGenerationLimit}
            {@const percentage = calculateUsagePercentage(
              data.usage.textGenerationCount,
              data.planLimits.textGenerationLimit
            )}
            <Progress
              value={percentage}
              class="h-2 [&>div]:bg-green-500 {percentage >= 70
                ? '[&>div]:bg-yellow-500'
                : ''} {percentage >= 90 ? '[&>div]:bg-red-500' : ''}"
            />
          {:else}
            <div class="flex items-center gap-2">
              <Badge variant="secondary">Unlimited</Badge>
              <span class="text-xs text-muted-foreground"
                >{data.usage.textGenerationCount.toLocaleString()} used</span
              >
            </div>
          {/if}
        </div>

        <!-- Image Generation Usage -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-medium">Image Generation</Label>
            <span class="text-sm text-muted-foreground">
              {formatUsage(
                data.usage.imageGenerationCount,
                data.planLimits?.imageGenerationLimit || null
              )}
            </span>
          </div>
          {#if data.planLimits?.imageGenerationLimit}
            {@const percentage = calculateUsagePercentage(
              data.usage.imageGenerationCount,
              data.planLimits.imageGenerationLimit
            )}
            <Progress
              value={percentage}
              class="h-2 [&>div]:bg-green-500 {percentage >= 70
                ? '[&>div]:bg-yellow-500'
                : ''} {percentage >= 90 ? '[&>div]:bg-red-500' : ''}"
            />
          {:else}
            <div class="flex items-center gap-2">
              <Badge variant="secondary">Unlimited</Badge>
              <span class="text-xs text-muted-foreground"
                >{data.usage.imageGenerationCount.toLocaleString()} used</span
              >
            </div>
          {/if}
        </div>

        <!-- Video Generation Usage -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-medium">Video Generation</Label>
            <span class="text-sm text-muted-foreground">
              {formatUsage(
                data.usage.videoGenerationCount,
                data.planLimits?.videoGenerationLimit || null
              )}
            </span>
          </div>
          {#if data.planLimits?.videoGenerationLimit}
            {@const percentage = calculateUsagePercentage(
              data.usage.videoGenerationCount,
              data.planLimits.videoGenerationLimit
            )}
            <Progress
              value={percentage}
              class="h-2 [&>div]:bg-green-500 {percentage >= 70
                ? '[&>div]:bg-yellow-500'
                : ''} {percentage >= 90 ? '[&>div]:bg-red-500' : ''}"
            />
          {:else}
            <div class="flex items-center gap-2">
              <Badge variant="secondary">Unlimited</Badge>
              <span class="text-xs text-muted-foreground"
                >{data.usage.videoGenerationCount.toLocaleString()} used</span
              >
            </div>
          {/if}
        </div>

        <!-- Quota Reset Information -->
        {#if data.usage.lastResetAt}
          <div class="pt-4 border-t">
            <p class="text-xs text-muted-foreground">
              Last reset: {formatDate(data.usage.lastResetAt)}
            </p>
          </div>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Payment History -->
  <Card.Root>
    <Card.Header>
      <Card.Title>Payment History</Card.Title>
      <Card.Description>
        {data.payments.length === 0
          ? "No payments found"
          : `${data.payments.length} payment(s) found`}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      {#if data.payments.length === 0}
        <div class="text-center py-8 text-muted-foreground">
          No payment history available
        </div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Amount</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Payment Method</Table.Head>
              <Table.Head>Description</Table.Head>
              <Table.Head>Date</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.payments as payment}
              <Table.Row>
                <Table.Cell class="font-mono font-semibold text-green-600">
                  {formatAmount(payment.amount, payment.currency)}
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={getPaymentStatusVariant(payment.status)}>
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
                <Table.Cell class="text-sm">
                  {formatDate(payment.paidAt || payment.createdAt)}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Subscriptions -->
  <Card.Root>
    <Card.Header>
      <Card.Title>Subscriptions</Card.Title>
      <Card.Description>
        {data.subscriptions.length === 0
          ? "No subscriptions found"
          : `${data.subscriptions.length} subscription(s) found`}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      {#if data.subscriptions.length === 0}
        <div class="text-center py-8 text-muted-foreground">
          No subscription history available
        </div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Plan</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Period</Table.Head>
              <Table.Head>Auto-Renew</Table.Head>
              <Table.Head>Created</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.subscriptions as subscription}
              <Table.Row>
                <Table.Cell class="font-medium">
                  {formatPlanTier(subscription.planTier)}
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    variant={getSubscriptionStatusVariant(subscription.status)}
                  >
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
                <Table.Cell class="text-sm">
                  {formatDateOnly(subscription.createdAt)}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<!-- Edit User Dialog -->
<Dialog.Root bind:open={editDialogOpen}>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Edit User</Dialog.Title>
      <Dialog.Description>
        Update the user's name and email address. Click save when you're done.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action="?/updateUser"
      use:enhance={() => {
        isSubmitting = true;
        formError = "";
        return async ({ update }) => {
          await update();
        };
      }}
    >
      <div class="grid gap-4 py-4">
        {#if formError}
          <div
            class="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-md text-sm"
          >
            {formError}
          </div>
        {/if}

        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="name" class="text-right">Name</Label>
          <Input
            id="name"
            name="name"
            bind:value={formName}
            class="col-span-3"
            placeholder="Enter user's name"
            required
            disabled={isSubmitting || data.isDemoMode}
          />
        </div>

        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="email" class="text-right">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            bind:value={formEmail}
            class="col-span-3"
            placeholder="Enter user's email"
            required
            disabled={isSubmitting || data.isDemoMode}
          />
        </div>
      </div>

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          onclick={() => (editDialogOpen = false)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting ||
            !formName.trim() ||
            !formEmail.trim() ||
            data.isDemoMode}
        >
          {isSubmitting
            ? "Saving..."
            : data.isDemoMode
              ? "Demo Mode - Read Only"
              : "Save Changes"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<!-- Role Change Confirmation Dialog -->
<Dialog.Root bind:open={roleDialogOpen}>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>⚠️ Changing Role</Dialog.Title>
      <Dialog.Description>
        Are you sure you want to change this user's role to {selectedRole ===
        "admin"
          ? "Admin"
          : "User"}?
        {#if selectedRole === "admin"}
          <span class="font-semibold text-red-500"
            >THIS WILL GIVE THEM FULL ADMIN ACCESS TO THE PLATFORM.</span
          >
        {:else}
          <span class="font-semibold"
            >THIS WILL REMOVE THEIR ADMIN PRIVILEGES.</span
          >
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action="?/updateUserRole"
      use:enhance={() => {
        isRoleSubmitting = true;
        roleFormError = "";
        return async ({ update }) => {
          await update();
        };
      }}
    >
      <input type="hidden" name="isAdmin" value={getRoleBoolean()} />

      <div class="py-4">
        {#if roleFormError}
          <div
            class="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-md text-sm"
          >
            {roleFormError}
          </div>
        {/if}

        {#if data.user.id === data.currentAdminId && selectedRole === "user"}
          <div
            class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-md text-sm"
          >
            Warning: You cannot remove your own admin privileges.
          </div>
        {/if}
      </div>

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          onclick={handleCancel}
          disabled={isRoleSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isRoleSubmitting || !canChangeRole() || data.isDemoMode}
          variant={selectedRole === "admin" ? "default" : "default"}
        >
          {isRoleSubmitting
            ? "Updating..."
            : data.isDemoMode
              ? "Demo Mode - Read Only"
              : `Change to ${selectedRole === "admin" ? "Admin" : "User"}`}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

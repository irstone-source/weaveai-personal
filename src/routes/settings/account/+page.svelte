<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { enhance } from "$app/forms";
  import * as m from "$lib/../paraglide/messages.js";

  // Import icons
  import {
    KeyIcon,
    TrashIcon,
    AlertTriangleIcon,
    SaveIcon,
    CheckCircleIcon,
    ShieldIcon,
    MailIcon,
  } from "$lib/icons/index.js";

  let { data, form } = $props();
  let showDeleteDialog = $state(false);

  // Password change form state
  let isChangingPassword = $state(false);
  let isSubmittingPassword = $state(false);
  let currentPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");

  // Delete account form state
  let isDeletingAccount = $state(false);
  let deletePassword = $state("");
  let confirmText = $state("");

  // Email verification form state
  let isSendingVerification = $state(false);

  // Reset form when password change succeeds
  $effect(() => {
    if (form?.success) {
      isChangingPassword = false;
      isSubmittingPassword = false;
      currentPassword = "";
      newPassword = "";
      confirmPassword = "";
    }
  });

  function cancelPasswordChange() {
    isChangingPassword = false;
    currentPassword = "";
    newPassword = "";
    confirmPassword = "";
  }

  function openDeleteDialog() {
    showDeleteDialog = true;
    deletePassword = "";
    confirmText = "";
  }

  function closeDeleteDialog() {
    showDeleteDialog = false;
    deletePassword = "";
    confirmText = "";
  }

  // Always show password field for security - let server handle validation
</script>

<svelte:head>
  <title>{m["account.page_title"]()}</title>
</svelte:head>

<div class="space-y-3">
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
            Account security changes are disabled. This is a read-only
            demonstration.
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Success Message -->
  {#if form?.success}
    <div
      class="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md"
    >
      {form.message}
    </div>
  {/if}

  <!-- Error Message (only for non-delete account errors) -->
  {#if form?.error && !showDeleteDialog}
    <div
      class="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md"
    >
      {form.error}
    </div>
  {/if}

  <!-- Email Verification Status -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <MailIcon class="w-5 h-5" />
        {m["account.email_verification"]()}
      </Card.Title>
      <Card.Description
        >{m["account.email_verification_description"]()}</Card.Description
      >
    </Card.Header>
    <Card.Content class="space-y-4">
      <!-- Email Verification Status -->
      <div class="space-y-3">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{m["account.email_status"]()}</span>
            {#if data.user.emailVerified}
              <span class="text-sm font-medium text-green-600">{m["account.verified"]()}</span>
              <CheckCircleIcon class="w-4 h-4 text-green-600" />
            {:else}
              <span class="text-sm font-medium text-amber-500"
                >{m["account.not_verified"]()}</span
              >
              <AlertTriangleIcon class="w-4 h-4 text-amber-500" />
            {/if}
          </div>
          <p class="text-xs text-muted-foreground">{data.user.email}</p>
          {#if data.user.emailVerified}
            <p class="text-xs text-muted-foreground">
              {m["account.verified_on"]()} {new Date(
                data.user.emailVerified
              ).toLocaleDateString()}
            </p>
          {/if}
        </div>

        <!-- Verify Email Button (only show if not verified) -->
        {#if !data.user.emailVerified}
          <form
            method="POST"
            action="?/sendVerificationEmail"
            use:enhance={() => {
              isSendingVerification = true;
              return async ({ update }) => {
                await update();
                isSendingVerification = false;
              };
            }}
          >
            <Button
              type="submit"
              variant="outline"
              disabled={isSendingVerification ||
                (form as any)?.rateLimited ||
                data.isDemoMode}
              class="cursor-pointer w-full sm:w-auto flex items-center gap-2"
            >
              <MailIcon class="w-4 h-4" />
              {isSendingVerification
                ? m["account.sending"]()
                : m["account.send_verification_email"]()}
            </Button>
            {#if (form as any)?.rateLimited && (form as any)?.timeRemaining}
              <p class="text-xs text-amber-600 mt-1">
                {m["account.wait_minutes"]({ minutes: (form as any).timeRemaining })}
              </p>
            {/if}
            {#if data.isDemoMode}
              <p class="text-xs text-muted-foreground mt-2">
                Email verification is disabled in demo mode.
              </p>
            {/if}
          </form>
        {/if}
      </div>

      <!-- Authentication Methods -->
      {#if data.authProviders && data.authProviders.length > 0}
        <div class="pt-4 border-t space-y-3">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{m["account.authenticated_with"]()}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            {#each data.authProviders as provider}
              <div
                class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {#if provider.provider === "google"}
                  <span>{m["account.google_account"]()}</span>
                {:else if provider.provider === "facebook"}
                  <span>{m["account.facebook_account"]()}</span>
                {:else if provider.provider === "twitter"}
                  <span>{m["account.twitter_account"]()}</span>
                {:else if provider.provider === "apple"}
                  <span>{m["account.apple_account"]()}</span>
                {:else}
                  <span class="capitalize">{provider.provider}</span>
                {/if}
              </div>
            {/each}
            {#if data.authProviders.some((p) => p.provider === "credentials")}
              <div
                class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                {m["account.email_password"]()}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Security Settings -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <KeyIcon class="w-5 h-5" />
        {m["account.security"]()}
      </Card.Title>
      <Card.Description>{m["account.security_description"]()}</Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="space-y-4">
        <span class="text-sm font-medium">{m["account.password"]()}</span>
        <p class="text-xs text-muted-foreground">
          {m["account.password_description"]()}
        </p>

        {#if isChangingPassword}
          <!-- Password Change Form -->
          <form
            method="POST"
            action="?/changePassword"
            use:enhance={() => {
              isSubmittingPassword = true;
              return async ({ update }) => {
                await update();
                isSubmittingPassword = false;
              };
            }}
            class="space-y-4"
          >
            <div class="mt-5 space-y-2">
              <div class="space-y-2">
                <Label for="currentPassword">{m["account.current_password"]()}</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  bind:value={currentPassword}
                  placeholder={m["account.enter_current_password"]()}
                  required
                  disabled={data.isDemoMode}
                />
              </div>
              <div class="mt-4 space-y-2">
                <Label for="newPassword">{m["account.new_password"]()}</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  bind:value={newPassword}
                  placeholder={m["account.enter_new_password"]()}
                  required
                  minlength={8}
                  disabled={data.isDemoMode}
                />
              </div>
              <div class="mt-4 space-y-2">
                <Label for="confirmPassword">{m["account.confirm_password"]()}</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  bind:value={confirmPassword}
                  placeholder={m["account.confirm_new_password"]()}
                  required
                  disabled={data.isDemoMode}
                />
              </div>
            </div>

            <div class="flex gap-2">
              <Button
                type="submit"
                disabled={isSubmittingPassword || data.isDemoMode}
                class="cursor-pointer flex items-center gap-2"
              >
                <SaveIcon class="w-4 h-4" />
                {isSubmittingPassword
                  ? m["account.changing"]()
                  : data.isDemoMode
                    ? "Change Password"
                    : m["account.change_password"]()}
              </Button>
              <Button
                type="button"
                variant="outline"
                onclick={cancelPasswordChange}
                disabled={isSubmittingPassword}
                class="cursor-pointer"
              >
                {m["account.cancel"]()}
              </Button>
            </div>
          </form>
        {:else}
          <!-- Change Password Button -->
          <Button
            variant="outline"
            onclick={() => (isChangingPassword = true)}
            disabled={data.isDemoMode}
            class="cursor-pointer flex items-center gap-2"
          >
            <KeyIcon class="w-4 h-4" />
            {m["account.change_password"]()}
          </Button>
          {#if data.isDemoMode}
            <p class="text-xs text-muted-foreground">
              Password changes are disabled in demo mode.
            </p>
          {/if}
        {/if}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Danger Zone -->
  <Card.Root class="shadow-none border-destructive">
    <Card.Header>
      <Card.Title class="text-destructive flex items-center gap-2">
        <AlertTriangleIcon class="w-5 h-5" />
        {m["account.danger_zone"]()}
      </Card.Title>
      <Card.Description>
        {m["account.danger_zone_description"]()}
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="space-y-2">
        <span class="text-sm font-medium">{m["auth.delete_account"]()}</span>
        <p class="text-xs text-muted-foreground">
          {m["auth.delete_account_description"]()}
        </p>
        <Button
          variant="destructive"
          onclick={openDeleteDialog}
          disabled={data.isDemoMode}
          class="cursor-pointer w-full sm:w-auto flex items-center gap-2"
        >
          <TrashIcon class="w-4 h-4" />
          {m["auth.delete_account"]()}
        </Button>
        {#if data.isDemoMode}
          <p class="text-xs text-muted-foreground">
            Account deletion is disabled in demo mode.
          </p>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root open={showDeleteDialog}>
  <AlertDialog.Content class="z-[100] max-w-md">
    <form
      method="POST"
      action="?/deleteAccount"
      use:enhance={() => {
        isDeletingAccount = true;
        return async ({ result, update }) => {
          if (result.type === "success") {
            // Account deletion successful, redirect to login page
            const redirectUrl = (result.data as any)?.redirect;
            if (redirectUrl) {
              window.location.href = redirectUrl;
            } else {
              window.location.href = "/login";
            }
          } else {
            // Update the form to show any errors
            await update();
            isDeletingAccount = false;
          }
        };
      }}
    >
      <AlertDialog.Header>
        <AlertDialog.Title class="text-destructive flex items-center gap-2">
          <AlertTriangleIcon class="w-5 h-5" />
          {m["auth.delete_account_confirm"]()}
        </AlertDialog.Title>
        <AlertDialog.Description>
          <div class="space-y-4">
            <!-- Warning Section -->
            <p>{m["auth.delete_account_description"]()}</p>
            <div
              class="bg-destructive/10 border border-destructive/20 rounded-md p-3"
            >
              <p class="text-sm text-destructive font-medium">
                {m["auth.delete_account_final_warning"]()}
              </p>
            </div>

            <!-- Confirmation Section -->
            <p class="text-sm text-muted-foreground">
              {m["auth.delete_account_type_delete"]()}
            </p>

            <div class="space-y-2">
              <Input
                id="confirmText"
                name="confirmText"
                bind:value={confirmText}
                placeholder="DELETE"
                class="font-mono"
                required
                disabled={data.isDemoMode}
              />
            </div>

            <div class="space-y-2">
              <Label for="deletePassword" class="text-sm font-medium">
                {m["auth.delete_account_enter_password"]()}
              </Label>
              <Input
                id="deletePassword"
                name="password"
                type="password"
                bind:value={deletePassword}
                placeholder={m["account.oauth_password_placeholder"]()}
                disabled={data.isDemoMode}
              />
            </div>
          </div>
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer class="flex gap-2 mt-5">
        <Button
          type="button"
          variant="outline"
          onclick={closeDeleteDialog}
          disabled={isDeletingAccount}
          class="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={isDeletingAccount ||
            confirmText !== "DELETE" ||
            data.isDemoMode}
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {isDeletingAccount
            ? m["auth.delete_account_processing"]()
            : data.isDemoMode
              ? "Demo Mode - Read Only"
              : m["auth.delete_account"]()}
        </Button>
      </AlertDialog.Footer>
    </form>

    <!-- Error Message (positioned at bottom of dialog) -->
    {#if form?.error && showDeleteDialog}
      <div
        class="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md mt-4"
      >
        {form.error}
      </div>
    {/if}
  </AlertDialog.Content>
</AlertDialog.Root>

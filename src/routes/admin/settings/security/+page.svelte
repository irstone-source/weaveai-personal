<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { enhance } from "$app/forms";

  // Import icons
  import { ShieldIcon, EyeIcon, EyeOffIcon } from "$lib/icons/index.js";

  let { form, data } = $props();

  // Form state
  let isSubmitting = $state(false);
  let showSecretKey = $state(false);

  // Reactive form values - initialize with current settings or form data
  let turnstileEnabled = $state(
    form?.turnstileEnabled ?? data?.settings?.turnstileEnabled ?? false
  );
  let turnstileSiteKey = $state(
    form?.turnstileSiteKey || data?.settings?.turnstileSiteKey || ""
  );
  let turnstileSecretKey = $state(
    form?.turnstileSecretKey || data?.settings?.turnstileSecretKey || ""
  );

  // Derived state to check if keys are present in saved database state (not form inputs)
  let hasKeys = $derived(
    (data?.settings?.turnstileSiteKey?.trim() || "").length > 0 &&
      (data?.settings?.turnstileSecretKey?.trim() || "").length > 0
  );

  // Effect to auto-disable when saved keys are removed from database
  $effect(() => {
    if (!hasKeys) {
      // Auto-disable when keys are removed from database
      turnstileEnabled = false;
    }
  });

  // State sync effect
  $effect(() => {
    // Update reactive state when data changes (e.g., on page refresh or form reset)
    if (data?.settings && !form) {
      turnstileEnabled = data.settings.turnstileEnabled ?? false;
      turnstileSiteKey = data.settings.turnstileSiteKey || "";
      turnstileSecretKey = data.settings.turnstileSecretKey || "";
    }
  });

  // Success message state
  let showSuccessMessage = $state(false);

  // Show success message when form is successfully submitted
  $effect(() => {
    if (form?.success) {
      showSuccessMessage = true;
      // Hide success message after 3 seconds
      setTimeout(() => {
        showSuccessMessage = false;
      }, 3000);
    }
  });
</script>

<svelte:head>
  <title>Security Settings - Admin Dashboard</title>
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
  <div>
    <h1 class="text-xl font-semibold tracking-tight flex items-center gap-2">
      <ShieldIcon class="w-6 h-6" />
      Security Settings
    </h1>
    <p class="text-muted-foreground">
      Configure Cloudflare Turnstile and other security features.
    </p>
  </div>

  <!-- Success Message -->
  {#if showSuccessMessage}
    <div
      class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md"
    >
      Security settings have been saved successfully!
    </div>
  {/if}

  <!-- Security Settings Form -->
  <form
    method="POST"
    action="?/update"
    use:enhance={() => {
      isSubmitting = true;
      return async ({ update }) => {
        await update();
        isSubmitting = false;
      };
    }}
  >
    <Card.Root>
      <Card.Header>
        <Card.Title>Cloudflare Turnstile</Card.Title>
        <Card.Description>
          Configure bot protection for registration and other forms using
          Cloudflare Turnstile.
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Enable Turnstile Toggle -->
        <div class="flex items-center space-x-3">
          <Switch
            bind:checked={turnstileEnabled}
            disabled={!hasKeys || data.isDemoMode}
          />
          <div class="space-y-1">
            <Label for="turnstileEnabled" class="text-base font-medium">
              Enable Turnstile Protection
              {#if !hasKeys}
                <span class="text-xs text-muted-foreground"
                  >(Requires Site Key and Secret Key)</span
                >
              {/if}
            </Label>
            <p class="text-sm text-muted-foreground">
              {#if hasKeys}
                Enable or disable Cloudflare Turnstile CAPTCHA protection on
                registration and other forms
              {:else}
                Configure Site Key and Secret Key below to enable Turnstile
                protection
              {/if}
            </p>
          </div>
        </div>

        <!-- Hidden input for the switch value -->
        <input
          type="hidden"
          name="turnstileEnabled"
          bind:value={turnstileEnabled}
        />

        <!-- Turnstile Configuration (always visible) -->
        <div class="grid gap-4 md:grid-cols-1">
          <!-- Site Key -->
          <div class="space-y-2">
            <Label for="turnstileSiteKey">Site Key (Public)</Label>
            <Input
              id="turnstileSiteKey"
              name="turnstileSiteKey"
              type="text"
              bind:value={turnstileSiteKey}
              placeholder="1x00000000000000000000AA (for testing)"
              disabled={isSubmitting || data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              Your Cloudflare Turnstile site key. This is safe to expose
              publicly.
            </p>
          </div>

          <!-- Secret Key -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="turnstileSecretKey">Secret Key (Private)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (showSecretKey = !showSecretKey)}
                class="h-auto p-1"
                disabled={data.isDemoMode}
              >
                {#if showSecretKey}
                  <EyeOffIcon class="w-4 h-4" />
                {:else}
                  <EyeIcon class="w-4 h-4" />
                {/if}
              </Button>
            </div>
            <Input
              id="turnstileSecretKey"
              name="turnstileSecretKey"
              type={showSecretKey ? "text" : "password"}
              bind:value={turnstileSecretKey}
              placeholder="1x0000000000000000000000000000000AA (for testing)"
              disabled={isSubmitting || data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              Your Cloudflare Turnstile secret key. This will be encrypted and
              stored securely.
            </p>
          </div>

          <!-- Documentation Link -->
          <div class="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p class="text-sm text-blue-700">
              <strong>Need help?</strong> Get your Turnstile keys from the
              <a
                href="https://dash.cloudflare.com/sign-up/turnstile"
                target="_blank"
                class="underline hover:no-underline"
              >
                Cloudflare Dashboard
              </a>
              or use the dummy keys above for testing.
            </p>
          </div>
        </div>

        <!-- Form Error -->
        {#if form?.error}
          <div
            class="text-sm text-destructive bg-red-50 border border-red-200 rounded-md p-3"
          >
            {form.error}
          </div>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Save Button positioned outside the card -->
    <div class="mt-5 space-y-2">
      <div class="flex justify-end">
        <Button type="submit" disabled={isSubmitting || data.isDemoMode}>
          {isSubmitting
            ? "Saving..."
            : data.isDemoMode
              ? "Demo Mode - Read Only"
              : "Save Security Settings"}
        </Button>
      </div>
      {#if data.isDemoMode}
        <p class="text-xs text-muted-foreground text-right">
          Saving is disabled in demo mode. This is a read-only demonstration.
        </p>
      {/if}
    </div>
  </form>
</div>

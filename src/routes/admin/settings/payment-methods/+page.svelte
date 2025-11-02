<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { enhance } from "$app/forms";

  // Import icons
  import {
    CreditCardIcon,
    CheckCircleIcon,
    EyeIcon,
    EyeOffIcon,
  } from "$lib/icons/index.js";

  let { form, data } = $props();

  // Form state
  let isSubmitting = $state(false);
  let showSecretKey = $state(false);
  let showWebhookSecret = $state(false);
  let showInstructions = $state(false);
  let copiedWebhookUrl = $state(false);

  // Environment options
  const environmentOptions = [
    { value: "test", label: "Test Mode" },
    { value: "live", label: "Live Mode" },
  ];

  // Reactive form values - initialize with current settings or form data
  let selectedEnvironment = $state(
    form?.environment || data?.settings?.environment || "test"
  );
  let stripePublishableKey = $state(
    form?.stripePublishableKey || data?.settings?.stripePublishableKey || ""
  );
  let stripeSecretKey = $state(
    form?.stripeSecretKey || data?.settings?.stripeSecretKey || ""
  );
  let stripeWebhookSecret = $state(
    form?.stripeWebhookSecret || data?.settings?.stripeWebhookSecret || ""
  );

  const environmentLabel = $derived(
    environmentOptions.find((env) => env.value === selectedEnvironment)
      ?.label ?? "Test Mode"
  );

  // State sync effect
  $effect(() => {
    // Update reactive state when data changes (e.g., on page refresh or form reset)
    if (data?.settings && !form) {
      selectedEnvironment = data.settings.environment || "test";
      stripePublishableKey = data.settings.stripePublishableKey || "";
      stripeSecretKey = data.settings.stripeSecretKey || "";
      stripeWebhookSecret = data.settings.stripeWebhookSecret || "";
    }
  });

  // Function to mask sensitive keys
  function maskKey(key: string) {
    if (!key || key.length < 8) return key;
    return key.substring(0, 8) + "•".repeat(key.length - 8);
  }

  // Function to check if Stripe is configured
  function isStripeConfigured() {
    return (
      data?.settings?.stripePublishableKey && data?.settings?.stripeSecretKey
    );
  }

  // Get webhook URL for current domain
  function getWebhookUrl() {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/stripe/webhook`;
    }
    return "https://yourdomain.com/api/stripe/webhook";
  }

  // Copy webhook URL to clipboard
  async function copyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(getWebhookUrl());
      copiedWebhookUrl = true;
      setTimeout(() => {
        copiedWebhookUrl = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }
</script>

<svelte:head>
  <title>Payment Methods - Admin Settings</title>
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
      <CreditCardIcon class="w-6 h-6" />
      Payment Methods
    </h1>
    <p class="text-muted-foreground">
      Configure Stripe integration and payment processing settings.
    </p>
  </div>

  <!-- Setup Instructions Card -->
  <Card.Root
    class="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30"
  >
    <Card.Header>
      <div class="flex items-center justify-between">
        <div>
          <Card.Title class="flex items-center gap-2">
            <svg
              class="w-5 h-5 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            Setup Instructions
          </Card.Title>
          <Card.Description>
            Step-by-step guide to configure Stripe integration
          </Card.Description>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onclick={() => (showInstructions = !showInstructions)}
        >
          {showInstructions ? "Hide" : "Show"} Instructions
          <svg
            class="w-4 h-4 ml-1 transition-transform"
            class:rotate-180={showInstructions}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </Button>
      </div>
    </Card.Header>

    {#if showInstructions}
      <Card.Content class="space-y-6">
        <!-- Section 1: Getting API Keys -->
        <div class="space-y-4">
          <h3 class="font-semibold text-base flex items-center gap-2">
            <span
              class="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm"
              >1</span
            >
            Getting Your Stripe API Keys
          </h3>
          <div class="pl-8 space-y-3 text-sm">
            <div class="flex items-start gap-2">
              <span
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium mt-0.5"
                >1</span
              >
              <p>
                Log in to your <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noopener"
                  class="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  Stripe Dashboard
                  <svg
                    class="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    ></path>
                  </svg>
                </a>
              </p>
            </div>
            <div class="flex items-start gap-2">
              <span
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium mt-0.5"
                >2</span
              >
              <p>
                Navigate to <strong>Developers</strong> →
                <strong>API keys</strong> in the left sidebar
              </p>
            </div>
            <div class="flex items-start gap-2">
              <span
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium mt-0.5"
                >3</span
              >
              <div class="flex-1">
                <p class="mb-2">Copy your keys based on your environment:</p>
                <div
                  class="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-md p-3 space-y-2"
                >
                  <div>
                    <p
                      class="font-medium text-xs text-gray-600 dark:text-gray-400 mb-1"
                    >
                      Test Mode (Development):
                    </p>
                    <ul
                      class="list-disc list-inside text-xs text-gray-700 dark:text-gray-300 space-y-1 ml-2"
                    >
                      <li>
                        <strong>Publishable key:</strong> Starts with
                        <code
                          class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                          >pk_test_</code
                        >
                      </li>
                      <li>
                        <strong>Secret key:</strong> Starts with
                        <code
                          class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                          >sk_test_</code
                        >
                      </li>
                    </ul>
                  </div>
                  <div class="pt-2 border-t dark:border-gray-700">
                    <p
                      class="font-medium text-xs text-gray-600 dark:text-gray-400 mb-1"
                    >
                      Live Mode (Production):
                    </p>
                    <ul
                      class="list-disc list-inside text-xs text-gray-700 dark:text-gray-300 space-y-1 ml-2"
                    >
                      <li>
                        <strong>Publishable key:</strong> Starts with
                        <code
                          class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                          >pk_live_</code
                        >
                      </li>
                      <li>
                        <strong>Secret key:</strong> Starts with
                        <code
                          class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                          >sk_live_</code
                        >
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Setting Up Webhook -->
        <div class="space-y-4 pt-4 border-t">
          <h3 class="font-semibold text-base flex items-center gap-2">
            <span
              class="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm"
              >2</span
            >
            Setting Up Webhook Secret
          </h3>
          <div class="pl-8 space-y-3 text-sm">
            <div class="flex items-start gap-2">
              <span
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium mt-0.5"
                >1</span
              >
              <p>
                In the Stripe Dashboard, go to <strong>Developers</strong> →
                <strong>Webhooks</strong>
              </p>
            </div>
            <div class="flex items-start gap-2">
              <span
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium mt-0.5"
                >2</span
              >
              <p>
                Click <strong>"Add endpoint"</strong> or
                <strong>"+ Add an endpoint"</strong>
              </p>
            </div>
            <div class="flex items-start gap-2">
              <span
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium mt-0.5"
                >3</span
              >
              <div class="flex-1">
                <p class="mb-2">Enter your webhook endpoint URL:</p>
                <div class="flex items-center gap-2">
                  <code
                    class="flex-1 bg-gray-900 dark:bg-gray-800 text-gray-100 dark:text-gray-200 px-3 py-2 rounded font-mono text-xs overflow-x-auto"
                  >
                    {getWebhookUrl()}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onclick={copyWebhookUrl}
                    class="flex-shrink-0"
                  >
                    {#if copiedWebhookUrl}
                      <CheckCircleIcon class="w-4 h-4 text-green-600" />
                    {:else}
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        ></path>
                      </svg>
                    {/if}
                  </Button>
                </div>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <span
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium mt-0.5"
                >4</span
              >
              <div class="flex-1">
                <p class="mb-2">
                  Select events to listen to. <strong>Required events:</strong>
                </p>
                <div
                  class="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-md p-3"
                >
                  <ul
                    class="list-disc list-inside text-xs text-gray-700 dark:text-gray-300 space-y-1"
                  >
                    <li>
                      <code
                        class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                        >checkout.session.completed</code
                      >
                    </li>
                    <li>
                      <code
                        class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                        >customer.subscription.created</code
                      >
                    </li>
                    <li>
                      <code
                        class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                        >customer.subscription.updated</code
                      >
                    </li>
                    <li>
                      <code
                        class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                        >customer.subscription.deleted</code
                      >
                    </li>
                    <li>
                      <code
                        class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                        >invoice.payment_succeeded</code
                      >
                    </li>
                    <li>
                      <code
                        class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                        >invoice.payment_failed</code
                      >
                    </li>
                  </ul>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <em
                      >Tip: You can also select "Send all events" for
                      comprehensive tracking</em
                    >
                  </p>
                </div>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <span
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium mt-0.5"
                >5</span
              >
              <p>Click <strong>"Add endpoint"</strong> to save</p>
            </div>
            <div class="flex items-start gap-2">
              <span
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium mt-0.5"
                >6</span
              >
              <div class="flex-1">
                <p>
                  After creation, click on the webhook endpoint to view details,
                  then click <strong>"Reveal"</strong> next to
                  <strong>"Signing secret"</strong>
                </p>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  The signing secret starts with <code
                    class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded"
                    >whsec_</code
                  >
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card.Content>
    {/if}
  </Card.Root>

  <!-- Form -->
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
    class="space-y-6"
  >
    <!-- Error Message -->
    {#if form?.error}
      <div
        class="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md"
      >
        {form.error}
      </div>
    {/if}

    <!-- Success Message -->
    {#if form?.success}
      <div
        class="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md"
      >
        Payment settings updated successfully!
      </div>
    {/if}

    <!-- Stripe Configuration -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <CreditCardIcon class="w-5 h-5" />
          Stripe Configuration
        </Card.Title>
        <Card.Description
          >Configure your Stripe API keys for payment processing</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-4">
        <!-- Environment Selection -->
        <div class="space-y-2">
          <Label for="environment">Environment</Label>
          <Select.Root
            type="single"
            name="environment"
            bind:value={selectedEnvironment}
            disabled={data.isDemoMode}
          >
            <Select.Trigger>
              {environmentLabel}
            </Select.Trigger>
            <Select.Content>
              {#each environmentOptions as option}
                <Select.Item value={option.value} label={option.label}>
                  {option.label}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <p class="text-xs text-muted-foreground">
            {selectedEnvironment === "test"
              ? "Use test keys for development and testing"
              : "Use live keys for production"}
          </p>
        </div>

        <!-- API Keys -->
        <div class="grid grid-cols-1 gap-4">
          <div class="space-y-2">
            <Label for="stripePublishableKey">Stripe Publishable Key</Label>
            <Input
              id="stripePublishableKey"
              name="stripePublishableKey"
              type="text"
              placeholder={selectedEnvironment === "test"
                ? "pk_test_..."
                : "pk_live_..."}
              bind:value={stripePublishableKey}
              class="font-mono"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              Used in the frontend for creating payment elements (safe to expose
              publicly)
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="stripeSecretKey">Stripe Secret Key</Label>
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
              id="stripeSecretKey"
              name="stripeSecretKey"
              type={showSecretKey ? "text" : "password"}
              placeholder={selectedEnvironment === "test"
                ? "sk_test_..."
                : "sk_live_..."}
              bind:value={stripeSecretKey}
              class="font-mono"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              Used on the server for API calls
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="stripeWebhookSecret">Stripe Webhook Secret</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (showWebhookSecret = !showWebhookSecret)}
                class="h-auto p-1"
                disabled={data.isDemoMode}
              >
                {#if showWebhookSecret}
                  <EyeOffIcon class="w-4 h-4" />
                {:else}
                  <EyeIcon class="w-4 h-4" />
                {/if}
              </Button>
            </div>
            <Input
              id="stripeWebhookSecret"
              name="stripeWebhookSecret"
              type={showWebhookSecret ? "text" : "password"}
              placeholder="whsec_..."
              bind:value={stripeWebhookSecret}
              class="font-mono"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              Used to verify webhook events from Stripe
            </p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Submit Button -->
    <div class="space-y-2">
      <div class="flex justify-end">
        <Button type="submit" disabled={isSubmitting || data.isDemoMode}>
          {isSubmitting
            ? "Saving..."
            : data.isDemoMode
              ? "Demo Mode - Read Only"
              : "Save Payment Settings"}
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

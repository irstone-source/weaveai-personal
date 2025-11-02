<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";

  // Get page data with stripe publishable key
  let { data } = $props();

  // Import icons
  import { ArrowLeftIcon, LoaderIcon } from "$lib/icons/index.js";

  let clientSecret = $state("");
  let planName = $state("");
  let stripe: any = $state(null);
  let checkout: any = $state(null);
  let loading = $state(true);
  let error = $state("");
  
  // Non-reactive flag to track initialization status
  let initializing = false;
  let initialized = false;

  // Get URL parameters
  $effect(() => {
    const params = $page.url.searchParams;
    clientSecret = params.get("client_secret") || "";
    planName = params.get("plan") || "";

    if (!clientSecret) {
      error = "No checkout session found";
      loading = false;
    }
  });

  // Initialize Stripe when we have a client secret and the component is mounted
  $effect(() => {
    // Only initialize if we have a client secret and haven't initialized yet
    if (!clientSecret || initializing || initialized) {
      return;
    }

    console.log('Initializing Stripe checkout with client secret');
    initializeStripe();

    // Cleanup function - only runs when component unmounts
    return () => {
      if (checkout) {
        console.log('Component unmounting - cleaning up Stripe checkout instance');
        try {
          checkout.destroy();
        } catch (error) {
          console.error('Error destroying checkout during cleanup:', error);
        }
      }
      // Reset flags for potential remount
      initializing = false;
      initialized = false;
    };
  });

  async function initializeStripe() {
    if (initializing || initialized) {
      return;
    }
    
    initializing = true;
    
    try {
      // Dynamically import Stripe
      const { loadStripe } = await import("@stripe/stripe-js");

      if (!data?.stripePublishableKey) {
        throw new Error("Stripe publishable key not configured");
      }

      stripe = await loadStripe(data.stripePublishableKey);

      if (!stripe) {
        throw new Error("Failed to load Stripe");
      }

      // Initialize embedded checkout
      checkout = await stripe.initEmbeddedCheckout({
        clientSecret,
      });

      // Set loading to false first to render the container
      loading = false;

      // Wait for the next tick to ensure DOM is updated
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check if container exists before mounting
      const container = document.getElementById("checkout-container");
      if (!container) {
        throw new Error("Checkout container not found");
      }

      // Mount the checkout form
      checkout.mount("#checkout-container");
      
      // Mark as successfully initialized
      initialized = true;
      console.log('Stripe checkout successfully initialized');
      
    } catch (err) {
      console.error("Error initializing checkout:", err);
      
      // Clean up any partial state on error
      if (checkout) {
        try {
          checkout.destroy();
        } catch (cleanupError) {
          console.error("Error during cleanup after initialization failure:", cleanupError);
        }
        checkout = null;
      }
      
      error = "Failed to load checkout form";
      loading = false;
    } finally {
      initializing = false;
    }
  }

  // Handle back to pricing
  function handleBack() {
    // Clean up checkout instance before navigating away
    if (checkout) {
      console.log('Cleaning up checkout before navigation');
      try {
        checkout.destroy();
      } catch (error) {
        console.error('Error cleaning up checkout before navigation:', error);
      }
      checkout = null;
    }
    
    // Reset initialization flags and state
    initializing = false;
    initialized = false;
    error = "";
    loading = true;
    
    goto("/pricing");
  }

  // Handle checkout completion (this will be handled by URL redirect)
  $effect(() => {
    // Check if we're returning from a completed checkout
    const sessionId = $page.url.searchParams.get("session_id");
    if (sessionId) {
      // Clean up checkout instance before redirecting to success page
      if (checkout) {
        console.log('Payment completed - cleaning up checkout before redirect to billing');
        try {
          checkout.destroy();
        } catch (error) {
          console.error('Error cleaning up checkout before billing redirect:', error);
        }
        checkout = null;
      }
      
      // Reset initialization flags (but preserve success state)
      initializing = false;
      initialized = false;
      
      // Redirect to billing with success message
      goto(`/settings/billing?session_id=${sessionId}`);
    }
  });

</script>

<svelte:head>
  <title>Checkout - Subscribe to {planName}</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-2xl">
  <!-- Header -->
  <div class="mb-3">
    <Button variant="ghost" onclick={handleBack} class="mb-4">
      <ArrowLeftIcon class="w-4 h-4" />
      Back to Pricing
    </Button>

    {#if planName}
      <p class="text-muted-foreground">
        You're subscribing to the <strong>{planName}</strong> plan
      </p>
    {/if}
  </div>

  <!-- Checkout Container -->
  <Card.Root class="shadow-lg rounded-none p-1">
    <Card.Content class="p-1">
      {#if loading}
        <div class="flex items-center justify-center py-12">
          <div class="text-center space-y-4">
            <LoaderIcon
              class="w-8 h-8 animate-spin mx-auto text-muted-foreground"
            />
            <p class="text-muted-foreground">Loading secure checkout...</p>
          </div>
        </div>
      {:else if error}
        <div class="text-center py-12 space-y-4">
          <div
            class="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto"
          >
            <span class="text-destructive text-xl">✕</span>
          </div>
          <h3 class="text-lg font-semibold">Checkout Error</h3>
          <p class="text-muted-foreground">{error}</p>
          <Button onclick={handleBack}>Return to Pricing</Button>
        </div>
      {:else}
        <!-- Stripe Embedded Checkout will be mounted here -->
        <div id="checkout-container"></div>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Security Notice -->
  <div class="mt-5 text-center">
    <p class="text-sm text-muted-foreground">
      🔒 Secure checkout powered by Stripe. Your payment information is
      encrypted and protected.
    </p>
  </div>
</div>

<style>
  /* Ensure Stripe checkout form fits properly */
  :global(#checkout-container) {
    min-height: 400px;
  }
</style>

<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";

  // Import icons
  import {
    CheckIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
  } from "$lib/icons/index.js";

  let { data } = $props();

  const allPlans = data.plans || [];
  const currentSubscription = data.currentSubscription;
  const user = data.user;
  const userData = data.userData;

  // Billing interval toggle state
  let isYearly = $state(false);

  // Filtered plans based on billing interval
  const plans = $derived(
    allPlans.filter(
      (plan) => plan.billingInterval === (isYearly ? "year" : "month")
    )
  );

  // Separate free plan (always monthly) and paid plans
  const freePlan = $derived(allPlans.find((plan) => plan.tier === "free"));

  const paidPlans = $derived(plans.filter((plan) => plan.tier !== "free"));

  // Loading state for checkout
  let loadingPlan: string | null = $state(null);

  // Confirmation dialog state
  let showConfirmDialog = $state(false);
  let pendingAction = $state<{
    priceId: string;
    planName: string;
    changeType: string;
    isUpgrade: boolean;
  } | null>(null);

  function isCurrentPlan(planTier: string): boolean {
    // For free tier, check user's planTier directly
    if (planTier === "free") {
      return userData?.planTier === "free";
    }
    // For paid tiers, check subscription
    return currentSubscription?.plan?.tier === planTier;
  }

  function isDowngrade(planTier: string): boolean {
    const tierOrder = { free: 0, starter: 1, pro: 2, advanced: 3 };

    // Get current user's tier
    let currentTier = "free"; // default to free
    if (userData?.planTier === "free") {
      currentTier = "free";
    } else if (currentSubscription?.plan?.tier) {
      currentTier = currentSubscription.plan.tier;
    }

    const currentTierOrder =
      tierOrder[currentTier as keyof typeof tierOrder] || 0;
    const planTierOrder = tierOrder[planTier as keyof typeof tierOrder] || 0;

    return planTierOrder < currentTierOrder;
  }

  function formatLimit(limit: number | null): string {
    if (limit === null) return "Unlimited";
    if (limit === 0) return "Not included";
    return limit.toLocaleString();
  }

  async function handleSubscribe(priceId: string, planName: string) {
    if (!user) {
      toast.error("Please log in to subscribe");
      goto("/login");
      return;
    }

    if (
      isCurrentPlan(plans.find((p) => p.stripePriceId === priceId)?.tier || "")
    ) {
      toast.info("You are already subscribed to this plan");
      return;
    }

    loadingPlan = priceId;

    try {
      // First, check if user has an existing subscription and try to update it
      if (currentSubscription) {
        // Show confirmation dialog for subscription changes
        const isUpgrade = !isDowngrade(
          plans.find((p) => p.stripePriceId === priceId)?.tier || ""
        );
        const changeType = isUpgrade ? "upgrade" : "downgrade";

        // Set up pending action and show confirmation dialog
        pendingAction = {
          priceId,
          planName,
          changeType,
          isUpgrade,
        };
        showConfirmDialog = true;

        // Exit early - the actual API call will happen in the confirm handler
        loadingPlan = null;
        return;
      }

      // For new subscribers, create checkout session directly
      await createCheckoutSession(priceId, planName);
    } catch (error) {
      console.error("Error processing subscription:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to process subscription change"
      );
    } finally {
      loadingPlan = null;
    }
  }

  function getButtonText(plan: any): string {
    if (isCurrentPlan(plan.tier)) return "Current Plan";
    if (isDowngrade(plan.tier)) return "Downgrade";
    if (!currentSubscription) return "Get Started";
    return "Upgrade";
  }

  function getButtonVariant(
    plan: any
  ): "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" {
    if (isCurrentPlan(plan.tier)) return "secondary";
    if (plan.tier === "pro") return "default";
    return "outline";
  }

  // Dialog confirmation handlers
  function handleConfirmUpgrade() {
    if (!pendingAction) return;

    showConfirmDialog = false;
    // Continue with the subscription update using the pending action data
    proceedWithSubscriptionUpdate(pendingAction);
  }

  function handleCancelUpgrade() {
    showConfirmDialog = false;
    pendingAction = null;
    loadingPlan = null;
  }

  async function proceedWithSubscriptionUpdate(action: typeof pendingAction) {
    if (!action) return;

    loadingPlan = action.priceId;

    try {
      // Try to update existing subscription
      const updateResponse = await fetch("/api/stripe/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId: action.priceId }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.message || "Failed to update subscription");
      }

      const updateResult = await updateResponse.json();

      if (updateResult.success) {
        // Show proration info if available
        if (
          updateResult.subscription?.proration_amount &&
          updateResult.subscription.proration_amount > 0
        ) {
          const prorationFormatted = (
            updateResult.subscription.proration_amount / 100
          ).toFixed(2);
          toast.info(
            `A proration charge of $${prorationFormatted} has been applied.`
          );
        }

        // Redirect to billing page with success parameters and expected price ID
        const successUrl = new URL("/settings/billing", window.location.origin);
        successUrl.searchParams.set("subscription_updated", "true");
        successUrl.searchParams.set("plan_name", action.planName);
        successUrl.searchParams.set("change_type", action.changeType);
        successUrl.searchParams.set("expected_price_id", action.priceId);

        goto(successUrl.pathname + successUrl.search);
        return;
      } else if (updateResult.requiresCheckout) {
        // Fall through to checkout flow for new subscriptions
        console.log("No existing subscription found, using checkout flow");
        // This shouldn't happen in the confirmation flow, but handle it anyway
        createCheckoutSession(action.priceId, action.planName);
        return;
      } else {
        // Redirect to billing page with error parameters
        const errorUrl = new URL("/settings/billing", window.location.origin);
        errorUrl.searchParams.set("subscription_error", "true");
        errorUrl.searchParams.set(
          "error_message",
          encodeURIComponent(
            updateResult.message || "Failed to update subscription"
          )
        );

        goto(errorUrl.pathname + errorUrl.search);
        return;
      }
    } catch (error) {
      console.error("Error processing subscription:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to process subscription change"
      );
    } finally {
      loadingPlan = null;
      pendingAction = null;
    }
  }

  async function createCheckoutSession(priceId: string, planName: string) {
    try {
      // Create new checkout session for new subscribers or if update failed
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { clientSecret } = await response.json();

      // Redirect to checkout page with client secret
      goto(
        `/checkout?client_secret=${clientSecret}&plan=${encodeURIComponent(planName)}`
      );
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast.error("Failed to start checkout process");
    }
  }
</script>

<svelte:head>
  <title>Pricing Plans - AI Models Platform</title>
  <meta
    name="description"
    content="Choose the perfect plan for your AI needs. Access 65+ text, image, video generation models."
  />
</svelte:head>

<div class="container mx-auto p-2 max-w-7xl">
  <!-- Back Button -->
  <div class="my-5">
    <Button
      variant="ghost"
      size="sm"
      class="cursor-pointer p-2 hover:bg-accent rounded-md"
      onclick={() => goto("/")}
    >
      <ArrowLeftIcon class="w-5 h-5" />
      Go back
    </Button>
  </div>

  <!-- Header -->
  <div class="text-center mb-5">
    <h1 class="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
  </div>

  <!-- Billing Toggle -->
  <div class="flex flex-col items-center mb-5">
    <Badge
      class="mb-5 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 py-1 text-sm font-semibold animate-pulse"
    >
      💰 Save 20% with a Yearly plan
    </Badge>
    <div
      class="bg-white/80 dark:bg-black/40 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-xl p-1 inline-flex items-center gap-2 shadow-sm"
    >
      <span
        class={`cursor-default px-4 py-3 text-sm font-semibold transition-all duration-300 rounded-lg ${
          !isYearly
            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Monthly
      </span>
      <Switch
        bind:checked={isYearly}
        class="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-green-500 data-[state=checked]:to-emerald-500 cursor-pointer mx-2"
      />
      <span
        class={`cursor-default px-4 py-3 text-sm font-semibold transition-all duration-300 rounded-lg ${
          isYearly
            ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Yearly
      </span>
    </div>
  </div>

  <!-- Free Plan Card (Horizontal) -->
  {#if freePlan}
    <div class="flex justify-center mb-6">
      <Card.Root class="max-w-2xl w-full">
        <Card.Content class="px-5">
          <div
            class="flex items-center justify-between gap-4 md:flex-row flex-col"
          >
            <!-- Left: Title, Price -->
            <div class="flex items-center">
              <div>
                <h3 class="text-lg font-semibold mb-0.5">{freePlan.name}</h3>
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl font-semibold">$0</span>
                  <span class="text-sm text-muted-foreground">/forever</span>
                </div>
              </div>
            </div>

            <!-- Center: Features -->
            <div class="flex-1 md:px-4">
              <div class="pricing-free-features">
                {#each freePlan.features.slice(0, 3) as feature}
                  <div class="pricing-free-feature-item">
                    <div
                      class="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                    >
                      <CheckIcon class="w-2 h-2 text-white" />
                    </div>
                    <span>{feature}</span>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Right: CTA Button -->
            <div class="flex-shrink-0">
              <Button
                class="px-4 py-2 text-sm font-medium"
                variant={getButtonVariant(freePlan)}
                disabled={isCurrentPlan(freePlan.tier) ||
                  loadingPlan === freePlan.stripePriceId}
                onclick={() =>
                  handleSubscribe(freePlan.stripePriceId, freePlan.name)}
              >
                {#if loadingPlan === freePlan.stripePriceId}
                  <div
                    class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
                  ></div>
                  Processing...
                {:else}
                  {getButtonText(freePlan)}
                  {#if !isCurrentPlan(freePlan.tier)}
                    <ArrowRightIcon class="w-3 h-3 ml-2" />
                  {/if}
                {/if}
              </Button>

              {#if isCurrentPlan(freePlan.tier)}
                <p class="text-xs text-muted-foreground text-center mt-2">
                  Your current plan
                </p>
              {/if}
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  {/if}

  <!-- Paid Plans Grid -->
  <div class="grid md:grid-cols-3 gap-6 mb-8">
    {#each paidPlans as plan}
      <Card.Root
        class="relative transition-all duration-300 hover:shadow-lg h-full"
      >
        <Card.Content class="p-6 text-center h-full flex flex-col">
          <h3 class="text-xl font-bold mb-4">{plan.name}</h3>

          <div class="mb-6">
            <span class="text-4xl font-bold">
              ${(plan.priceAmount / 100).toFixed(2).replace(/\.00$/, "")}
            </span>
            <span class="text-muted-foreground">/{plan.billingInterval}</span>
            {#if plan.billingInterval === "year"}
              <div class="text-sm text-muted-foreground mt-2">
                ${(plan.priceAmount / 100 / 12)
                  .toFixed(2)
                  .replace(/\.00$/, "")}/month billed annually
              </div>
            {/if}
          </div>

          <!-- Combined Features and Limits List -->
          <ul class="space-y-3 mb-6 flex-grow">
            <!-- Limits as features -->
            <li class="flex items-center text-sm">
              <div
                class="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center mr-3 flex-shrink-0"
              >
                <svg
                  class="w-2 h-2 text-white"
                  fill="currentColor"
                  viewBox="0 0 8 8"
                >
                  <path d="M6.5 1l-3.5 3.5-1.5-1.5-1 1 2.5 2.5 4.5-4.5z" />
                </svg>
              </div>
              {formatLimit(plan.textGenerationLimit)} Text Generation{plan.textGenerationLimit
                ? "/mo"
                : ""}
            </li>
            <li class="flex items-center text-sm">
              <div
                class="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center mr-3 flex-shrink-0"
              >
                <svg
                  class="w-2 h-2 text-white"
                  fill="currentColor"
                  viewBox="0 0 8 8"
                >
                  <path d="M6.5 1l-3.5 3.5-1.5-1.5-1 1 2.5 2.5 4.5-4.5z" />
                </svg>
              </div>
              {formatLimit(plan.imageGenerationLimit)} Image Generation{plan.imageGenerationLimit
                ? "/mo"
                : ""}
            </li>
            <li class="flex items-center text-sm">
              <div
                class="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center mr-3 flex-shrink-0"
              >
                <svg
                  class="w-2 h-2 text-white"
                  fill="currentColor"
                  viewBox="0 0 8 8"
                >
                  <path d="M6.5 1l-3.5 3.5-1.5-1.5-1 1 2.5 2.5 4.5-4.5z" />
                </svg>
              </div>
              {formatLimit(plan.videoGenerationLimit)} Video Generation{plan.videoGenerationLimit
                ? "/mo"
                : ""}
            </li>
            <!-- Additional features -->
            {#each plan.features as feature}
              <li class="flex items-center text-sm">
                <div
                  class="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center mr-3 flex-shrink-0"
                >
                  <svg
                    class="w-2 h-2 text-white"
                    fill="currentColor"
                    viewBox="0 0 8 8"
                  >
                    <path d="M6.5 1l-3.5 3.5-1.5-1.5-1 1 2.5 2.5 4.5-4.5z" />
                  </svg>
                </div>
                {feature}
              </li>
            {/each}
          </ul>

          {#if isDowngrade(plan.tier)}
            <p class="text-xs text-muted-foreground text-center mb-4">
              Downgrade will take effect at the end of your current billing
              period
            </p>
          {/if}

          <Button
            class="cursor-pointer w-full mt-auto"
            variant={getButtonVariant(plan)}
            disabled={isCurrentPlan(plan.tier) ||
              loadingPlan === plan.stripePriceId}
            onclick={() => handleSubscribe(plan.stripePriceId, plan.name)}
          >
            {#if loadingPlan === plan.stripePriceId}
              <div
                class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
              ></div>
              Processing...
            {:else}
              {getButtonText(plan)}
              {#if !isCurrentPlan(plan.tier)}
                <ArrowRightIcon class="w-4 h-4 ml-2" />
              {/if}
            {/if}
          </Button>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>

  <!-- FAQ or Additional Info -->
  <div class="text-center space-y-4">
    <p class="text-muted-foreground">
      All paid plans include access to our complete model library and full chat
      history.
    </p>

    {#if user}
      <p class="text-sm text-muted-foreground">
        Need help choosing? <a
          href="/settings/billing"
          class="text-primary hover:underline">View your current usage</a
        >
      </p>
    {:else}
      <p class="text-sm text-muted-foreground">
        <a href="/login" class="text-primary hover:underline">Sign in</a> to view
        your current usage and get personalized recommendations.
      </p>
    {/if}
  </div>
</div>

<!-- Confirmation Dialog -->
<AlertDialog.Root bind:open={showConfirmDialog}>
  <AlertDialog.Content class="sm:max-w-[425px]">
    <AlertDialog.Header>
      <AlertDialog.Title>
        Confirm Subscription {pendingAction?.changeType || "Change"}
      </AlertDialog.Title>
      <AlertDialog.Description class="text-left space-y-3">
        <p>
          Are you sure you want to <strong>{pendingAction?.changeType}</strong>
          your subscription to <strong>{pendingAction?.planName}</strong>?
        </p>

        {#if pendingAction}
          <div class="p-3 rounded-lg bg-muted/50">
            {#if pendingAction.isUpgrade}
              <div class="flex items-start gap-2">
                <span class="text-green-600 mt-0.5">💳</span>
                <div class="text-sm">
                  <p class="font-medium text-green-700 dark:text-green-400">
                    Upgrade Billing
                  </p>
                  <p class="text-muted-foreground">
                    You will be charged a prorated amount immediately based on
                    your current billing cycle.
                  </p>
                </div>
              </div>
            {:else}
              <div class="flex items-start gap-2">
                <span class="text-blue-600 mt-0.5">💰</span>
                <div class="text-sm">
                  <p class="font-medium text-blue-700 dark:text-blue-400">
                    Downgrade Credit
                  </p>
                  <p class="text-muted-foreground">
                    You will receive a credit for your current plan that will be
                    applied to future bills.
                  </p>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={handleCancelUpgrade}>
        Cancel
      </AlertDialog.Cancel>
      <AlertDialog.Action onclick={handleConfirmUpgrade}>
        Confirm {pendingAction?.changeType || "Change"}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

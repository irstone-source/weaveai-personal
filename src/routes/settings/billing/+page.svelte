<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Pagination from "$lib/components/ui/pagination/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { toast } from "svelte-sonner";
  import { onMount } from "svelte";
  import { replaceState, afterNavigate } from "$app/navigation";
  import { browser } from "$app/environment";
  import * as m from "$lib/../paraglide/messages.js";

  // Import icons
  import {
    CreditCardIcon,
    ExternalLinkIcon,
    UpgradeIcon,
    GemIcon,
    HistoryIcon,
    WalletIcon,
  } from "$lib/icons/index.js";

  let { data } = $props();

  // Reactive state for billing data
  let billingData = $state(data);
  let isRefreshing = $state(false);
  let retryAttempt = $state(0);

  // Payment history pagination state
  let paymentHistoryPage = $state(1);
  let paymentHistoryItemsPerPage = $state(5);

  // Payment history baseline tracking
  let baselinePaymentCount = $state(0);

  // Function to fetch fresh billing data with retry logic
  async function refreshBillingData(
    expectedPriceId?: string,
    expectNewPayment = false,
    maxRetries = 3
  ) {
    try {
      isRefreshing = true;
      retryAttempt = 0;
      let attempt = 0;

      // If we're expecting a new payment, capture current count
      if (expectNewPayment && baselinePaymentCount === 0) {
        baselinePaymentCount = paymentHistory.length;
        console.log(`Baseline payment count set to: ${baselinePaymentCount}`);
      }

      while (attempt < maxRetries) {
        retryAttempt = attempt + 1;
        const response = await fetch("/api/billing");

        if (!response.ok) {
          throw new Error("Failed to fetch billing data");
        }

        const result = await response.json();
        let subscriptionFresh = true;
        let paymentHistoryFresh = true;

        // Check if subscription data is fresh (if expected)
        if (
          expectedPriceId &&
          result.data?.subscription?.subscription?.stripePriceId
        ) {
          const currentPriceId =
            result.data.subscription.subscription.stripePriceId;
          subscriptionFresh = currentPriceId === expectedPriceId;

          if (!subscriptionFresh) {
            console.log(
              `Subscription not yet updated (expected: ${expectedPriceId}, got: ${currentPriceId})`
            );
          }
        }

        // Check if payment history is fresh (if expected)
        if (expectNewPayment && baselinePaymentCount > 0) {
          const newPaymentCount = result.data?.paymentHistory?.length || 0;
          paymentHistoryFresh = newPaymentCount > baselinePaymentCount;

          if (!paymentHistoryFresh) {
            console.log(
              `Payment history not yet updated (baseline: ${baselinePaymentCount}, current: ${newPaymentCount})`
            );
          }
        }

        // If both subscription and payment data are fresh, update and exit
        if (subscriptionFresh && paymentHistoryFresh) {
          billingData = result.data;
          baselinePaymentCount = 0; // Reset baseline
          console.log(
            `Billing data refreshed successfully on attempt ${attempt + 1}`
          );
          return;
        }
        // If this isn't the final attempt, wait and retry
        else if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(1.5, attempt), 8000); // Exponential backoff, max 8s
          console.log(
            `Billing data not yet fresh, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
          continue;
        }
        // Final attempt - update with whatever we got
        else {
          billingData = result.data;
          baselinePaymentCount = 0; // Reset baseline
          break;
        }
      }

      // Show warnings if data wasn't fresh after all retries
      if (expectedPriceId) {
        const finalPriceId =
          billingData?.subscription?.subscription?.stripePriceId;
        if (finalPriceId !== expectedPriceId) {
          console.warn(
            `Subscription not updated after ${maxRetries} attempts. Expected: ${expectedPriceId}, Got: ${finalPriceId}`
          );
        }
      }

      if (expectNewPayment) {
        const finalPaymentCount = billingData?.paymentHistory?.length || 0;
        if (finalPaymentCount <= baselinePaymentCount) {
          console.warn(
            `Payment history not updated after ${maxRetries} attempts. Expected new payment, but count remained ${finalPaymentCount}`
          );
          toast.info(
            m["billing.toast_subscription_updated"]()
          );
        }
      }
    } catch (error) {
      console.error("Error refreshing billing data:", error);
      toast.error(m["billing.toast_refresh_failed"]());
    } finally {
      isRefreshing = false;
      retryAttempt = 0;
      baselinePaymentCount = 0; // Reset baseline on any exit
    }
  }

  // Handle checkout session completion
  async function handleCheckoutSessionComplete(sessionId: string) {
    try {
      console.log("Processing checkout session completion:", sessionId);

      // Fetch session status from the API to verify completion
      const response = await fetch(
        `/api/stripe/session-status?session_id=${sessionId}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch session status");
      }

      const sessionData = await response.json();

      // Check if session was completed successfully
      if (
        sessionData.status === "complete" &&
        sessionData.payment_status === "paid"
      ) {
        // Show success message since this is where users land after checkout
        toast.success(m["billing.toast_subscription_activated"]());
        console.log("Checkout session verified as complete and paid");
      } else if (
        sessionData.status === "complete" &&
        sessionData.payment_status === "unpaid"
      ) {
        // Payment incomplete but session complete - might be processing
        toast.info(
          m["billing.toast_payment_processing"]()
        );
      } else {
        // Session not complete or payment failed
        console.warn("Checkout session not complete:", sessionData);
        toast.warning(
          m["billing.toast_payment_verification"]()
        );
      }
    } catch (error) {
      console.error("Error verifying checkout session:", error);
      // Don't show error toast as this might just be timing - webhooks might still be processing
      toast.info(
        m["billing.toast_verifying_payment"]()
      );
    }
  }

  // Shared function to handle URL parameters
  let hasProcessedUrlParams = $state(false);

  async function processUrlParameters() {
    if (hasProcessedUrlParams || !browser) return;

    const urlParams = new URLSearchParams(window.location.search);
    let shouldRefresh = false;
    let expectedPriceId: string | undefined;
    let expectNewPayment = false;

    // Only process if we have relevant parameters
    if (
      !urlParams.has("subscription_updated") &&
      !urlParams.has("subscription_error") &&
      !urlParams.has("session_id")
    ) {
      return;
    }

    // Handle subscription update results (from subscription changes)
    if (urlParams.get("subscription_updated") === "true") {
      const planName = urlParams.get("plan_name");
      const changeType = urlParams.get("change_type");
      expectedPriceId = urlParams.get("expected_price_id") || undefined;

      toast.success(
        planName && changeType
          ? `Successfully ${changeType}d to ${planName}!`
          : "Subscription updated successfully!"
      );
      shouldRefresh = true;
      // For subscription updates, we expect both subscription and payment changes
      expectNewPayment = true;
    }

    if (urlParams.get("subscription_error") === "true") {
      const errorMessage =
        urlParams.get("error_message") || "Failed to update subscription";
      toast.error(decodeURIComponent(errorMessage));
    }

    // Handle checkout session completion (from PayPal/Card payments)
    if (urlParams.has("session_id")) {
      const sessionId = urlParams.get("session_id");
      if (sessionId) {
        await handleCheckoutSessionComplete(sessionId);
        shouldRefresh = true;
      }
    }

    // Clean up URL parameters using SvelteKit navigation
    replaceState(window.location.pathname, {});
    hasProcessedUrlParams = true;

    // Refresh billing data if subscription was updated with expected price ID for validation
    if (shouldRefresh) {
      await refreshBillingData(expectedPriceId, expectNewPayment);
    }
  }

  // Handle URL parameters on initial page load
  onMount(async () => {
    if (browser) {
      // Delay replaceState to ensure router is initialized
      setTimeout(async () => {
        await processUrlParameters();
      }, 0);
    }
  });

  // Handle URL parameters on subsequent navigation
  afterNavigate(async () => {
    await processUrlParameters();
  });

  // Reactive effect to load payment method when data becomes available
  $effect(() => {
    // Only run when we have a stripe customer ID and haven't initialized yet
    if (billingData.user?.stripeCustomerId && !paymentMethodInitialized) {
      console.log("Payment method loading triggered by reactive effect");
      fetchPaymentMethod();
    } else if (!billingData.user?.stripeCustomerId && billingData.user) {
      // User exists but no stripe customer ID - mark as initialized (no payment method)
      paymentMethodInitialized = true;
    }
  });

  // Get current plan data (now reactive using $derived)
  const currentPlan = $derived(
    billingData.subscription?.plan
      ? {
          name: billingData.subscription.plan.name,
          price: `$${(billingData.subscription.plan.priceAmount / 100).toFixed(2).replace(/\.00$/, "")}`,
          period: billingData.subscription.plan.billingInterval,
          tier: billingData.subscription.plan.tier,
          features: billingData.subscription.plan.features,
          limits: {
            textGeneration: billingData.subscription.plan.textGenerationLimit,
            imageGeneration: billingData.subscription.plan.imageGenerationLimit,
            videoGeneration: billingData.subscription.plan.videoGenerationLimit,
          },
        }
      : {
          name: m["billing.free_plan"](),
          price: "$0",
          period: "month",
          tier: "free",
          features: [m["billing.feature_limited_ai_access"](), m["billing.feature_text_only_models"]()],
          limits: {
            textGeneration: 10,
            imageGeneration: 2,
            videoGeneration: 0,
          },
        }
  );

  const subscriptionStatus = $derived(
    billingData.user?.subscriptionStatus || "incomplete"
  );
  const paymentHistory = $derived(billingData.paymentHistory || []);

  // Client-side payment method loading
  let paymentMethod = $state<{
    type: "card" | "paypal";
    // Card-specific fields
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
    // PayPal-specific fields
    payerEmail?: string;
    payerName?: string;
  } | null>(null);
  let paymentMethodLoading = $state(false);
  let paymentMethodError = $state(false);
  let paymentMethodInitialized = $state(false);

  // Payment history pagination derived variables
  const paymentHistoryTotalPages = $derived(() => {
    return Math.ceil(paymentHistory.length / paymentHistoryItemsPerPage);
  });

  const paginatedPaymentHistory = $derived(() => {
    const startIndex = (paymentHistoryPage - 1) * paymentHistoryItemsPerPage;
    const endIndex = startIndex + paymentHistoryItemsPerPage;
    return paymentHistory.slice(startIndex, endIndex);
  });

  // Get subscription details for status messages (now reactive)
  const subscription = $derived(billingData.subscription?.subscription);
  const isCancelled = $derived(subscription?.cancelAtPeriodEnd || false);
  const nextBillingDate = $derived(
    subscription?.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null
  );

  // Handle manage subscription (open customer portal)
  async function handleManageSubscription() {
    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create portal session");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error("Error opening customer portal:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to open subscription management";
      toast.error(errorMessage);
    }
  }

  // Navigate to pricing plans
  function pricingPagePlans() {
    window.location.href = "/pricing";
  }

  // Format card brand for display
  function formatCardBrand(brand: string) {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  }

  // Fetch payment method data
  async function fetchPaymentMethod() {
    // Only fetch if user has a stripe customer ID
    if (!billingData.user?.stripeCustomerId) {
      paymentMethodInitialized = true;
      return;
    }

    try {
      paymentMethodLoading = true;
      paymentMethodError = false;

      const response = await fetch("/api/payment-method");

      if (!response.ok) {
        throw new Error("Failed to fetch payment method");
      }

      const result = await response.json();
      paymentMethod = result.data.paymentMethod;
    } catch (error) {
      console.error("Error fetching payment method:", error);
      paymentMethodError = true;
    } finally {
      paymentMethodLoading = false;
      paymentMethodInitialized = true;
    }
  }
</script>

<svelte:head>
  <title>{m["billing.page_title"]()}</title>
</svelte:head>

<div class="space-y-3">
  <!-- Current Plan -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <GemIcon class="w-5 h-5" />
        {m["billing.current_plan"]()}
        {#if isRefreshing}
          <div class="flex items-center gap-2 ml-2 text-sm opacity-70">
            <div
              class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            ></div>
            {#if retryAttempt > 1}
              <span class="text-xs">{m["billing.syncing_attempt"]({ attempt: retryAttempt })}</span>
            {:else}
              <span class="text-xs">{m["billing.updating"]()}</span>
            {/if}
          </div>
        {/if}
      </Card.Title>
      <Card.Description
        >{m["billing.current_plan_description"]()}</Card.Description
      >
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-semibold">{currentPlan.name}</h3>
            <Badge
              variant={subscriptionStatus === "active" && !isCancelled
                ? "default"
                : isCancelled
                  ? "destructive"
                  : "secondary"}
              class="flex items-center gap-1"
            >
              {subscriptionStatus === "active" && !isCancelled
                ? m["billing.active"]()
                : subscriptionStatus === "active" && isCancelled
                  ? m["billing.cancelled"]()
                  : subscriptionStatus === "past_due"
                    ? m["billing.past_due"]()
                    : subscriptionStatus === "canceled"
                      ? m["billing.canceled"]()
                      : m["billing.inactive"]()}
            </Badge>
          </div>
          <p class="text-2xl font-bold">
            {currentPlan.price}<span
              class="text-sm font-normal text-muted-foreground"
              >/{currentPlan.period}</span
            >
          </p>
        </div>
        <div class="flex gap-2">
          {#if subscriptionStatus === "active" && billingData.user?.stripeCustomerId}
            <Button
              class="cursor-pointer"
              variant="outline"
              onclick={handleManageSubscription}
            >
              <ExternalLinkIcon class="w-4 h-4" />
              {m["billing.manage_subscription"]()}
            </Button>
          {/if}
          {#if currentPlan.tier === "free"}
            <Button class="cursor-pointer" onclick={pricingPagePlans}>
              <UpgradeIcon class="w-4 h-4 mr-2" />
              {m["billing.upgrade_plan"]()}
            </Button>
          {:else if currentPlan.tier !== "free"}
            <Button class="cursor-pointer" onclick={pricingPagePlans}>
              <UpgradeIcon class="w-4 h-4" />
              {m["billing.upgrade_downgrade_plan"]()}
            </Button>
          {/if}
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-sm font-medium">{m["billing.plan_features"]()}</h4>
        <ul class="space-y-1 text-sm text-muted-foreground">
          {#each currentPlan.features as feature}
            <li class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 bg-primary rounded-full"></span>
              {feature}
            </li>
          {/each}
        </ul>
      </div>

      <!-- Subscription Status Message -->
      {#if subscriptionStatus === "active" && nextBillingDate}
        <div class="p-3 bg-muted/50 rounded-lg border">
          {#if isCancelled}
            <p class="text-sm text-muted-foreground">
              {m["billing.subscription_cancelled"]({ date: nextBillingDate })}
            </p>
          {:else}
            <p class="text-sm text-muted-foreground">
              {m["billing.subscription_auto_renew"]({ date: nextBillingDate })}
            </p>
          {/if}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Payment Method -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <CreditCardIcon class="w-5 h-5" />
        {m["billing.payment_method"]()}
      </Card.Title>
      <Card.Description
        >{m["billing.payment_method_description"]()}</Card.Description
      >
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if !billingData.user?.stripeCustomerId}
        <div class="text-center py-2 space-y-4">
          <p class="text-muted-foreground">{m["billing.no_payment_method"]()}</p>
          <Button onclick={pricingPagePlans} class="flex items-center gap-2">
            <CreditCardIcon class="w-4 h-4" />
            {m["billing.subscribe_to_add_payment"]()}
          </Button>
        </div>
      {:else if (billingData.user?.stripeCustomerId && !paymentMethodInitialized) || paymentMethodLoading}
        <!-- Loading State -->
        <div class="space-y-4">
          <div class="flex items-center gap-3 p-4 border rounded-lg">
            <CreditCardIcon class="w-6 h-6 text-muted-foreground" />
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-muted animate-pulse rounded"></div>
              <div class="h-3 bg-muted animate-pulse rounded w-2/3"></div>
            </div>
          </div>
          <div class="text-center">
            <Button
              variant="outline"
              onclick={handleManageSubscription}
              class="cursor-pointer flex items-center gap-2"
            >
              <ExternalLinkIcon class="w-4 h-4" />
              {m["billing.manage_payment_method"]()}
            </Button>
          </div>
        </div>
      {:else if paymentMethodError}
        <!-- Error State -->
        <div class="text-center py-8 space-y-4">
          <p class="text-muted-foreground">{m["billing.unable_to_load_payment"]()}</p>
          <p class="text-xs text-muted-foreground">
            {m["billing.unable_to_load_payment_subtitle"]()}
          </p>
          <Button
            variant="outline"
            onclick={handleManageSubscription}
            class="cursor-pointer flex items-center gap-2"
          >
            <ExternalLinkIcon class="w-4 h-4" />
            Manage Payment Method
          </Button>
        </div>
      {:else if paymentMethod}
        <!-- Payment Method Display -->
        <div class="space-y-4">
          <div class="flex items-center gap-3 p-4 border rounded-lg">
            {#if paymentMethod.type === "card"}
              <!-- Card Display -->
              <CreditCardIcon class="w-6 h-6 text-muted-foreground" />
              <div class="flex-1">
                <div class="font-medium">
                  •••• •••• •••• {paymentMethod.last4}
                </div>
                <div class="text-sm text-muted-foreground">
                  {formatCardBrand(paymentMethod.brand || "")} • {m["billing.expires"]()} {(
                    paymentMethod.expMonth || 0
                  )
                    .toString()
                    .padStart(2, "0")}/{paymentMethod.expYear || ""}
                </div>
              </div>
            {:else if paymentMethod.type === "paypal"}
              <!-- PayPal Display -->
              <WalletIcon class="w-6 h-6 text-muted-foreground" />
              <div class="flex-1">
                <div class="font-medium">{m["billing.paypal_account"]()}</div>
                <div class="text-sm text-muted-foreground">
                  {#if paymentMethod.payerEmail}
                    {paymentMethod.payerEmail}
                  {:else if paymentMethod.payerName}
                    {paymentMethod.payerName}
                  {:else}
                    {m["billing.connected_paypal_account"]()}
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          <!-- Manage Button -->
          <div class="text-center">
            <Button
              variant="outline"
              onclick={handleManageSubscription}
              class="cursor-pointer flex items-center gap-2"
            >
              <ExternalLinkIcon class="w-4 h-4" />
              {m["billing.manage_payment_method"]()}
            </Button>
          </div>
        </div>
      {:else}
        <!-- No Payment Method -->
        <div class="text-center py-8 space-y-4">
          <p class="text-muted-foreground">{m["billing.no_payment_method"]()}</p>
          <p class="text-xs text-muted-foreground">
            {m["billing.no_payment_method_subtitle"]()}
          </p>
          <Button
            variant="outline"
            onclick={handleManageSubscription}
            class="cursor-pointer flex items-center gap-2"
          >
            <ExternalLinkIcon class="w-4 h-4" />
            Manage Payment Method
          </Button>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Payment History -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <HistoryIcon />
        {m["billing.payment_history"]()}
      </Card.Title>
      <Card.Description
        >{m["billing.payment_history_description"]()}</Card.Description
      >
    </Card.Header>
    <Card.Content>
      {#if paymentHistory.length === 0}
        <div class="text-center py-8">
          <p class="text-muted-foreground">{m["billing.no_payment_history"]()}</p>
          <p class="text-xs text-muted-foreground mt-2">
            {m["billing.no_payment_history_subtitle"]()}
          </p>
        </div>
      {:else}
        <div>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head class="w-[40%]">{m["billing.description"]()}</Table.Head>
                <Table.Head class="w-[25%]">{m["billing.date"]()}</Table.Head>
                <Table.Head class="w-[20%] text-right">{m["billing.amount"]()}</Table.Head>
                <Table.Head class="w-[15%] text-center">{m["billing.status"]()}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each paginatedPaymentHistory() as payment}
                <Table.Row>
                  <Table.Cell>{payment.description}</Table.Cell>
                  <Table.Cell class="text-muted-foreground"
                    >{payment.date}</Table.Cell
                  >
                  <Table.Cell class="text-right">{payment.amount}</Table.Cell>
                  <Table.Cell class="text-center">
                    <Badge
                      variant={payment.status === "succeeded"
                        ? "default"
                        : payment.status === "failed"
                          ? "destructive"
                          : "secondary"}
                    >
                      {payment.status === "succeeded" ? m["billing.paid"]() : payment.status}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>

        <!-- Pagination Controls -->
        {#if paymentHistoryTotalPages() > 1}
          <div class="mt-6 flex flex-col items-center gap-3">
            <!-- Pagination Info -->
            <div class="text-sm text-muted-foreground">
              {m["billing.showing_payments"]({
                start: (paymentHistoryPage - 1) * paymentHistoryItemsPerPage + 1,
                end: Math.min(
                  paymentHistoryPage * paymentHistoryItemsPerPage,
                  paymentHistory.length
                ),
                total: paymentHistory.length
              })}
            </div>

            <!-- Pagination Component -->
            <Pagination.Root
              count={paymentHistory.length}
              perPage={paymentHistoryItemsPerPage}
              page={paymentHistoryPage}
              onPageChange={(page) => {
                paymentHistoryPage = page;
              }}
            >
              {#snippet children({ pages, currentPage: paginationCurrentPage })}
                <Pagination.Content>
                  <Pagination.PrevButton />
                  {#each pages as page}
                    {#if page.type === "ellipsis"}
                      <Pagination.Ellipsis />
                    {:else}
                      <Pagination.Link
                        {page}
                        isActive={paginationCurrentPage === page.value}
                      />
                    {/if}
                  {/each}
                  <Pagination.NextButton />
                </Pagination.Content>
              {/snippet}
            </Pagination.Root>
          </div>
        {/if}
      {/if}
    </Card.Content>
  </Card.Root>
</div>

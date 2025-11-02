<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";

  // Import icons
  import { AnalyticsIcon, UpgradeIcon, FlameIcon } from "$lib/icons/index.js";
  import type { ModelUsageStatistic } from "$lib/server/usage-tracking.js";
  import * as m from "$lib/../paraglide/messages.js";

  let { data } = $props();

  // Real usage data from server
  const currentPeriod = data.currentPeriod;
  const usageSummary = data.usageSummary;
  const planTier = data.planTier;
  const modelUsage: ModelUsageStatistic[] = data.modelUsageStatistics || [];

  // Convert usage summary to stats format
  const usageStats = {
    textMessages: {
      used: usageSummary.text.used,
      limit: usageSummary.text.limit ?? -1,
      unit: m["usage.messages"](),
    },
    imageGenerations: {
      used: usageSummary.image.used,
      limit: usageSummary.image.limit ?? -1,
      unit: m["usage.images"](),
    },
    videoGenerations: {
      used: usageSummary.video.used,
      limit: usageSummary.video.limit ?? -1,
      unit: m["usage.videos"](),
    },
  };

  function getUsagePercentage(used: number, limit: number): number {
    if (limit === -1 || limit === null) return 0; // Unlimited
    if (limit === 0) return used > 0 ? 100 : 0; // No access allowed
    return Math.min((used / limit) * 100, 100);
  }

  function formatLimit(limit: number | null): string {
    if (limit === -1 || limit === null) return m["usage.unlimited"]();
    if (limit === 0) return m["usage.not_included"]();
    return limit.toString();
  }

  function getPlanDisplayName(tier: string): string {
    switch (tier) {
      case "starter":
        return m["usage.starter_plan"]();
      case "pro":
        return m["usage.pro_plan"]();
      case "advanced":
        return m["usage.advanced_plan"]();
      default:
        return m["usage.free_plan"]();
    }
  }

  function getUsageColor(percentage: number): string {
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-primary";
  }
</script>

<svelte:head>
  <title>{m["usage.page_title"]()}</title>
</svelte:head>

<div class="space-y-3">
  <!-- Current Billing Period -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center justify-between">
        <span>{m["usage.current_billing_period"]()}</span>
        <Badge variant="outline" class="text-xs"
          >{getPlanDisplayName(planTier)}</Badge
        >
      </Card.Title>
      <Card.Description>
        {#if planTier === "free"}
          {m["usage.usage_reset_free"]()}
        {:else}
          {m["usage.usage_reset_paid"]()}
        {/if}
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="grid gap-4 md:grid-cols-3">
        <div class="text-center">
          <p class="text-sm text-muted-foreground">{m["usage.period_start"]()}</p>
          <p class="font-semibold">{currentPeriod.start}</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-muted-foreground">{m["usage.period_end"]()}</p>
          <p class="font-semibold">{currentPeriod.end}</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-muted-foreground">
            {#if planTier === "free"}
              {m["usage.hours_until_reset"]()}
            {:else}
              {m["usage.days_remaining"]()}
            {/if}
          </p>
          <p class="font-semibold">
            {#if planTier === "free"}
              {(currentPeriod as any).hoursRemaining || 0}
            {:else}
              {currentPeriod.daysRemaining}
            {/if}
          </p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Usage Quotas -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <AnalyticsIcon class="w-5 h-5" />
        {m["usage.usage_quotas"]()}
      </Card.Title>
      <Card.Description
        >{m["usage.usage_quotas_description"]()}</Card.Description
      >
    </Card.Header>
    <Card.Content class="space-y-4">
      {#each Object.entries(usageStats) as [key, stat]}
        {@const percentage = getUsagePercentage(stat.used, stat.limit)}
        {@const colorClass = getUsageColor(percentage)}

        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium">
              {key === "textMessages" ? m["usage.text_messages"]() :
               key === "imageGenerations" ? m["usage.image_generations"]() :
               key === "videoGenerations" ? m["usage.video_generations"]() : key}
            </span>
            <span class="text-sm text-muted-foreground">
              {stat.used} / {formatLimit(stat.limit)}
              {stat.unit}
            </span>
          </div>

          <div class="w-full bg-muted rounded-full h-2">
            <div
              class="h-2 rounded-full transition-all duration-300 {colorClass}"
              style="width: {percentage}%"
            ></div>
          </div>

          <div class="flex justify-between text-xs text-muted-foreground">
            <span>
              {#if stat.limit === -1 || stat.limit === null}
                {m["usage.unlimited_usage"]()}
              {:else}
                {percentage.toFixed(1)}{m["usage.percent_used"]()}
              {/if}
            </span>
            {#if stat.limit === -1 || stat.limit === null}
              <Badge variant="outline" class="text-xs">{m["usage.unlimited"]()}</Badge>
            {/if}
          </div>
        </div>
      {/each}

      <Separator />

      <div class="text-center space-y-2">
        <p class="text-sm text-muted-foreground">
          {m["usage.need_more_upgrade"]()}
        </p>
        {#if planTier === "free" || planTier === "starter"}
          <a href="/pricing">
            <Button
              variant="outline"
              class="cursor-pointer flex items-center gap-2"
            >
              <UpgradeIcon class="w-4 h-4" />
              {m["usage.upgrade_plan"]()}
            </Button>
          </a>
        {:else}
          <a href="/settings/billing">
            <Button
              variant="outline"
              class="cursor-pointer flex items-center gap-2"
            >
              {m["usage.manage_subscription"]()}
            </Button>
          </a>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Model Usage Statistics -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <FlameIcon class="w-5 h-5" />
        {m["usage.model_usage_statistics"]()}
      </Card.Title>
      <Card.Description>{m["usage.model_usage_description"]()}</Card.Description>
    </Card.Header>
    <Card.Content>
      {#if modelUsage.length === 0}
        <div class="text-center py-8">
          <p class="text-muted-foreground">{m["usage.no_usage_data"]()}</p>
          <p class="text-xs text-muted-foreground mt-2">
            {m["usage.no_usage_data_subtitle"]()}
          </p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each modelUsage as model}
            <div
              class="flex items-center justify-between px-3.5 py-2 border rounded-md"
            >
              <div>
                <p class="text-sm font-medium">{model.model}</p>
                <!-- <p class="text-xs text-muted-foreground">{model.provider}</p> -->
              </div>
              <div class="text-right">
                <p class="text-sm font-medium">
                  {model.count}
                  {model.count === 1 ? m["usage.use"]() : m["usage.uses"]()}
                </p>
                <p class="text-xs text-muted-foreground">{model.percentage}%</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

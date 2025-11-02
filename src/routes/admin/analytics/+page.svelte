<script lang="ts">
  import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
  import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
  import * as Chart from "$lib/components/ui/chart/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { cubicInOut } from "svelte/easing";
  import { onMount } from "svelte";

  // Lazy load heavy chart dependencies
  let chartLibraries: any = $state(null);
  let isLoadingCharts = $state(true);

  onMount(async () => {
    try {
      const [d3ScaleModule, layerchartModule, d3ShapeModule] = await Promise.all([
        import("d3-scale"),
        import("layerchart"),
        import("d3-shape"),
      ]);

      chartLibraries = {
        scaleUtc: d3ScaleModule.scaleUtc,
        LineChart: layerchartModule.LineChart,
        Area: layerchartModule.Area,
        AreaChart: layerchartModule.AreaChart,
        ChartClipPath: layerchartModule.ChartClipPath,
        curveNatural: d3ShapeModule.curveNatural,
        curveMonotoneX: d3ShapeModule.curveMonotoneX,
      };
      isLoadingCharts = false;
    } catch (error) {
      console.error("Failed to load chart libraries:", error);
      isLoadingCharts = false;
    }
  });
  import type {
    AnalyticsDataPoint,
    AnalyticsApiResponse,
    UserGrowthDataPoint,
  } from "$lib/types/analytics.js";

  // Line chart specific type
  interface LineChartDataPoint {
    date: Date;
    chats: number;
  }

  let { data } = $props();

  // Validate and process the analytics data for the chart with user-friendly error handling
  function validateAnalyticsData(analytics: any): AnalyticsApiResponse {
    if (!analytics || typeof analytics !== "object") {
      throw new Error(
        "Analytics data is not properly formatted. Please refresh the page."
      );
    }
    if (!Array.isArray(analytics.data)) {
      throw new Error("Analytics chart data is missing. Please try again.");
    }
    if (typeof analytics.totalChats !== "number") {
      throw new Error(
        "Analytics summary data is invalid. Please refresh the page."
      );
    }
    if (analytics.data.length === 0) {
      throw new Error("No analytics data available for the selected period.");
    }
    return analytics as AnalyticsApiResponse;
  }

  // Validate analytics data and handle errors
  let validationError: string | null = $state(null);
  let validatedAnalytics: AnalyticsApiResponse | null = null;

  try {
    validatedAnalytics = validateAnalyticsData(data.analytics);
  } catch (err) {
    validationError =
      err instanceof Error ? err.message : "Failed to load analytics data";
  }

  // Use $derived for computed values based on validated data
  const chartData = $derived((): LineChartDataPoint[] => {
    if (!validatedAnalytics || validationError) return [];
    return validatedAnalytics.data.map((item) => ({
      date: new Date(item.date),
      chats: item.chats,
    }));
  });

  const total = $derived(() => ({
    chats: validatedAnalytics?.totalChats || 0,
  }));

  const percentageChange = $derived(
    () => validatedAnalytics?.percentageChange || 0
  );
  const isPositiveTrend = $derived(() => percentageChange() >= 0);

  const chartConfig = {
    views: { label: "Chats Created", color: "" },
    chats: { label: "Chats", color: "var(--chart-1)" },
  } satisfies Chart.ChartConfig;

  const activeSeries = $derived([
    {
      key: "chats",
      label: chartConfig.chats.label,
      color: chartConfig.chats.color,
    },
  ]);

  // Area Chart for User Growth & Subscriptions
  let timeRange = $state("90d");

  const selectedLabel = $derived.by(() => {
    switch (timeRange) {
      case "90d":
        return "Last 90 days";
      case "30d":
        return "Last 30 days";
      case "7d":
        return "Last 7 days";
      default:
        return "Last 90 days";
    }
  });

  const userGrowthChartData = $derived(() => {
    if (!validatedAnalytics || validationError) return [];

    const referenceDate = new Date();
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }

    referenceDate.setDate(referenceDate.getDate() - daysToSubtract);

    return validatedAnalytics.data
      .filter((item) => new Date(item.date) >= referenceDate)
      .map((item) => ({
        date: new Date(item.date),
        totalUsers: item.totalUsers,
        activeSubscriptions: item.activeSubscriptions,
      })) as UserGrowthDataPoint[];
  });

  const userGrowthChartConfig = {
    totalUsers: { label: "Total Users", color: "var(--chart-1)" },
    activeSubscriptions: {
      label: "Active Subs",
      color: "var(--chart-2)",
    },
  } satisfies Chart.ChartConfig;

  const totalUsers = $derived(() => validatedAnalytics?.totalUsers || 0);
  const totalActiveSubscriptions = $derived(
    () => validatedAnalytics?.totalActiveSubscriptions || 0
  );
  const totalRevenue = $derived(() => validatedAnalytics?.totalRevenue || 0);
  const revenuePercentageChange = $derived(
    () => validatedAnalytics?.revenuePercentageChange || 0
  );
  const isPositiveRevenueTrend = $derived(() => revenuePercentageChange() >= 0);

  // Revenue Chart Data and Configuration
  interface RevenueChartDataPoint {
    date: Date;
    revenue: number;
  }

  const revenueChartData = $derived((): RevenueChartDataPoint[] => {
    if (!validatedAnalytics || validationError) return [];
    return validatedAnalytics.data.map((item) => ({
      date: new Date(item.date),
      revenue: item.revenue / 100, // Convert from cents to dollars
    }));
  });

  const revenueChartConfig = {
    views: { label: "Revenue Generated", color: "" },
    revenue: { label: "Revenue", color: "var(--chart-3)" },
  } satisfies Chart.ChartConfig;

  const revenueActiveSeries = $derived([
    {
      key: "revenue",
      label: revenueChartConfig.revenue.label,
      color: revenueChartConfig.revenue.color,
    },
  ]);
</script>

<svelte:head>
  <title>Analytics - Admin Dashboard</title>
  <meta name="description" content="Chat analytics and usage statistics" />
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="text-3xl font-bold tracking-tight">Analytics</h1>
    <p class="text-muted-foreground">Trends and usage charts</p>
  </div>

  {#if validationError}
    <!-- Error State -->
    <Card.Root class="border-destructive/50 bg-destructive/5">
      <Card.Header>
        <Card.Title class="text-destructive">Analytics Unavailable</Card.Title>
        <Card.Description class="text-destructive/80">
          {validationError}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <button
          class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          onclick={() => window.location.reload()}
        >
          Refresh Page
        </button>
      </Card.Content>
    </Card.Root>
  {:else}
    {#if isLoadingCharts || !chartLibraries}
      <!-- Loading state for charts -->
      <div class="space-y-6">
        <Card.Root>
          <Card.Header>
            <Card.Title>Loading Analytics...</Card.Title>
            <Card.Description>Please wait while we load the chart components</Card.Description>
          </Card.Header>
          <Card.Content class="h-[250px] flex items-center justify-center">
            <div class="flex flex-col items-center gap-2">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p class="text-sm text-muted-foreground">Loading chart libraries...</p>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    {:else}
    <!-- User Growth & Subscription Trends Area Chart -->
    <Card.Root>
      <Card.Header
        class="flex items-center gap-2 space-y-0 border-b py-3 sm:flex-row"
      >
        <div class="grid flex-1 gap-1 text-center sm:text-left">
          <Card.Title>Users & Subscriptions</Card.Title>
          <Card.Description
            >Showing total registered users and active subscriptions over time</Card.Description
          >
        </div>
        <Select.Root type="single" bind:value={timeRange}>
          <Select.Trigger
            class="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
            {selectedLabel}
          </Select.Trigger>
          <Select.Content class="rounded-xl">
            <Select.Item value="90d" class="rounded-lg"
              >Last 90 days</Select.Item
            >
            <Select.Item value="30d" class="rounded-lg"
              >Last 30 days</Select.Item
            >
            <Select.Item value="7d" class="rounded-lg">Last 7 days</Select.Item>
          </Select.Content>
        </Select.Root>
      </Card.Header>
      <Card.Content>
        <Chart.Container
          config={userGrowthChartConfig}
          class="aspect-auto h-[250px] w-full"
        >
          <svelte:component this={chartLibraries.AreaChart}
            legend
            data={userGrowthChartData()}
            x="date"
            xScale={chartLibraries.scaleUtc()}
            series={[
              {
                key: "totalUsers",
                label: "Total Users",
                color: userGrowthChartConfig.totalUsers.color,
              },
              {
                key: "activeSubscriptions",
                label: "Active Subscriptions",
                color: userGrowthChartConfig.activeSubscriptions.color,
              },
            ]}
            seriesLayout="stack"
            props={{
              area: {
                curve: chartLibraries.curveNatural,
                "fill-opacity": 0.4,
                line: { class: "stroke-1" },
                motion: "tween",
              },
              xAxis: {
                ticks: timeRange === "7d" ? 7 : undefined,
                format: (v) => {
                  return v.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                },
              },
              yAxis: { format: () => "" },
            }}
          >
            {#snippet marks({ series, getAreaProps })}
              <defs>
                <linearGradient id="fillTotalUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stop-color="var(--color-totalUsers)"
                    stop-opacity={1.0}
                  />
                  <stop
                    offset="95%"
                    stop-color="var(--color-totalUsers)"
                    stop-opacity={0.1}
                  />
                </linearGradient>
                <linearGradient
                  id="fillActiveSubscriptions"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stop-color="var(--color-activeSubscriptions)"
                    stop-opacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stop-color="var(--color-activeSubscriptions)"
                    stop-opacity={0.1}
                  />
                </linearGradient>
              </defs>
              <svelte:component this={chartLibraries.ChartClipPath}
                initialWidth={0}
                motion={{
                  width: { type: "tween", duration: 1000, easing: cubicInOut },
                }}
              >
                {#each series as s, i (s.key)}
                  <svelte:component this={chartLibraries.Area}
                    {...getAreaProps(s, i)}
                    fill={s.key === "totalUsers"
                      ? "url(#fillTotalUsers)"
                      : "url(#fillActiveSubscriptions)"}
                  />
                {/each}
              </svelte:component>
            {/snippet}
            {#snippet tooltip()}
              <Chart.Tooltip
                labelFormatter={(v: Date) => {
                  return v.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  });
                }}
                indicator="line"
              />
            {/snippet}
          </svelte:component>
        </Chart.Container>
      </Card.Content>
      <Card.Footer>
        <div class="flex w-full items-start gap-2 text-sm">
          <div class="grid gap-2">
            <div class="flex items-center gap-2 font-medium leading-none">
              {totalUsers().toLocaleString()} total users <TrendingUpIcon
                class="size-4"
              />
            </div>
            <div
              class="text-muted-foreground flex items-center gap-2 leading-none"
            >
              {totalActiveSubscriptions().toLocaleString()} total active subscriptions
              across all plans
            </div>
          </div>
        </div>
      </Card.Footer>
    </Card.Root>

    <!-- Revenue Trends Line Chart -->
    <Card.Root>
      <Card.Header
        class="flex items-center gap-2 space-y-0 border-b py-3 sm:flex-row"
      >
        <div class="grid flex-1 gap-1 text-left">
          <Card.Title>Revenue</Card.Title>
          <Card.Description
            >Daily revenue generated from successful payments over the last 90
            days</Card.Description
          >
        </div>
      </Card.Header>
      <Card.Content class="px-2 sm:p-6">
        <Chart.Container
          config={revenueChartConfig}
          class="aspect-auto h-[250px] w-full"
        >
          <svelte:component this={chartLibraries.LineChart}
            data={revenueChartData()}
            x="date"
            xScale={chartLibraries.scaleUtc()}
            axis="x"
            y="revenue"
            yDomain={[0, null]}
            series={revenueActiveSeries}
            props={{
              spline: {
                curve: chartLibraries.curveMonotoneX,
                motion: "tween",
                strokeWidth: 2,
              },
              xAxis: {
                format: (v: Date) => {
                  return v.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                },
              },
              yAxis: {
                format: (v: number) => {
                  return `$${v.toLocaleString()}`;
                },
              },
              highlight: { points: { r: 4 } },
            }}
          >
            {#snippet tooltip()}
              <Chart.Tooltip
                labelFormatter={(v: Date) => {
                  return v.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  });
                }}
              />
            {/snippet}
          </svelte:component>
        </Chart.Container>
      </Card.Content>
      <Card.Footer>
        <div class="flex w-full items-start gap-2 text-sm">
          <div class="grid gap-2">
            <div class="flex items-center gap-2 font-medium leading-none">
              {#if isPositiveRevenueTrend()}
                Trending up by {Math.abs(revenuePercentageChange())}% compared
                to previous period
                <TrendingUpIcon class="size-4" />
              {:else if revenuePercentageChange() < 0}
                Trending down by {Math.abs(revenuePercentageChange())}% compared
                to previous period
                <TrendingDownIcon class="size-4" />
              {:else}
                No change compared to previous period
              {/if}
            </div>
            <div
              class="text-muted-foreground flex items-center gap-2 leading-none"
            >
              Revenue: <span class="text-green-600 font-semibold"
                >${(totalRevenue() / 100).toLocaleString()}</span
              >
              over the last 90 days
            </div>
          </div>
        </div>
      </Card.Footer>
    </Card.Root>

    <!-- Chat Creation Trends with side-by-side metrics -->
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Chart Section - 70% Width -->
      <div class="lg:w-7/10">
        <Card.Root>
          <Card.Header
            class="flex items-center gap-2 space-y-0 border-b py-3 sm:flex-row"
          >
            <div class="grid flex-1 gap-1 text-left">
              <Card.Title>Conversations</Card.Title>
              <Card.Description
                >Showing total chats created over the last 90 days</Card.Description
              >
            </div>
          </Card.Header>
          <Card.Content class="px-2 sm:p-6">
            <Chart.Container
              config={chartConfig}
              class="aspect-auto h-[250px] w-full"
            >
              <svelte:component this={chartLibraries.LineChart}
                data={chartData()}
                x="date"
                xScale={chartLibraries.scaleUtc()}
                axis="x"
                series={activeSeries}
                props={{
                  spline: {
                    curve: chartLibraries.curveMonotoneX,
                    motion: "tween",
                    strokeWidth: 2,
                  },
                  xAxis: {
                    format: (v: Date) => {
                      return v.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    },
                  },
                  highlight: { points: { r: 4 } },
                }}
              >
                {#snippet tooltip()}
                  <Chart.Tooltip hideLabel />
                {/snippet}
              </svelte:component>
            </Chart.Container>
          </Card.Content>
          <Card.Footer>
            <div class="flex w-full items-start gap-2 text-sm">
              <div class="grid gap-2">
                <div class="flex items-center gap-2 font-medium leading-none">
                  {#if isPositiveTrend()}
                    Trending up by {Math.abs(percentageChange())}% compared to
                    previous period
                    <TrendingUpIcon class="size-4" />
                  {:else if percentageChange() < 0}
                    Trending down by {Math.abs(percentageChange())}% compared to
                    previous period
                    <TrendingDownIcon class="size-4" />
                  {:else}
                    No change compared to previous period
                  {/if}
                </div>
                <div
                  class="text-muted-foreground flex items-center gap-2 leading-none"
                >
                  Showing chat creation data for the last 90 days vs. previous
                  90 days
                </div>
              </div>
            </div>
          </Card.Footer>
        </Card.Root>
      </div>

      <!-- Metrics Section - 30% Width -->
      <div class="lg:w-3/10">
        <div class="grid grid-cols-2 gap-4">
          <Card.Root>
            <Card.Header
              class="flex flex-row items-center justify-between space-y-0 pb-2"
            >
              <Card.Title class="text-sm font-medium"
                >Total Chats (90 Days)</Card.Title
              >
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">
                {total().chats.toLocaleString()}
              </div>
              <p class="text-xs text-muted-foreground">
                {#if isPositiveTrend()}
                  +{percentageChange()}% from previous period
                {:else if percentageChange() < 0}
                  {percentageChange()}% from previous period
                {:else}
                  No change from previous period
                {/if}
              </p>
            </Card.Content>
          </Card.Root>

          <Card.Root>
            <Card.Header
              class="flex flex-row items-center justify-between space-y-0 pb-2"
            >
              <Card.Title class="text-sm font-medium">Daily Average</Card.Title>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">
                {(total().chats / 90).toFixed(1)}
              </div>
              <p class="text-xs text-muted-foreground">
                Chats created per day on average
              </p>
            </Card.Content>
          </Card.Root>

          <Card.Root>
            <Card.Header
              class="flex flex-row items-center justify-between space-y-0 pb-2"
            >
              <Card.Title class="text-sm font-medium">Peak Day</Card.Title>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">
                {Math.max(
                  ...chartData().map((d: LineChartDataPoint) => d.chats)
                )}
              </div>
              <p class="text-xs text-muted-foreground">
                Maximum chats created in a single day
              </p>
            </Card.Content>
          </Card.Root>

          <Card.Root>
            <Card.Header
              class="flex flex-row items-center justify-between space-y-0 pb-2"
            >
              <Card.Title class="text-sm font-medium">Active Days</Card.Title>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">
                {chartData().filter((d: LineChartDataPoint) => d.chats > 0)
                  .length}
              </div>
              <p class="text-xs text-muted-foreground">
                Days with at least one chat created
              </p>
            </Card.Content>
          </Card.Root>
        </div>
      </div>
    </div>

    <!-- Coming Soon Message -->
    <div class="pt-6 text-center">
      <p class="text-muted-foreground text-md">
        More charts and comprehensive reporting features coming soon!
      </p>
    </div>
    {/if}
  {/if}
</div>

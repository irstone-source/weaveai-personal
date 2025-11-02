<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { goto } from "$app/navigation";

  // Import icons
  import {
    SettingsIcon,
    PaletteIcon,
    CreditCardIcon,
    KeyIcon,
    BrainIcon,
    CloudIcon,
    GemIcon,
    ShieldIcon,
    ArrowRightIcon,
  } from "$lib/icons/index.js";

  const settingsCategories = [
    {
      id: "general",
      title: "General Settings",
      description: "Configure site name and basic platform settings",
      icon: SettingsIcon,
      path: "/admin/settings/general",
    },
    {
      id: "branding",
      title: "Branding",
      description:
        "Upload app logo, set theme preferences, and customize appearance",
      icon: PaletteIcon,
      path: "/admin/settings/branding",
    },
    {
      id: "payment-methods",
      title: "Payment Methods",
      description:
        "Configure Stripe API keys, webhooks, and payment processing",
      icon: CreditCardIcon,
      path: "/admin/settings/payment-methods",
    },
    {
      id: "oauth-providers",
      title: "OAuth Providers",
      description:
        "Configure Google, Apple, X (Twitter), and other social login providers",
      icon: KeyIcon,
      path: "/admin/settings/oauth-providers",
    },
    {
      id: "plans",
      title: "Pricing Plans",
      description: "Configure subscription tiers, pricing, and billing plans",
      icon: GemIcon,
      path: "/admin/settings/plans",
    },
    {
      id: "ai-models",
      title: "AI Models",
      description: "Configure AI provider settings and API keys",
      icon: BrainIcon,
      path: "/admin/settings/ai-models",
    },
    {
      id: "cloud-storage",
      title: "Cloud Storage",
      description:
        "Configure Cloudflare R2 storage settings and fallback options",
      icon: CloudIcon,
      path: "/admin/settings/cloud-storage",
    },
    {
      id: "security",
      title: "Security",
      description:
        "Configure Cloudflare Turnstile and other security settings",
      icon: ShieldIcon,
      path: "/admin/settings/security",
    },
  ];
</script>

<svelte:head>
  <title>Site Settings - Admin Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <!-- Page Header -->
  <div>
    <h1 class="text-3xl font-bold tracking-tight">Settings Overview</h1>
    <p class="text-muted-foreground">
      Configure platform settings and integrations.
    </p>
  </div>

  <!-- Settings Categories Grid -->
  <div class="grid gap-4 md:grid-cols-2">
    {#each settingsCategories as category}
      {@const Icon = category.icon}
      <Card.Root class="cursor-pointer hover:shadow-md transition-shadow">
        <Card.Header>
          <Card.Title class="flex items-center gap-3">
            <div class="p-2 bg-primary/10 rounded-md">
              <Icon class="w-5 h-5 text-primary" />
            </div>
            {category.title}
          </Card.Title>
          <Card.Description>
            {category.description}
          </Card.Description>
        </Card.Header>
        <Card.Content class="pt-0">
          <Button
            variant="outline"
            class="w-full justify-between"
            onclick={() => goto(category.path)}
          >
            Configure
            <ArrowRightIcon class="w-4 h-4" />
          </Button>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>
</div>

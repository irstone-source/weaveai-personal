<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { goto } from "$app/navigation";
  import { enhance } from '$app/forms';
  
  // Import icons
  import { GemIcon } from "$lib/icons/index.js";

  let { data, form } = $props();

  // Form state
  let isSubmitting = $state(false);
  
  // Form field states
  let tier = $state(form?.tier || data.plan.tier);
  let currency = $state(form?.currency || data.plan.currency);
  let billingInterval = $state(form?.billingInterval || data.plan.billingInterval);
  
  // Select display values
  const tierOptions = [
    { value: "free", label: "Free" },
    { value: "starter", label: "Starter" },
    { value: "pro", label: "Pro" },
    { value: "advanced", label: "Advanced" }
  ];
  
  const currencyOptions = [
    { value: "usd", label: "USD" },
    { value: "eur", label: "EUR" },
    { value: "gbp", label: "GBP" }
  ];
  
  const billingOptions = [
    { value: "month", label: "Monthly" },
    { value: "year", label: "Yearly" }
  ];
  
  const tierTriggerContent = $derived(
    tierOptions.find(t => t.value === tier)?.label ?? "Select tier"
  );
  
  const currencyTriggerContent = $derived(
    currencyOptions.find(c => c.value === currency)?.label ?? "USD"
  );
  
  const billingTriggerContent = $derived(
    billingOptions.find(b => b.value === billingInterval)?.label ?? "Select interval"
  );
  
  // Features as a string for the textarea
  const featuresText = $derived(() => {
    if (form?.features) return form.features;
    return data.plan.features?.join('\n') || '';
  });
</script>

<svelte:head>
  <title>Edit Pricing Plan - Admin Settings</title>
</svelte:head>

<div class="space-y-6">
  <!-- Demo Mode Banner -->
  {#if data.isDemoMode}
    <div class="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-md">
      <div class="flex items-center gap-2">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
          </svg>
        </div>
        <div>
          <p class="font-medium">Demo Mode Active</p>
          <p class="text-sm">All modifications are disabled. This is a read-only demonstration of the admin interface.</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Page Header -->
  <div class="flex justify-between items-center">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Edit Plan</h1>
      <p class="text-muted-foreground">Modify the pricing plan details below.</p>
    </div>
    <Button variant="outline" onclick={() => goto('/admin/settings/plans')}>
      Back to Plans
    </Button>
  </div>

  <!-- Edit Plan Form -->
  <Card.Root class="max-w-2xl">
    <Card.Header>
      <Card.Title>Plan Details</Card.Title>
      <Card.Description>
        Update the information below to modify the pricing plan.
      </Card.Description>
    </Card.Header>
    <Card.Content>
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
          <div class="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
            {form.error}
          </div>
        {/if}

        <!-- Basic Information -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="name">Plan Name</Label>
            <Input 
              id="name" 
              name="name" 
              placeholder="e.g., Professional Plan"
              value={form?.name || data.plan.name}
              required 
            />
          </div>

          <div class="space-y-2">
            <Label for="tier">Tier</Label>
            <Select.Root type="single" name="tier" bind:value={tier} required>
              <Select.Trigger>
                {tierTriggerContent}
              </Select.Trigger>
              <Select.Content>
                {#each tierOptions as option (option.value)}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <!-- Stripe Information -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="stripePriceId">Stripe Price ID</Label>
            <Input 
              id="stripePriceId" 
              name="stripePriceId" 
              placeholder="price_123..."
              value={form?.stripePriceId || data.plan.stripePriceId}
              required 
            />
          </div>

        </div>

        <!-- Pricing Information -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="space-y-2">
            <Label for="priceAmount">Price (in cents)</Label>
            <Input 
              id="priceAmount" 
              name="priceAmount" 
              type="number"
              placeholder="2999"
              min="0"
              value={form?.priceAmount || data.plan.priceAmount}
              required 
            />
            <p class="text-xs text-muted-foreground">Enter price in cents (e.g., 2999 = $29.99)</p>
          </div>

          <div class="space-y-2">
            <Label for="currency">Currency</Label>
            <Select.Root type="single" name="currency" bind:value={currency}>
              <Select.Trigger>
                {currencyTriggerContent}
              </Select.Trigger>
              <Select.Content>
                {#each currencyOptions as option (option.value)}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <div class="space-y-2">
            <Label for="billingInterval">Billing Interval</Label>
            <Select.Root type="single" name="billingInterval" bind:value={billingInterval} required>
              <Select.Trigger>
                {billingTriggerContent}
              </Select.Trigger>
              <Select.Content>
                {#each billingOptions as option (option.value)}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <!-- Usage Limits -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Usage Limits</h3>
          <p class="text-sm text-muted-foreground">Leave empty for unlimited usage</p>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="space-y-2">
              <Label for="textGenerationLimit">Text Generation Limit</Label>
              <Input 
                id="textGenerationLimit" 
                name="textGenerationLimit" 
                type="number"
                placeholder="Unlimited"
                min="0"
                value={form?.textGenerationLimit || (data.plan.textGenerationLimit ?? '')}
              />
            </div>

            <div class="space-y-2">
              <Label for="imageGenerationLimit">Image Generation Limit</Label>
              <Input 
                id="imageGenerationLimit" 
                name="imageGenerationLimit" 
                type="number"
                placeholder="Unlimited"
                min="0"
                value={form?.imageGenerationLimit || (data.plan.imageGenerationLimit ?? '')}
              />
            </div>

            <div class="space-y-2">
              <Label for="videoGenerationLimit">Video Generation Limit</Label>
              <Input 
                id="videoGenerationLimit" 
                name="videoGenerationLimit" 
                type="number"
                placeholder="Unlimited"
                min="0"
                value={form?.videoGenerationLimit || (data.plan.videoGenerationLimit ?? '')}
              />
            </div>
          </div>
        </div>

        <!-- Features -->
        <div class="space-y-2">
          <Label for="features">Plan Features</Label>
          <Textarea 
            id="features" 
            name="features" 
            placeholder="Enter each feature on a new line..."
            value={featuresText()}
            rows={5}
          />
          <p class="text-xs text-muted-foreground">Enter each feature on a separate line</p>
        </div>

        <!-- Plan Status -->
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <Switch 
              id="isActive"
              name="isActive"
              checked={form?.isActive ?? data.plan.isActive}
            />
            <Label for="isActive">Plan is Active</Label>
          </div>
          <p class="text-xs text-muted-foreground">Toggle to activate or deactivate this plan</p>
        </div>

        <!-- Submit Button -->
        <div class="space-y-2">
          <div class="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onclick={() => goto('/admin/settings/plans')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || data.isDemoMode}>
              {isSubmitting ? 'Updating...' : data.isDemoMode ? 'Demo Mode - Read Only' : 'Update Plan'}
            </Button>
          </div>
          {#if data.isDemoMode}
            <p class="text-xs text-muted-foreground text-right">
              Updates are disabled in demo mode. This is a read-only demonstration.
            </p>
          {/if}
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
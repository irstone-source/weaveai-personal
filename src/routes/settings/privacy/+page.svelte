<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { enhance } from "$app/forms";
  import { toast } from "svelte-sonner";
  import * as m from "$lib/../paraglide/messages.js";

  // Import icons
  import {
    ShieldIcon,
    ExternalLinkIcon,
    ReceiptIcon,
  } from "$lib/icons/index.js";

  let { data, form } = $props();

  // Privacy settings state - initialize from server data
  let marketingConsent = $state(data?.user?.marketingConsent ?? false);
  let loading = $state(false);

  // Handle form submission results
  $effect(() => {
    if (form?.success) {
      toast.success(form.message || m["privacy.settings_updated"]());
      // Update local state with the returned value to ensure sync
      if (form.marketingConsent !== undefined) {
        marketingConsent = form.marketingConsent;
      }
    } else if (form?.error) {
      toast.error(form.error || m["privacy.update_error"]());
      // On error, optionally revert state to server data to avoid inconsistency
      if (data?.user?.marketingConsent !== undefined) {
        marketingConsent = data.user.marketingConsent;
      }
    }
  });
</script>

<svelte:head>
  <title>{m["privacy.page_title"]()}</title>
</svelte:head>

<div class="space-y-3">
  <!-- Privacy Controls -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <ShieldIcon class="w-5 h-5" />
        {m["privacy.title"]()}
      </Card.Title>
      <Card.Description>{m["privacy.description"]()}</Card.Description>
    </Card.Header>
    <Card.Content class="space-y-6">
      <form
        method="POST"
        action="?/updatePrivacySettings"
        use:enhance={() => {
          loading = true;
          return async ({ update }) => {
            try {
              await update();
            } finally {
              loading = false;
            }
          };
        }}
      >
        <!-- Marketing Consent -->
        <div class="flex items-start space-x-3">
          <input
            type="checkbox"
            id="marketing-consent"
            name="marketingConsent"
            bind:checked={marketingConsent}
            class="mt-1 h-4 w-4 rounded border-gray-300"
          />
          <div class="flex-1 space-y-1">
            <Label for="marketing-consent" class="text-sm font-medium">
              {m["privacy.marketing_consent"]()}
            </Label>
            <p class="text-xs text-muted-foreground">
              {m["privacy.marketing_consent_description"]()}
            </p>
          </div>
        </div>

        <div class="pt-4">
          <Button
            type="submit"
            disabled={loading}
            class="w-full sm:w-auto flex items-center gap-2"
          >
            <ShieldIcon class="w-4 h-4" />
            {loading ? m["privacy.saving"]() : m["privacy.save_settings"]()}
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>

  <!-- Privacy Information -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <ReceiptIcon class="w-5 h-5" />
        {m["privacy.privacy_information"]()}
      </Card.Title>
      <Card.Description
        >{m["privacy.privacy_information_description"]()}</Card.Description
      >
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="space-y-2">
        <h4 class="text-sm font-medium">{m["privacy.what_data_collected"]()}</h4>
        <ul class="text-xs text-muted-foreground space-y-1">
          <li>• {m["privacy.data_account_info"]()}</li>
          <li>• {m["privacy.data_chat_messages"]()}</li>
          <li>• {m["privacy.data_generated_content"]()}</li>
          <li>• {m["privacy.data_technical"]()}</li>
        </ul>
      </div>

      <Separator />

      <div class="space-y-2">
        <h4 class="text-sm font-medium">{m["privacy.how_data_protected"]()}</h4>
        <ul class="text-xs text-muted-foreground space-y-1">
          <li>• {m["privacy.protection_encryption"]()}</li>
          <li>• {m["privacy.protection_data_centers"]()}</li>
          <li>• {m["privacy.protection_audits"]()}</li>
          <li>• {m["privacy.protection_minimal"]()}</li>
          <li>• {m["privacy.protection_no_sale"]()}</li>
        </ul>
      </div>

      <Separator />

      <div class="flex flex-wrap gap-2">
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-1"
        >
          <ExternalLinkIcon class="w-3 h-3" />
          {m["privacy.privacy_policy"]()}
        </a>
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-1"
        >
          <ExternalLinkIcon class="w-3 h-3" />
          {m["privacy.terms_of_service_link"]()}
        </a>
      </div>
    </Card.Content>
  </Card.Root>
</div>

<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { enhance } from "$app/forms";

  // Import icons
  import { SettingsIcon, UserIcon } from "$lib/icons/index.js";

  let { form, data } = $props();

  // Form state
  let isSubmitting = $state(false);

  // Reactive form values - initialize with current settings or form data
  let siteName = $state(form?.siteName || data?.settings?.siteName || "");
  let siteTitle = $state(form?.siteTitle || data?.settings?.siteTitle || "");
  let siteDescription = $state(
    form?.siteDescription || data?.settings?.siteDescription || ""
  );
  let selectedDefaultLanguage = $state(
    form?.defaultLanguage || data?.settings?.defaultLanguage || "en"
  );
  let selectedDefaultTheme = $state(
    form?.defaultTheme || data?.settings?.defaultTheme || "dark"
  );


  // Language options
  const languageOptions = [
    { value: "en", label: "English" },
    { value: "de", label: "German" },
    { value: "es", label: "Spanish" },
    { value: "pt", label: "Portuguese" },
  ];

  // Theme options
  const themeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  const languageLabel = $derived(
    languageOptions.find((lang) => lang.value === selectedDefaultLanguage)
      ?.label ?? "English"
  );

  const themeLabel = $derived(
    themeOptions.find((theme) => theme.value === selectedDefaultTheme)?.label ??
      "Dark"
  );

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

  // State sync effect
  $effect(() => {
    // Update reactive state when data changes (e.g., on page refresh or form reset)
    if (data?.settings && !form) {
      siteName = data.settings.siteName || "";
      siteTitle = data.settings.siteTitle || "";
      siteDescription = data.settings.siteDescription || "";
      selectedDefaultLanguage = data.settings.defaultLanguage || "en";
      selectedDefaultTheme = data.settings.defaultTheme || "dark";
    }
  });
</script>

<svelte:head>
  <title>General Settings - Admin Settings</title>
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
      <SettingsIcon class="w-6 h-6" />
      General Settings
    </h1>
    <p class="text-muted-foreground">
      Configure basic platform settings and information.
    </p>
  </div>

  <!-- Success Message -->
  {#if showSuccessMessage}
    <div
      class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md"
    >
      General settings have been saved successfully!
    </div>
  {/if}

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

    <!-- Basic Site Information -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <SettingsIcon class="w-5 h-5" />
          Site Information
        </Card.Title>
        <Card.Description
          >Basic information about your platform</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="siteName">Site Name</Label>
            <Input
              id="siteName"
              name="siteName"
              placeholder="AI Chat Interface"
              bind:value={siteName}
              disabled={data.isDemoMode}
              required
            />
            <p class="text-xs text-muted-foreground">
              The name displayed in the browser tab and throughout the app
            </p>
          </div>

          <div class="space-y-2">
            <Label for="siteTitle">Site Title</Label>
            <Input
              id="siteTitle"
              name="siteTitle"
              placeholder="AI Chat Interface - 65+ Models"
              bind:value={siteTitle}
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              SEO title used in meta tags
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="siteDescription">Site Description</Label>
          <Textarea
            id="siteDescription"
            name="siteDescription"
            placeholder="A unified web application for interacting with 65+ AI models from 9 different providers..."
            bind:value={siteDescription}
            disabled={data.isDemoMode}
            rows={3}
          />
          <p class="text-xs text-muted-foreground">
            Used for SEO meta descriptions and site information
          </p>
        </div>

      </Card.Content>
    </Card.Root>

    <!-- Default User Preferences -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <UserIcon class="w-5 h-5" />
          Default User Preferences
        </Card.Title>
        <Card.Description
          >Set default language and theme for new users. Individual users can
          still override these preferences.</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="defaultLanguage">Default Language</Label>
            <Select.Root
              type="single"
              name="defaultLanguage"
              bind:value={selectedDefaultLanguage}
              disabled={data.isDemoMode}
            >
              <Select.Trigger id="defaultLanguage">
                {languageLabel}
              </Select.Trigger>
              <Select.Content>
                {#each languageOptions as option}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            <p class="text-xs text-muted-foreground">
              The default language for new users
            </p>
          </div>

          <div class="space-y-2">
            <Label for="defaultTheme">Default Theme</Label>
            <Select.Root
              type="single"
              name="defaultTheme"
              bind:value={selectedDefaultTheme}
              disabled={data.isDemoMode}
            >
              <Select.Trigger id="defaultTheme">
                {themeLabel}
              </Select.Trigger>
              <Select.Content>
                {#each themeOptions as option}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            <p class="text-xs text-muted-foreground">
              The default theme mode for new users
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
              : "Save General Settings"}
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

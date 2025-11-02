<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import { enhance } from "$app/forms";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Button from "$lib/components/ui/button/index.js";
  import * as Input from "$lib/components/ui/input/index.js";
  import * as Label from "$lib/components/ui/label/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { EyeIcon, EyeOffIcon, MailIcon } from "$lib/icons/index.js";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let loading = $state(false);
  let showPassword = $state(false);

  // Individual reactive form variables - initialize with current settings or form data
  let smtpHost = $state(form?.smtpHost || data?.settings?.smtpHost || "");
  let smtpPort = $state(form?.smtpPort || data?.settings?.smtpPort || "");
  let smtpSecure = $state(form?.smtpSecure || data?.settings?.smtpSecure || "false");
  let smtpUser = $state(form?.smtpUser || data?.settings?.smtpUser || "");
  let smtpPass = $state(form?.smtpPass || data?.settings?.smtpPass || "");
  let fromEmail = $state(form?.fromEmail || data?.settings?.fromEmail || "");
  let fromName = $state(form?.fromName || data?.settings?.fromName || "");

  // State sync effect
  $effect(() => {
    // Update reactive state when data changes (e.g., on page refresh or form reset)
    if (data?.settings && !form) {
      smtpHost = data.settings.smtpHost || "";
      smtpPort = data.settings.smtpPort || "";
      smtpSecure = data.settings.smtpSecure || "false";
      smtpUser = data.settings.smtpUser || "";
      smtpPass = data.settings.smtpPass || "";
      fromEmail = data.settings.fromEmail || "";
      fromName = data.settings.fromName || "";
    }

    // Update from form state if there was a validation error or success response
    if (form) {
      smtpHost = form.smtpHost || "";
      smtpPort = form.smtpPort || "";
      smtpSecure = form.smtpSecure || "false";
      smtpUser = form.smtpUser || "";
      smtpPass = form.smtpPass || "";
      fromEmail = form.fromEmail || "";
      fromName = form.fromName || "";
    }
  });

  // Show success message for a few seconds
  let showSuccess = $state(false);
  $effect(() => {
    if (form?.success) {
      showSuccess = true;
      setTimeout(() => {
        showSuccess = false;
      }, 3000);
    }
  });

  // Security options for the dropdown
  const securityOptions = [
    { value: "false", label: "No (STARTTLS)" },
    { value: "true", label: "Yes (SSL/TLS)" },
  ];

  // Get selected security option
  const selectedSecurity = $derived(() => {
    return (
      securityOptions.find((opt) => opt.value === smtpSecure) ??
      securityOptions[0]
    );
  });
</script>

<svelte:head>
  <title>Mailing Settings - Admin</title>
</svelte:head>

<div class="space-y-4">
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

  <!-- Header -->
  <div>
    <h1 class="text-xl font-semibold tracking-tight flex items-center gap-2">
      <MailIcon class="w-6 h-6" />
      Mailing Settings
    </h1>
    <p class="text-muted-foreground">
      Configure SMTP settings for automated system emails. These settings take
      precedence over environment variables.
    </p>
  </div>

  <form
    method="POST"
    action="?/update"
    use:enhance={() => {
      loading = true;
      return async ({ update }) => {
        await update();
        loading = false;
      };
    }}
  >
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title>SMTP Configuration</Card.Title>
            <Card.Description>
              Configure your SMTP server settings for sending transactional
              emails such as welcome messages and password resets.
            </Card.Description>
          </div>
        </div>
      </Card.Header>

      <Card.Content class="space-y-6">
        <div class="space-y-6">
          <!-- SMTP Server Settings -->
          <div class="space-y-4">
            <div>
              <h3 class="text-lg font-medium">Server Settings</h3>
              <p class="text-sm text-muted-foreground">
                Configure your SMTP server connection details.
              </p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label.Root for="smtpHost">
                  SMTP Host <span class="text-destructive">*</span>
                </Label.Root>
                <Input.Root
                  id="smtpHost"
                  name="smtpHost"
                  type="text"
                  placeholder="smtp.gmail.com"
                  bind:value={smtpHost}
                  disabled={data.isDemoMode}
                  required
                />
                <p class="text-xs text-muted-foreground">
                  Your SMTP server hostname (e.g., smtp.gmail.com,
                  smtp.outlook.com)
                </p>
              </div>

              <div class="space-y-2">
                <Label.Root for="smtpPort">SMTP Port</Label.Root>
                <Input.Root
                  id="smtpPort"
                  name="smtpPort"
                  type="number"
                  placeholder="587"
                  bind:value={smtpPort}
                  disabled={data.isDemoMode}
                  min="1"
                  max="65535"
                />
                <p class="text-xs text-muted-foreground">
                  Common ports: 587 (STARTTLS), 465 (SSL), 25 (insecure)
                </p>
              </div>
            </div>

            <div class="space-y-2">
              <Label.Root for="smtpSecure">Security</Label.Root>
              <Select.Root
                type="single"
                name="smtpSecure"
                bind:value={smtpSecure}
                disabled={data.isDemoMode}
              >
                <Select.Trigger>
                  {selectedSecurity().label}
                </Select.Trigger>
                <Select.Content>
                  {#each securityOptions as option}
                    <Select.Item value={option.value} label={option.label}>
                      {option.label}
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
              <p class="text-xs text-muted-foreground">
                Choose "Yes" for port 465, "No" for ports 587/25 with STARTTLS
              </p>
            </div>
          </div>

          <Separator />

          <!-- Authentication -->
          <div class="space-y-4">
            <div>
              <h3 class="text-lg font-medium">Authentication</h3>
              <p class="text-sm text-muted-foreground">
                Your SMTP server login credentials.
              </p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label.Root for="smtpUser">
                  Username <span class="text-destructive">*</span>
                </Label.Root>
                <Input.Root
                  id="smtpUser"
                  name="smtpUser"
                  type="text"
                  placeholder="your-email@example.com"
                  bind:value={smtpUser}
                  disabled={data.isDemoMode}
                  required
                />
                <p class="text-xs text-muted-foreground">
                  Usually your email address
                </p>
              </div>

              <div class="space-y-2">
                <Label.Root for="smtpPass">
                  Password <span class="text-destructive">*</span>
                </Label.Root>
                <div class="relative">
                  <Input.Root
                    id="smtpPass"
                    name="smtpPass"
                    type={showPassword ? "text" : "password"}
                    placeholder="Your SMTP password"
                    bind:value={smtpPass}
                    disabled={data.isDemoMode}
                    required
                    class="pr-10"
                  />
                  <Button.Root
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onclick={() => (showPassword = !showPassword)}
                    disabled={data.isDemoMode}
                  >
                    {#if showPassword}
                      <EyeOffIcon class="h-4 w-4" />
                    {:else}
                      <EyeIcon class="h-4 w-4" />
                    {/if}
                    <span class="sr-only">
                      {showPassword ? "Hide" : "Show"} password
                    </span>
                  </Button.Root>
                </div>
                <p class="text-xs text-muted-foreground">
                  Use an app password for Gmail/Outlook. Stored encrypted.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Email Identity -->
          <div class="space-y-4">
            <div>
              <h3 class="text-lg font-medium">Email Identity</h3>
              <p class="text-sm text-muted-foreground">
                How emails will appear to recipients.
              </p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label.Root for="fromEmail">From Email</Label.Root>
                <Input.Root
                  id="fromEmail"
                  name="fromEmail"
                  type="email"
                  placeholder="noreply@yoursite.com"
                  bind:value={fromEmail}
                  disabled={data.isDemoMode}
                />
                <p class="text-xs text-muted-foreground">
                  Leave empty to use SMTP username
                </p>
              </div>

              <div class="space-y-2">
                <Label.Root for="fromName">From Name</Label.Root>
                <Input.Root
                  id="fromName"
                  name="fromName"
                  type="text"
                  placeholder="AI Models Platform"
                  bind:value={fromName}
                  disabled={data.isDemoMode}
                />
                <p class="text-xs text-muted-foreground">
                  Display name for outgoing emails
                </p>
              </div>
            </div>
          </div>

          <!-- Error Display -->
          {#if form?.error}
            <div class="rounded-md bg-destructive/15 p-3">
              <div class="flex">
                <div class="text-sm text-destructive">
                  {form.error}
                </div>
              </div>
            </div>
          {/if}

          <!-- Success Display -->
          {#if showSuccess}
            <div class="rounded-md bg-green-50 dark:bg-green-950/50 p-3">
              <div class="flex">
                <div class="text-sm text-green-700 dark:text-green-400">
                  Mailing settings saved successfully!
                </div>
              </div>
            </div>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Button positioned outside the card -->
    <div class="mt-4 space-y-2">
      <div class="flex justify-end">
        <Button.Root type="submit" disabled={loading || data.isDemoMode}>
          {loading ? "Saving..." : data.isDemoMode ? "Demo Mode - Read Only" : "Save Mailing Settings"}
        </Button.Root>
      </div>
      {#if data.isDemoMode}
        <p class="text-xs text-muted-foreground text-right">
          Saving is disabled in demo mode. This is a read-only demonstration.
        </p>
      {/if}
    </div>
  </form>
</div>

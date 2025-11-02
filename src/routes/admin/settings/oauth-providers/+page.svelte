<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { enhance } from "$app/forms";

  // Import icons
  import {
    KeyIcon,
    AlertTriangleIcon,
    CheckCircleIcon,
    ExternalLinkIcon,
    EyeIcon,
    EyeOffIcon,
  } from "$lib/icons/index.js";

  let { form, data } = $props();

  // Form state
  let isSubmitting = $state(false);
  let showGoogleSecret = $state(false);
  let showAppleSecret = $state(false);
  let showTwitterSecret = $state(false);
  let showFacebookSecret = $state(false);
  let showLinearSecret = $state(false);
  let showFathomApiKey = $state(false);

  // Reactive form values - initialize with current settings or form data
  // Note: Use strict equality (=== true) to ensure switches default to false when undefined
  // This matches the server-side logic that uses (=== 'true') for database values
  let googleEnabled = $state(
    form?.googleEnabled !== undefined
      ? form.googleEnabled
      : data?.settings?.googleEnabled === true
  );
  let googleClientId = $state(
    form?.googleClientId || data?.settings?.googleClientId || ""
  );
  let googleClientSecret = $state(
    form?.googleClientSecret || data?.settings?.googleClientSecret || ""
  );

  let appleEnabled = $state(
    form?.appleEnabled !== undefined
      ? form.appleEnabled
      : data?.settings?.appleEnabled === true
  );
  let appleClientId = $state(
    form?.appleClientId || data?.settings?.appleClientId || ""
  );
  let appleClientSecret = $state(
    form?.appleClientSecret || data?.settings?.appleClientSecret || ""
  );

  let twitterEnabled = $state(
    form?.twitterEnabled !== undefined
      ? form.twitterEnabled
      : data?.settings?.twitterEnabled === true
  );
  let twitterClientId = $state(
    form?.twitterClientId || data?.settings?.twitterClientId || ""
  );
  let twitterClientSecret = $state(
    form?.twitterClientSecret || data?.settings?.twitterClientSecret || ""
  );

  let facebookEnabled = $state(
    form?.facebookEnabled !== undefined
      ? form.facebookEnabled
      : data?.settings?.facebookEnabled === true
  );
  let facebookClientId = $state(
    form?.facebookClientId || data?.settings?.facebookClientId || ""
  );
  let facebookClientSecret = $state(
    form?.facebookClientSecret || data?.settings?.facebookClientSecret || ""
  );

  let linearEnabled = $state(
    form?.linearEnabled !== undefined
      ? form.linearEnabled
      : data?.settings?.linearEnabled === true
  );
  let linearClientId = $state(
    form?.linearClientId || data?.settings?.linearClientId || ""
  );
  let linearClientSecret = $state(
    form?.linearClientSecret || data?.settings?.linearClientSecret || ""
  );

  let fathomEnabled = $state(
    form?.fathomEnabled !== undefined
      ? form.fathomEnabled
      : data?.settings?.fathomEnabled === true
  );
  let fathomApiKey = $state(
    form?.fathomApiKey || data?.settings?.fathomApiKey || ""
  );

  // State sync effect
  $effect(() => {
    // Update reactive state when data changes (e.g., on page refresh or form reset)
    if (data?.settings && !form) {
      googleEnabled = data.settings.googleEnabled === true;
      googleClientId = data.settings.googleClientId || "";
      googleClientSecret = data.settings.googleClientSecret || "";
      appleEnabled = data.settings.appleEnabled === true;
      appleClientId = data.settings.appleClientId || "";
      appleClientSecret = data.settings.appleClientSecret || "";
      twitterEnabled = data.settings.twitterEnabled === true;
      twitterClientId = data.settings.twitterClientId || "";
      twitterClientSecret = data.settings.twitterClientSecret || "";
      facebookEnabled = data.settings.facebookEnabled === true;
      facebookClientId = data.settings.facebookClientId || "";
      facebookClientSecret = data.settings.facebookClientSecret || "";
      linearEnabled = data.settings.linearEnabled === true;
      linearClientId = data.settings.linearClientId || "";
      linearClientSecret = data.settings.linearClientSecret || "";
      fathomEnabled = data.settings.fathomEnabled === true;
      fathomApiKey = data.settings.fathomApiKey || "";
    }
  });

  // Function to mask sensitive keys
  function maskKey(key: string) {
    if (!key || key.length < 8) return key;
    return (
      key.substring(0, 8) +
      "•".repeat(key.length - 12) +
      key.substring(key.length - 4)
    );
  }

  // Check if providers are configured
  function isGoogleConfigured() {
    return googleClientId && googleClientSecret;
  }

  function isAppleConfigured() {
    return appleClientId && appleClientSecret;
  }

  function isTwitterConfigured() {
    return twitterClientId && twitterClientSecret;
  }

  function isFacebookConfigured() {
    return facebookClientId && facebookClientSecret;
  }

  function isLinearConfigured() {
    return linearClientId && linearClientSecret;
  }

  // Get the current domain for redirect URIs
  function getRedirectURI(provider: string) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/auth/callback/${provider}`;
    }
    return `https://yourdomain.com/auth/callback/${provider}`;
  }
</script>

<svelte:head>
  <title>OAuth Providers - Admin Settings</title>
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

  <!-- Page Header -->
  <div>
    <h1 class="text-xl font-semibold tracking-tight flex items-center gap-2">
      <KeyIcon class="w-6 h-6" />
      OAuth Providers
    </h1>
    <p class="text-muted-foreground">
      Configure social login providers for user authentication.
    </p>
  </div>

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
    <!--
      Hidden inputs for switch states - ensures reliable form submission
      Switch components handle UI interaction, these inputs handle form data
      This prevents issues where Switch components might not submit their state consistently
    -->
    <input
      type="hidden"
      name="googleEnabled"
      value={googleEnabled ? "on" : "off"}
    />
    <input
      type="hidden"
      name="appleEnabled"
      value={appleEnabled ? "on" : "off"}
    />
    <input
      type="hidden"
      name="twitterEnabled"
      value={twitterEnabled ? "on" : "off"}
    />
    <input
      type="hidden"
      name="facebookEnabled"
      value={facebookEnabled ? "on" : "off"}
    />
    <input
      type="hidden"
      name="linearEnabled"
      value={linearEnabled ? "on" : "off"}
    />
    <input
      type="hidden"
      name="fathomEnabled"
      value={fathomEnabled ? "on" : "off"}
    />

    <!-- Error Message -->
    {#if form?.error}
      <div
        class="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md"
      >
        {form.error}
      </div>
    {/if}

    <!-- Success Message -->
    {#if form?.success}
      <div
        class="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md"
      >
        OAuth provider settings updated successfully!
      </div>
    {/if}

    <!-- Google OAuth Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-blue-500 rounded flex items-center justify-center"
              >
                <span class="text-white text-xs font-bold">G</span>
              </div>
              Google OAuth
            </Card.Title>
            <Card.Description
              >Configure Google OAuth for social login</Card.Description
            >
          </div>
          <Switch bind:checked={googleEnabled} disabled={data.isDemoMode} />
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              Go to the <a
                href="https://console.developers.google.com/"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >Google Cloud Console <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Create or select a project</li>
            <li>Enable the Google+ API</li>
            <li>
              Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client
              IDs"
            </li>
            <li>Set Application type to "Web application"</li>
            <li>
              Add this redirect URI: <code
                class="px-1 bg-gray-100 rounded text-xs"
                >{getRedirectURI("google")}</code
              >
            </li>
          </ol>
        </div>

        <div class="grid grid-cols-1 gap-4">
          <div class="space-y-2">
            <Label for="googleClientId">Google Client ID</Label>
            <Input
              id="googleClientId"
              name="googleClientId"
              placeholder="1234567890-abcdefghijklmnop.apps.googleusercontent.com"
              bind:value={googleClientId}
              class="font-mono text-sm"
              disabled={data.isDemoMode}
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="googleClientSecret">Google Client Secret</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (showGoogleSecret = !showGoogleSecret)}
                class="h-auto p-1"
                disabled={data.isDemoMode}
              >
                {#if showGoogleSecret}
                  <EyeOffIcon class="w-4 h-4" />
                {:else}
                  <EyeIcon class="w-4 h-4" />
                {/if}
              </Button>
            </div>
            <Input
              id="googleClientSecret"
              name="googleClientSecret"
              type={showGoogleSecret ? "text" : "password"}
              placeholder="GOCSPX-..."
              bind:value={googleClientSecret}
              class="font-mono text-sm"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              <span class="text-red-600">⚠ Keep this secret!</span> Never expose
              this in client-side code
            </p>
          </div>

          <div class="space-y-2">
            <Label for="googleRedirectUri">Redirect URI</Label>
            <div class="p-3 bg-muted rounded-md">
              <code class="text-sm">{getRedirectURI("google")}</code>
            </div>
            <p class="text-xs text-muted-foreground">
              Add this exact URI to your Google OAuth app configuration
            </p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Apple OAuth Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-gray-800 rounded flex items-center justify-center"
              >
                <svg
                  class="w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                  />
                </svg>
              </div>
              Apple OAuth
            </Card.Title>
            <Card.Description
              >Configure Apple Sign-In for social login</Card.Description
            >
          </div>
          <Switch bind:checked={appleEnabled} disabled={data.isDemoMode} />
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              Go to the <a
                href="https://developer.apple.com/account/resources/identifiers/list/serviceId"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >Apple Developer Console <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Create or select your App ID</li>
            <li>Create a Service ID for web authentication</li>
            <li>Enable "Sign In with Apple" capability</li>
            <li>Configure your Service ID with web domain and return URL</li>
            <li>
              Add this redirect URI: <code
                class="px-1 bg-gray-100 rounded text-xs"
                >{getRedirectURI("apple")}</code
              >
            </li>
            <li>
              Get your Client Secret (can be a Client Secret, JWT, or Private
              Key)
            </li>
          </ol>
        </div>

        <div class="grid grid-cols-1 gap-4">
          <div class="space-y-2">
            <Label for="appleClientId">Apple Service ID (Client ID)</Label>
            <Input
              id="appleClientId"
              name="appleClientId"
              placeholder="com.yourcompany.yourapp"
              bind:value={appleClientId}
              class="font-mono text-sm"
              disabled={data.isDemoMode}
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="appleClientSecret">Apple Client Secret</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (showAppleSecret = !showAppleSecret)}
                class="h-auto p-1"
                disabled={data.isDemoMode}
              >
                {#if showAppleSecret}
                  <EyeOffIcon class="w-4 h-4" />
                {:else}
                  <EyeIcon class="w-4 h-4" />
                {/if}
              </Button>
            </div>
            <Input
              id="appleClientSecret"
              name="appleClientSecret"
              type={showAppleSecret ? "text" : "password"}
              placeholder="Client Secret, JWT, or Private Key..."
              bind:value={appleClientSecret}
              class="font-mono text-sm"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              <span class="text-red-600">⚠ Keep this secret!</span> Can be a Client
              Secret, JWT, or Private Key from Apple Developer Console
            </p>
          </div>

          <div class="space-y-2">
            <Label for="appleRedirectUri">Redirect URI</Label>
            <div class="p-3 bg-muted rounded-md">
              <code class="text-sm">{getRedirectURI("apple")}</code>
            </div>
            <p class="text-xs text-muted-foreground">
              Add this exact URI to your Apple Service ID configuration
            </p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- X (Twitter) OAuth Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-black rounded flex items-center justify-center"
              >
                <svg
                  class="w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                  />
                </svg>
              </div>
              X (Twitter) OAuth
            </Card.Title>
            <Card.Description
              >Configure X (formerly Twitter) OAuth for social login</Card.Description
            >
          </div>
          <Switch bind:checked={twitterEnabled} disabled={data.isDemoMode} />
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              Go to the <a
                href="https://developer.x.com/en/portal/dashboard"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >X Developer Portal <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Create a new App or select an existing one</li>
            <li>Navigate to "App settings" → "User authentication settings"</li>
            <li>Enable "OAuth 2.0" and set App permissions to "Read"</li>
            <li>Set Type of App to "Web App"</li>
            <li>
              Add this redirect URI: <code
                class="px-1 bg-gray-100 rounded text-xs"
                >{getRedirectURI("twitter")}</code
              >
            </li>
            <li>Save settings and copy your Client ID and Client Secret</li>
          </ol>
        </div>

        <div class="grid grid-cols-1 gap-4">
          <div class="space-y-2">
            <Label for="twitterClientId">X (Twitter) Client ID</Label>
            <Input
              id="twitterClientId"
              name="twitterClientId"
              placeholder="Your-App-Client-ID"
              bind:value={twitterClientId}
              class="font-mono text-sm"
              disabled={data.isDemoMode}
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="twitterClientSecret">X (Twitter) Client Secret</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (showTwitterSecret = !showTwitterSecret)}
                class="h-auto p-1"
                disabled={data.isDemoMode}
              >
                {#if showTwitterSecret}
                  <EyeOffIcon class="w-4 h-4" />
                {:else}
                  <EyeIcon class="w-4 h-4" />
                {/if}
              </Button>
            </div>
            <Input
              id="twitterClientSecret"
              name="twitterClientSecret"
              type={showTwitterSecret ? "text" : "password"}
              placeholder="Your-App-Client-Secret"
              bind:value={twitterClientSecret}
              class="font-mono text-sm"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              <span class="text-red-600">⚠ Keep this secret!</span> Never expose
              this in client-side code
            </p>
          </div>

          <div class="space-y-2">
            <Label for="twitterRedirectUri">Redirect URI</Label>
            <div class="p-3 bg-muted rounded-md">
              <code class="text-sm">{getRedirectURI("twitter")}</code>
            </div>
            <p class="text-xs text-muted-foreground">
              Add this exact URI to your X Developer Portal app configuration
            </p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Facebook OAuth Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-[#1877F2] rounded flex items-center justify-center"
              >
                <svg
                  class="w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                  />
                </svg>
              </div>
              Facebook OAuth
            </Card.Title>
            <Card.Description
              >Configure Facebook Login for social authentication</Card.Description
            >
          </div>
          <Switch bind:checked={facebookEnabled} disabled={data.isDemoMode} />
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              Go to the <a
                href="https://developers.facebook.com/apps/"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >Meta for Developers <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Create a new App or select an existing one</li>
            <li>Add "Facebook Login" product to your app</li>
            <li>Navigate to Facebook Login → Settings</li>
            <li>Add this redirect URI to "Valid OAuth Redirect URIs":</li>
            <li>
              <code class="px-1 bg-gray-100 rounded text-xs"
                >{getRedirectURI("facebook")}</code
              >
            </li>
            <li>Go to Settings → Basic to find your App ID and App Secret</li>
            <li>Make sure your app is in "Live" mode for production use</li>
            <li>
              <strong>Note:</strong> This integration uses only basic profile info
              (no email access without app review)
            </li>
          </ol>
        </div>

        <div class="grid grid-cols-1 gap-4">
          <div class="space-y-2">
            <Label for="facebookClientId">Facebook App ID</Label>
            <Input
              id="facebookClientId"
              name="facebookClientId"
              placeholder="1234567890123456"
              bind:value={facebookClientId}
              class="font-mono text-sm"
              disabled={data.isDemoMode}
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="facebookClientSecret">Facebook App Secret</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (showFacebookSecret = !showFacebookSecret)}
                class="h-auto p-1"
                disabled={data.isDemoMode}
              >
                {#if showFacebookSecret}
                  <EyeOffIcon class="w-4 h-4" />
                {:else}
                  <EyeIcon class="w-4 h-4" />
                {/if}
              </Button>
            </div>
            <Input
              id="facebookClientSecret"
              name="facebookClientSecret"
              type={showFacebookSecret ? "text" : "password"}
              placeholder="abcdefghijklmnopqrstuvwxyz123456"
              bind:value={facebookClientSecret}
              class="font-mono text-sm"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              <span class="text-red-600">⚠ Keep this secret!</span> Never expose
              this in client-side code
            </p>
          </div>

          <div class="space-y-2">
            <Label for="facebookRedirectUri">Redirect URI</Label>
            <div class="p-3 bg-muted rounded-md">
              <code class="text-sm">{getRedirectURI("facebook")}</code>
            </div>
            <p class="text-xs text-muted-foreground">
              Add this exact URI to your Facebook Login settings under "Valid
              OAuth Redirect URIs"
            </p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Linear OAuth Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-[#5E6AD2] rounded flex items-center justify-center"
              >
                <svg
                  class="w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818-5.42 0-9.818-4.398-9.818-9.818 0-5.42 4.398-9.818 9.818-9.818zm-1.09 4.364v9.818l6.545-6.545-1.545-1.545-4.09 4.09V6.545h-2.182z"
                  />
                </svg>
              </div>
              Linear
            </Card.Title>
            <Card.Description
              >Used for Client Portal project management</Card.Description
            >
          </div>
          <Switch bind:checked={linearEnabled} disabled={data.isDemoMode} />
        </div>
      </Card.Header>
      {#if linearEnabled}
        <Card.Content class="space-y-4">
          <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
            <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>
                Go to <a
                  href="https://linear.app/settings/api/applications"
                  target="_blank"
                  class="underline inline-flex items-center gap-1"
                  >Linear API Applications <ExternalLinkIcon class="w-3 h-3" /></a
                >
              </li>
              <li>Create a new OAuth application</li>
              <li>Set the callback URL to:</li>
              <li>
                <code class="px-1 bg-gray-100 rounded text-xs"
                  >{getRedirectURI("linear")}</code
                >
              </li>
              <li>Copy your Client ID and Client Secret</li>
            </ol>
          </div>

          <div class="grid grid-cols-1 gap-4">
            <div class="space-y-2">
              <Label for="linearClientId">Client ID</Label>
              <Input
                id="linearClientId"
                name="linearClientId"
                placeholder="your-linear-client-id"
                bind:value={linearClientId}
                class="font-mono text-sm"
                disabled={data.isDemoMode}
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label for="linearClientSecret">Client Secret</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onclick={() => (showLinearSecret = !showLinearSecret)}
                  class="h-auto p-1"
                  disabled={data.isDemoMode}
                >
                  {#if showLinearSecret}
                    <EyeOffIcon class="w-4 h-4" />
                  {:else}
                    <EyeIcon class="w-4 h-4" />
                  {/if}
                </Button>
              </div>
              <Input
                id="linearClientSecret"
                name="linearClientSecret"
                type={showLinearSecret ? "text" : "password"}
                placeholder="your-linear-client-secret"
                bind:value={linearClientSecret}
                class="font-mono text-sm"
                disabled={data.isDemoMode}
              />
              <p class="text-xs text-muted-foreground">
                <span class="text-red-600">⚠ Keep this secret!</span> Never expose
                this in client-side code
              </p>
            </div>

            <div class="space-y-2">
              <Label for="linearRedirectUri">Redirect URI</Label>
              <div class="p-3 bg-muted rounded-md flex items-center justify-between">
                <code class="text-sm">{getRedirectURI("linear")}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onclick={() => {
                    navigator.clipboard.writeText(getRedirectURI("linear"));
                  }}
                >
                  Copy
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                Add this exact URI to your Linear OAuth application configuration
              </p>
            </div>

            <!-- Linear Setup Instructions -->
            <div class="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div class="flex items-start gap-2">
                <AlertTriangleIcon class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div class="space-y-2">
                  <h4 class="font-medium text-blue-900">⚠️ Important: Configure Redirect URI in Linear</h4>
                  <p class="text-sm text-blue-800">If you see an "Invalid redirect_uri parameter" error, you need to register the callback URL in Linear's OAuth app settings.</p>
                  <div class="mt-3 space-y-2">
                    <p class="text-sm font-medium text-blue-900">Setup Steps:</p>
                    <ol class="text-sm text-blue-800 space-y-2 list-decimal list-inside ml-2">
                      <li class="ml-2">Log in to <a href="https://linear.app" target="_blank" rel="noopener noreferrer" class="underline hover:text-blue-600 font-medium">Linear</a></li>
                      <li class="ml-2">Go to <strong>Settings → API → OAuth Applications</strong></li>
                      <li class="ml-2">Click on your OAuth application (Client ID: <code class="bg-blue-100 px-1 rounded text-xs font-mono">{linearClientId || "your-client-id"}</code>)</li>
                      <li class="ml-2">In the <strong>"Callback URLs"</strong> field, add EXACTLY (copy from button above):
                        <div class="mt-1 p-2 bg-white border border-blue-200 rounded font-mono text-xs">
                          {getRedirectURI("linear")}
                        </div>
                      </li>
                      <li class="ml-2"><strong class="text-red-700">IMPORTANT:</strong> Click the <strong>"Save"</strong> or <strong>"Update application"</strong> button in Linear</li>
                      <li class="ml-2">Wait 10-30 seconds for Linear to process the update</li>
                      <li class="ml-2">Then try signing in again - the error should be gone</li>
                    </ol>
                    <div class="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p class="text-xs text-yellow-800">
                        <strong>Common Issues:</strong><br/>
                        • Make sure there are NO trailing slashes<br/>
                        • The URL must match EXACTLY (https, not http)<br/>
                        • Don't forget to click Save in Linear!<br/>
                        • For local dev, also add: <code class="bg-yellow-100 px-1">http://localhost:5173/auth/callback/linear</code>
                      </p>
                    </div>
                  </div>
                  <p class="text-xs text-blue-700 mt-3">
                    <strong>Technical Note:</strong> Auth.js automatically constructs callback URLs as <code class="bg-blue-100 px-1 rounded">{"{PUBLIC_ORIGIN}"}/auth/callback/{"{provider-id}"}</code>. Linear requires exact matches for registered redirect URIs. This is external configuration - the code implementation is correct.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card.Content>
      {/if}
    </Card.Root>

    <!-- Fathom Meeting Intelligence Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div class="w-6 h-6 bg-[#7C5CFC] rounded flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              Fathom
            </Card.Title>
            <Card.Description>Meeting intelligence and client insights</Card.Description>
          </div>
          <Switch bind:checked={fathomEnabled} disabled={data.isDemoMode} />
        </div>
      </Card.Header>
      {#if fathomEnabled}
        <Card.Content class="space-y-4">
          <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
            <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>
                Go to <a
                  href="https://app.fathom.video/settings/developers"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Fathom API Settings
                  <ExternalLinkIcon class="w-3 h-3" />
                </a>
              </li>
              <li>Click "Create New API Key"</li>
              <li>Give it a name (e.g., "WeaveAI Enterprise")</li>
              <li>Copy the API key</li>
              <li>Paste it below</li>
            </ol>
          </div>

          <div class="grid grid-cols-1 gap-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label for="fathomApiKey">API Key</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-8 px-2"
                  onclick={() => (showFathomApiKey = !showFathomApiKey)}
                >
                  {#if showFathomApiKey}
                    <EyeOffIcon class="w-4 h-4" />
                  {:else}
                    <EyeIcon class="w-4 h-4" />
                  {/if}
                </Button>
              </div>
              <Input
                id="fathomApiKey"
                name="fathomApiKey"
                type={showFathomApiKey ? "text" : "password"}
                bind:value={fathomApiKey}
                placeholder="your_fathom_api_key_here"
                disabled={data.isDemoMode}
              />
              <p class="text-xs text-muted-foreground">
                <span class="text-red-600">⚠ Keep this secret!</span> This API key provides access to all your meeting data
              </p>
            </div>
          </div>
        </Card.Content>
      {/if}
    </Card.Root>

    <!-- Submit Button -->
    <div class="space-y-2">
      <div class="flex justify-end">
        <Button type="submit" disabled={isSubmitting || data.isDemoMode}>
          {isSubmitting ? "Saving..." : data.isDemoMode ? "Demo Mode - Read Only" : "Save OAuth Settings"}
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

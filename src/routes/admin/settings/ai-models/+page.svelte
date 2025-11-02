<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { enhance } from "$app/forms";

  // Import icons
  import {
    BrainIcon,
    CheckCircleIcon,
    ExternalLinkIcon,
    EyeIcon,
    EyeOffIcon,
  } from "$lib/icons/index.js";

  let { form, data } = $props();

  // Form state
  let isSubmitting = $state(false);
  let showKeys = $state(false);

  // Reactive form values - initialize with current settings or form data
  let openrouterApiKey = $state(
    form?.openrouterApiKey || data?.settings?.openrouterApiKey || ""
  );
  let geminiApiKey = $state(
    form?.geminiApiKey || data?.settings?.geminiApiKey || ""
  );
  let openaiApiKey = $state(
    form?.openaiApiKey || data?.settings?.openaiApiKey || ""
  );
  let xaiApiKey = $state(form?.xaiApiKey || data?.settings?.xaiApiKey || "");
  let stabilityaiApiKey = $state(
    form?.stabilityaiApiKey || data?.settings?.stabilityaiApiKey || ""
  );
  let bflApiKey = $state(form?.bflApiKey || data?.settings?.bflApiKey || "");
  let alibabaApiKey = $state(
    form?.alibabaApiKey || data?.settings?.alibabaApiKey || ""
  );
  let lumalabsApiKey = $state(
    form?.lumalabsApiKey || data?.settings?.lumalabsApiKey || ""
  );
  let klingApiAccessKey = $state(
    form?.klingApiAccessKey || data?.settings?.klingApiAccessKey || ""
  );
  let klingApiSecretKey = $state(
    form?.klingApiSecretKey || data?.settings?.klingApiSecretKey || ""
  );

  // Function to mask sensitive keys
  function maskKey(key: string) {
    if (!key || key.length < 8) return key;
    return key.substring(0, 8) + "•".repeat(key.length - 8);
  }

  // Derived display values for password fields
  $effect(() => {
    // Update reactive state when data changes (e.g., on page refresh or form reset)
    if (data?.settings && !form) {
      openrouterApiKey = data.settings.openrouterApiKey || "";
      geminiApiKey = data.settings.geminiApiKey || "";
      openaiApiKey = data.settings.openaiApiKey || "";
      xaiApiKey = data.settings.xaiApiKey || "";
      stabilityaiApiKey = data.settings.stabilityaiApiKey || "";
      bflApiKey = data.settings.bflApiKey || "";
      alibabaApiKey = data.settings.alibabaApiKey || "";
      lumalabsApiKey = data.settings.lumalabsApiKey || "";
      klingApiAccessKey = data.settings.klingApiAccessKey || "";
      klingApiSecretKey = data.settings.klingApiSecretKey || "";
    }
  });

  // Check if providers are configured
  function isOpenRouterConfigured() {
    return openrouterApiKey;
  }

  function isGeminiConfigured() {
    return geminiApiKey;
  }

  function isOpenAIConfigured() {
    return openaiApiKey;
  }

  function isXAIConfigured() {
    return xaiApiKey;
  }

  function isStabilityAIConfigured() {
    return stabilityaiApiKey;
  }

  function isBFLConfigured() {
    return bflApiKey;
  }

  function isAlibabaConfigured() {
    return alibabaApiKey;
  }

  function isLumaLabsConfigured() {
    return lumalabsApiKey;
  }

  function isKlingConfigured() {
    return klingApiAccessKey && klingApiSecretKey;
  }
</script>

<svelte:head>
  <title>AI Models - Admin Settings</title>
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
      <BrainIcon class="w-6 h-6" />
      AI Models Configuration
    </h1>
    <p class="text-muted-foreground">
      Configure API keys for all 9 AI model providers.
    </p>
  </div>

  <!-- Show/Hide Keys Toggle -->
  <div class="flex items-center gap-2">
    <Switch bind:checked={showKeys} disabled={data.isDemoMode} />
    <Label class="flex items-center gap-2">
      {#if showKeys}
        <EyeOffIcon class="w-4 h-4" />
        Hide all API Keys
      {:else}
        <EyeIcon class="w-4 h-4" />
        Show all API Keys
      {/if}
    </Label>
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
        AI model settings updated successfully!
      </div>
    {/if}

    <!-- OpenRouter Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-orange-500 rounded flex items-center justify-center"
              >
                <span class="text-white text-xs font-bold">OR</span>
              </div>
              OpenRouter
              {#if isOpenRouterConfigured()}
                <CheckCircleIcon class="w-4 h-4 text-green-500" />
              {/if}
            </Card.Title>
            <Card.Description
              >Integrate to access various text models from multiple providers.</Card.Description
            >
          </div>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol
            class="text-sm text-gray-700 space-y-1 list-decimal list-inside"
          >
            <li>
              Go to <a
                href="https://openrouter.ai/"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >OpenRouter.ai <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Sign up or log in to your account</li>
            <li>Navigate to "Keys" in your dashboard</li>
            <li>Create a new API key</li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>

        <div class="space-y-2">
          <Label for="openrouterApiKey">OpenRouter API Key</Label>
          <Input
            id="openrouterApiKey"
            name="openrouterApiKey"
            type={showKeys ? "text" : "password"}
            placeholder="sk-or-..."
            bind:value={openrouterApiKey}
            class="font-mono"
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            Enables access to 35+ text models including GPT, Claude, Gemini,
            Grok, DeepSeek, Qwen, Kimi, GLM, Llama, and more...
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Google Gemini Configuration -->
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
              Google Gemini
              {#if isGeminiConfigured()}
                <CheckCircleIcon class="w-4 h-4 text-green-500" />
              {/if}
            </Card.Title>
            <Card.Description
              >Integrate for Image and Video generation models.</Card.Description
            >
          </div>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              Go to <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >Google AI Studio <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Create a new API key</li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>

        <div class="space-y-2">
          <Label for="geminiApiKey">Google Gemini API Key</Label>
          <Input
            id="geminiApiKey"
            name="geminiApiKey"
            type={showKeys ? "text" : "password"}
            placeholder="AIza..."
            bind:value={geminiApiKey}
            class="font-mono"
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            Enables Gemini 2.5 Flash Image (Nano Banana), Gemini 2.0 Flash
            Image, Imagen 4, Imagen 4 Ultra, Imagen 3, Veo 3 Video, Veo 2 Video
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- OpenAI Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-green-600 rounded flex items-center justify-center"
              >
                <span class="text-white text-xs font-bold">AI</span>
              </div>
              OpenAI
              {#if isOpenAIConfigured()}
                <CheckCircleIcon class="w-4 h-4 text-green-500" />
              {/if}
            </Card.Title>
            <Card.Description
              >Integrate for Image generation and editing models.</Card.Description
            >
          </div>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              Go to <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >OpenAI Platform <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Create a new API key</li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>

        <div class="space-y-2">
          <Label for="openaiApiKey">OpenAI API Key</Label>
          <Input
            id="openaiApiKey"
            name="openaiApiKey"
            type={showKeys ? "text" : "password"}
            placeholder="sk-..."
            bind:value={openaiApiKey}
            class="font-mono"
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            Enables GPT Image 1, DALL-E 2, DALL-E 3 models
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- xAI Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-black rounded flex items-center justify-center"
              >
                <span class="text-white text-xs font-bold">X</span>
              </div>
              xAI
              {#if isXAIConfigured()}
                <CheckCircleIcon class="w-4 h-4 text-green-500" />
              {/if}
            </Card.Title>
            <Card.Description
              >Integrate for Grok-2-Image image generation model.</Card.Description
            >
          </div>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              Go to <a
                href="https://console.x.ai/"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >xAI Console <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Create a new API key</li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>

        <div class="space-y-2">
          <Label for="xaiApiKey">xAI API Key</Label>
          <Input
            id="xaiApiKey"
            name="xaiApiKey"
            type={showKeys ? "text" : "password"}
            placeholder="xai-..."
            bind:value={xaiApiKey}
            class="font-mono"
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            Enables Grok-2-Image model for high-quality image generation
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Stability AI Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-purple-500 rounded flex items-center justify-center"
              >
                <span class="text-white text-xs font-bold">S</span>
              </div>
              Stability AI
              {#if isStabilityAIConfigured()}
                <CheckCircleIcon class="w-4 h-4 text-green-500" />
              {/if}
            </Card.Title>
            <Card.Description
              >Integrate for various Stable Diffusion image generation models.</Card.Description
            >
          </div>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol
            class="text-sm text-gray-700 space-y-1 list-decimal list-inside"
          >
            <li>
              Go to <a
                href="https://platform.stability.ai/account/keys"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >Stability AI Platform <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Create a new API key</li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>

        <div class="space-y-2">
          <Label for="stabilityaiApiKey">Stability AI API Key</Label>
          <Input
            id="stabilityaiApiKey"
            name="stabilityaiApiKey"
            type={showKeys ? "text" : "password"}
            placeholder="sk-..."
            bind:value={stabilityaiApiKey}
            class="font-mono"
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            Enables Stable Diffusion 3.5 models including Large, Large Turbo,
            Medium, Flash, and Stable Image Ultra, Stable Image Core
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Black Forest Labs Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-red-500 rounded flex items-center justify-center"
              >
                <span class="text-white text-xs font-bold">BFL</span>
              </div>
              Black Forest Labs
              {#if isBFLConfigured()}
                <CheckCircleIcon class="w-4 h-4 text-green-500" />
              {/if}
            </Card.Title>
            <Card.Description
              >Integrate for BFL FLUX image generation models.</Card.Description
            >
          </div>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              Go to <a
                href="https://api.bfl.ml/"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >BFL API <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Create an account and get your API key</li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>

        <div class="space-y-2">
          <Label for="bflApiKey">Black Forest Labs API Key</Label>
          <Input
            id="bflApiKey"
            name="bflApiKey"
            type={showKeys ? "text" : "password"}
            placeholder="Your BFL API key..."
            bind:value={bflApiKey}
            class="font-mono"
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            Enables FLUX.1 Kontext Pro/Max and FLUX.1.1 Pro/Ultra models
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Alibaba Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-orange-600 rounded flex items-center justify-center"
              >
                <span class="text-white text-xs font-bold">A</span>
              </div>
              Alibaba
              {#if isAlibabaConfigured()}
                <CheckCircleIcon class="w-4 h-4 text-green-500" />
              {/if}
            </Card.Title>
            <Card.Description
              >Integrate Wan for image and video generation models.</Card.Description
            >
          </div>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol
            class="text-sm text-gray-700 space-y-1 list-decimal list-inside"
          >
            <li>Contact Alibaba for API access to Wan models</li>
            <li>Obtain your API key from Alibaba Cloud</li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>

        <div class="space-y-2">
          <Label for="alibabaApiKey">Alibaba API Key</Label>
          <Input
            id="alibabaApiKey"
            name="alibabaApiKey"
            type={showKeys ? "text" : "password"}
            placeholder="Your Alibaba API key..."
            bind:value={alibabaApiKey}
            class="font-mono"
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            Enables Wan 2.2 T2V Plus, I2V Plus, T2I Flash, and T2I Plus models
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Luma Labs Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-cyan-500 rounded flex items-center justify-center"
              >
                <span class="text-white text-xs font-bold">L</span>
              </div>
              Luma Labs
              {#if isLumaLabsConfigured()}
                <CheckCircleIcon class="w-4 h-4 text-green-500" />
              {/if}
            </Card.Title>
            <Card.Description
              >Integrate for image and video generation models.</Card.Description
            >
          </div>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              Go to <a
                href="https://lumalabs.ai/"
                target="_blank"
                class="underline inline-flex items-center gap-1"
                >Luma Labs <ExternalLinkIcon class="w-3 h-3" /></a
              >
            </li>
            <li>Create an account and access the API section</li>
            <li>Generate an API key</li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>

        <div class="space-y-2">
          <Label for="lumalabsApiKey">Luma Labs API Key</Label>
          <Input
            id="lumalabsApiKey"
            name="lumalabsApiKey"
            type={showKeys ? "text" : "password"}
            placeholder="Your Luma Labs API key..."
            bind:value={lumalabsApiKey}
            class="font-mono"
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            Enables Photon-1, Photon Flash-1, Ray-2, and Ray Flash-2 models
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Kling AI Configuration -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <div
                class="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center"
              >
                <span class="text-white text-xs font-bold">K</span>
              </div>
              Kling AI
              {#if isKlingConfigured()}
                <CheckCircleIcon class="w-4 h-4 text-green-500" />
              {/if}
            </Card.Title>
            <Card.Description
              >Integrate for image and video generation models.</Card.Description
            >
          </div>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 class="font-medium text-gray-800 mb-2">Setup Instructions:</h4>
          <ol
            class="text-sm text-gray-700 space-y-1 list-decimal list-inside"
          >
            <li>Contact Kling AI for API access</li>
            <li>Obtain both Access Key and Secret Key</li>
            <li>Both keys are required for JWT authentication</li>
            <li>Copy both keys and paste them below</li>
          </ol>
        </div>

        <div class="grid grid-cols-1 gap-4">
          <div class="space-y-2">
            <Label for="klingApiAccessKey">Kling API Access Key</Label>
            <Input
              id="klingApiAccessKey"
              name="klingApiAccessKey"
              type={showKeys ? "text" : "password"}
              placeholder="Your Kling Access Key..."
              bind:value={klingApiAccessKey}
              class="font-mono"
              disabled={data.isDemoMode}
            />
          </div>

          <div class="space-y-2">
            <Label for="klingApiSecretKey">Kling API Secret Key</Label>
            <Input
              id="klingApiSecretKey"
              name="klingApiSecretKey"
              type={showKeys ? "text" : "password"}
              placeholder="Your Kling Secret Key..."
              bind:value={klingApiSecretKey}
              class="font-mono"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              <span class="text-red-600">⚠ Both keys required!</span> Enables Kling
              v2 Image and v2/v2.1 Master Video models
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
              : "Save AI Model Settings"}
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

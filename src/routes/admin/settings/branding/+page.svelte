<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { enhance } from "$app/forms";

  // Import icons
  import { PaletteIcon, UploadIcon, ImageIcon } from "$lib/icons/index.js";

  let { form, data } = $props();

  // Form state
  let isSubmitting = $state(false);
  let fileInputDark = $state<HTMLInputElement>();
  let fileInputLight = $state<HTMLInputElement>();
  let fileInputFavicon = $state<HTMLInputElement>();

  // Reactive form values - initialize with current settings or form data
  let logoWidth = $state(form?.logoWidth || data?.settings?.logoWidth || "170");
  let logoHeight = $state(
    form?.logoHeight || data?.settings?.logoHeight || "27"
  );

  // State sync effect
  $effect(() => {
    // Update reactive state when data changes (e.g., on page refresh or form reset)
    if (data?.settings && !form) {
      logoWidth = data.settings.logoWidth || "170";
      logoHeight = data.settings.logoHeight || "27";
    }
  });

  function validateImageFile(file: File, target: HTMLInputElement): boolean {
    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file");
      target.value = "";
      return false;
    }

    // Check file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB");
      target.value = "";
      return false;
    }

    return true;
  }

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      validateImageFile(file, target);
    }
  }

  function triggerDarkFileUpload() {
    fileInputDark?.click();
  }

  function triggerLightFileUpload() {
    fileInputLight?.click();
  }

  function triggerFaviconFileUpload() {
    fileInputFavicon?.click();
  }
</script>

<svelte:head>
  <title>Branding Settings - Admin Settings</title>
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
      <PaletteIcon class="w-6 h-6" />
      Branding Settings
    </h1>
    <p class="text-muted-foreground">
      Customize your app's appearance and branding elements.
    </p>
  </div>

  <!-- Form -->
  <form
    method="POST"
    action="?/update"
    enctype="multipart/form-data"
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
        Branding settings updated successfully!
      </div>
    {/if}

    <!-- Logo Settings -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <ImageIcon class="w-5 h-5" />
          App Logos
        </Card.Title>
        <Card.Description
          >Upload separate logos for dark and light mode themes</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Logo Upload Sections - Side by Side -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Dark Mode Logo Section -->
          <div class="space-y-4">
            <Label class="text-base font-medium">Dark Mode Logo</Label>

            <!-- Current Dark Logo Display -->
            <div class="space-y-2">
              <div
                class="w-32 h-32 bg-gray-900 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600"
              >
                {#if form?.currentLogoDark || data?.settings?.currentLogoDark}
                  <img
                    src={form?.currentLogoDark ||
                      data?.settings?.currentLogoDark}
                    alt="Current dark logo"
                    class="max-w-full max-h-full object-contain"
                  />
                {:else}
                  <div class="text-center">
                    <ImageIcon class="w-8 h-8 mx-auto mb-1 text-gray-400" />
                    <p class="text-xs text-gray-400">No dark logo uploaded</p>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Dark Logo Upload -->
            <div class="space-y-2">
              <input
                bind:this={fileInputDark}
                type="file"
                id="logoDark"
                name="logoDark"
                accept="image/*"
                onchange={handleFileChange}
                class="hidden"
              />
              <Button
                type="button"
                variant="outline"
                class="w-full justify-center gap-2"
                onclick={triggerDarkFileUpload}
                disabled={data.isDemoMode}
              >
                <UploadIcon class="w-4 h-4" />
                Upload Dark Mode Logo
              </Button>
            </div>
          </div>

          <!-- Light Mode Logo Section -->
          <div class="space-y-4">
            <Label class="text-base font-medium">Light Mode Logo</Label>

            <!-- Current Light Logo Display -->
            <div class="space-y-2">
              <div
                class="w-32 h-32 bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300"
              >
                {#if form?.currentLogoLight || data?.settings?.currentLogoLight}
                  <img
                    src={form?.currentLogoLight ||
                      data?.settings?.currentLogoLight}
                    alt="Current light logo"
                    class="max-w-full max-h-full object-contain"
                  />
                {:else}
                  <div class="text-center">
                    <ImageIcon class="w-8 h-8 mx-auto mb-1 text-gray-500" />
                    <p class="text-xs text-gray-500">No light logo uploaded</p>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Light Logo Upload -->
            <div class="space-y-2">
              <input
                bind:this={fileInputLight}
                type="file"
                id="logoLight"
                name="logoLight"
                accept="image/*"
                onchange={handleFileChange}
                class="hidden"
              />
              <Button
                type="button"
                variant="outline"
                class="w-full justify-center gap-2"
                onclick={triggerLightFileUpload}
                disabled={data.isDemoMode}
              >
                <UploadIcon class="w-4 h-4" />
                Upload Light Mode Logo
              </Button>
            </div>
          </div>
        </div>

        <!-- General Info -->
        <div class="p-4 bg-muted/50 rounded-lg">
          <p class="text-xs text-muted-foreground">
            <strong>Recommendation:</strong> PNG or SVG format with transparent background.
          </p>
        </div>

        <!-- Logo Settings -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="logoWidth">Logo Width (px)</Label>
            <Input
              id="logoWidth"
              name="logoWidth"
              type="number"
              min="16"
              max="512"
              placeholder="170"
              bind:value={logoWidth}
              disabled={data.isDemoMode}
            />
          </div>

          <div class="space-y-2">
            <Label for="logoHeight">Logo Height (px)</Label>
            <Input
              id="logoHeight"
              name="logoHeight"
              type="number"
              min="16"
              max="512"
              placeholder="27"
              bind:value={logoHeight}
              disabled={data.isDemoMode}
            />
          </div>
        </div>

        <!-- Logo Dimension Preview -->
        {#if form?.currentLogoDark || data?.settings?.currentLogoDark || form?.currentLogoLight || data?.settings?.currentLogoLight}
          <div class="space-y-4">
            <div class="border-t pt-4">
              <Label class="text-base font-medium">Logo Size Preview</Label>
              <p class="text-sm text-muted-foreground mb-4">
                Preview of how your logos will appear with the specified
                dimensions
              </p>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Dark Logo Preview -->
                {#if form?.currentLogoDark || data?.settings?.currentLogoDark}
                  <div class="space-y-2">
                    <Label class="text-sm font-medium">Dark Mode Preview</Label>
                    <div
                      class="p-4 bg-gray-900 rounded-lg flex items-center justify-center min-h-[80px]"
                    >
                      <img
                        src={form?.currentLogoDark ||
                          data?.settings?.currentLogoDark}
                        alt="Dark logo preview"
                        style="width: {logoWidth}px; height: {logoHeight}px;"
                        class="object-contain"
                      />
                    </div>
                  </div>
                {/if}

                <!-- Light Logo Preview -->
                {#if form?.currentLogoLight || data?.settings?.currentLogoLight}
                  <div class="space-y-2">
                    <Label class="text-sm font-medium">Light Mode Preview</Label
                    >
                    <div
                      class="p-4 bg-white border rounded-lg flex items-center justify-center min-h-[80px]"
                    >
                      <img
                        src={form?.currentLogoLight ||
                          data?.settings?.currentLogoLight}
                        alt="Light logo preview"
                        style="width: {logoWidth}px; height: {logoHeight}px;"
                        class="object-contain"
                      />
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- Favicon Settings Section -->
        <div class="border-t pt-6">
          <div class="mb-4">
            <h3 class="text-base font-medium">App Favicon</h3>
            <p class="text-sm text-muted-foreground">
              Upload a custom favicon for your site that will appear in browser
              tabs
            </p>
          </div>

          <!-- Favicon Upload Section -->
          <div class="space-y-4">
            <!-- Current Favicon Display -->
            <div class="space-y-2">
              <div
                class="w-21 h-21 bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 shadow-sm"
              >
                {#if form?.currentFavicon || data?.settings?.currentFavicon}
                  <img
                    src={form?.currentFavicon || data?.settings?.currentFavicon}
                    alt="Current favicon"
                    class="max-w-full max-h-full object-contain"
                  />
                {:else}
                  <div class="text-center">
                    <ImageIcon class="w-6 h-6 mx-auto mb-1 text-gray-500" />
                    <p class="text-xs text-gray-500">No favicon uploaded</p>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Favicon Upload -->
            <div class="space-y-2">
              <input
                bind:this={fileInputFavicon}
                type="file"
                id="favicon"
                name="favicon"
                accept="image/x-icon,image/png,image/svg+xml,image/gif,image/jpeg"
                onchange={handleFileChange}
                class="hidden"
              />
              <Button
                type="button"
                variant="outline"
                class="w-full justify-center gap-2 max-w-xs"
                onclick={triggerFaviconFileUpload}
                disabled={data.isDemoMode}
              >
                <UploadIcon class="w-4 h-4" />
                Upload Favicon
              </Button>
            </div>

            <!-- Favicon Info -->
            <div class="p-4 bg-muted/50 rounded-lg">
              <p class="text-xs text-muted-foreground">
                <strong>Recommendation:</strong> ICO, PNG, or SVG format. Size: 16x16,
                32x32, or 64x64 pixels for best compatibility.
              </p>
            </div>

            <!-- Favicon Preview -->
            {#if form?.currentFavicon || data?.settings?.currentFavicon}
              <div class="space-y-4">
                <div class="border-t pt-4">
                  <Label class="text-base font-medium">Favicon Preview</Label>
                  <p class="text-sm text-muted-foreground mb-4">
                    Preview of how your favicon will appear in browser tabs
                  </p>

                  <!-- Browser Tab Mockup -->
                  <div class="space-y-2">
                    <div
                      class="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-t-lg border-b-2 border-blue-500 min-w-[200px]"
                    >
                      <img
                        src={form?.currentFavicon ||
                          data?.settings?.currentFavicon}
                        alt="Favicon preview"
                        class="w-4 h-4"
                      />
                      <span class="text-sm text-muted-foreground"
                        >Your Site</span
                      >
                    </div>
                    <p class="text-xs text-muted-foreground">
                      Browser tab preview
                    </p>
                  </div>
                </div>
              </div>
            {/if}
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
              : "Save Branding Settings"}
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

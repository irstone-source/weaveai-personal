<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { enhance } from "$app/forms";
  import * as m from "$lib/../paraglide/messages.js";

  // Import icons
  import { UserIcon, PencilIcon, SaveIcon } from "$lib/icons/index.js";

  // Get layout data from parent layout
  let { data, form } = $props();

  // Form state
  let isEditing = $state(false);
  let isSubmitting = $state(false);
  let nameValue = $state(data.user?.name || "");
  let emailValue = $state(data.user?.email || "");

  // Reset form when data changes (after successful update)
  $effect(() => {
    if (form?.success) {
      isEditing = false;
      isSubmitting = false;
      // Update local state with fresh server data
      nameValue = data.user?.name || "";
      emailValue = data.user?.email || "";
    }
  });

  function cancelEdit() {
    isEditing = false;
    nameValue = data.user?.name || "";
    emailValue = data.user?.email || "";
  }
</script>

<svelte:head>
  <title>{m["profile.page_title"]()}</title>
</svelte:head>

<div class="space-y-3">
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
            Profile editing is disabled. This is a read-only demonstration.
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Success Message -->
  {#if form?.success}
    <div
      class="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md"
    >
      {form.message}
    </div>
  {/if}

  <!-- Error Message -->
  {#if form?.error}
    <div
      class="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md"
    >
      {form.error}
    </div>
  {/if}

  <!-- Profile Information -->
  <Card.Root class="shadow-none">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <UserIcon class="w-5 h-5" />
        {m["profile.information"]()}
      </Card.Title>
      <Card.Description>{m["profile.basic_details"]()}</Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if isEditing}
        <!-- Edit Form -->
        <form
          method="POST"
          action="?/updateProfile"
          use:enhance={() => {
            isSubmitting = true;
            return async ({ update }) => {
              await update();
              isSubmitting = false;
            };
          }}
          class="space-y-6"
        >
          <div class="grid gap-6 md:grid-cols-2">
            <div class="space-y-2">
              <Label for="name" class="text-sm font-semibold text-foreground"
                >{m["profile.name"]()}</Label
              >
              <Input
                id="name"
                name="name"
                bind:value={nameValue}
                placeholder={m["profile.enter_name"]()}
                required
                disabled={data.isDemoMode}
                class="h-12 px-4 bg-muted/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div class="space-y-2">
              <Label for="email" class="text-sm font-semibold text-foreground"
                >{m["profile.email"]()}</Label
              >
              <Input
                id="email"
                name="email"
                type="email"
                bind:value={emailValue}
                placeholder={m["profile.enter_email"]()}
                required
                disabled={data.isDemoMode}
                class="h-12 px-4 bg-muted/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
          </div>

          <div class="flex gap-2 pt-4 border-t">
            <Button
              type="submit"
              disabled={isSubmitting || data.isDemoMode}
              class="cursor-pointer flex items-center gap-2"
            >
              <SaveIcon class="w-4 h-4" />
              {isSubmitting
                ? m["profile.saving"]()
                : data.isDemoMode
                  ? "Demo Mode - Read Only"
                  : m["profile.save_changes"]()}
            </Button>
            <Button
              type="button"
              variant="outline"
              onclick={cancelEdit}
              disabled={isSubmitting}
              class="cursor-pointer"
            >
              {m["profile.cancel"]()}
            </Button>
          </div>
        </form>
      {:else}
        <!-- Read-only View -->
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <span class="text-sm font-semibold text-foreground mb-2 block"
              >{m["profile.name"]()}</span
            >
            <div
              class="text-sm h-12 px-4 bg-muted/50 border rounded-lg text-foreground flex items-center"
            >
              {data.user?.name || m["profile.not_provided"]()}
            </div>
          </div>
          <div>
            <span class="text-sm font-semibold text-foreground mb-2 block"
              >{m["profile.email"]()}</span
            >
            <div
              class="text-sm h-12 px-4 bg-muted/50 border rounded-lg text-foreground flex items-center"
            >
              {data.user?.email || m["profile.not_provided"]()}
            </div>
          </div>
        </div>

        <div>
          <span class="text-sm font-semibold text-foreground mb-2 block"
            >{m["profile.user_id"]()}</span
          >
          <div
            class="text-sm font-mono h-12 px-4 bg-muted/50 border-0 rounded-lg text-muted-foreground select-all flex items-center"
          >
            {data.user?.id || m["profile.not_available"]()}
          </div>
        </div>

        <div>
          <span class="text-sm font-semibold text-foreground mb-2 block"
            >{m["profile.date_joined"]()}</span
          >
          <div
            class="text-sm h-12 px-4 bg-muted/50 border-0 rounded-lg text-muted-foreground flex items-center"
          >
            {data.user?.createdAt
              ? new Date(data.user.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : m["profile.not_available"]()}
          </div>
        </div>

        <div class="pt-4 border-t">
          <Button
            variant="outline"
            onclick={() => (isEditing = true)}
            disabled={data.isDemoMode}
            class="cursor-pointer flex items-center gap-2"
          >
            <PencilIcon class="w-4 h-4" />
            {m["profile.edit_profile"]()}
          </Button>
          {#if data.isDemoMode}
            <p class="text-xs text-muted-foreground mt-2">
              Profile editing is disabled in demo mode.
            </p>
          {/if}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

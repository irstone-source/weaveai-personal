<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { authSanitizers } from "$lib/utils/sanitization.js";

  let { data, form } = $props();

  let password = $state("");
  let confirmPassword = $state("");
  let loading = $state(false);
  let showPassword = $state(false);

  // Password strength indicator
  let passwordStrength = $derived(() => {
    if (!password) return { score: 0, text: "", color: "" };

    let score = 0;
    let feedback = [];

    if (password.length >= 8) score += 1;
    else feedback.push("at least 8 characters");

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push("lowercase letter");

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push("uppercase letter");

    if (/\d/.test(password)) score += 1;
    else feedback.push("number");

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push("special character");

    const colors = [
      "text-red-500",
      "text-red-400",
      "text-yellow-500",
      "text-blue-500",
      "text-green-500",
    ];
    const texts = ["Very Weak", "Weak", "Fair", "Good", "Strong"];

    return {
      score,
      text: score > 0 ? texts[score - 1] : "",
      color: score > 0 ? colors[score - 1] : "",
      feedback:
        feedback.length > 0
          ? `Missing: ${feedback.join(", ")}`
          : "Strong password!",
    };
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !loading) {
      event.preventDefault();
      const target = event.target as HTMLElement;
      const form = target?.closest("form") as HTMLFormElement;
      form?.requestSubmit();
    }
  }
</script>

<svelte:head>
  <title>Set New Password - {data.settings.siteName}</title>
  <meta
    name="description"
    content="Set your new password for {data.settings.siteName}"
  />
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-6 bg-muted/20">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl font-bold">Set New Password</Card.Title>
      <Card.Description class="text-muted-foreground">
        {#if data.userEmail}
          Set a new password for {data.userEmail}
        {:else}
          Enter your new password below
        {/if}
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <form
        method="POST"
        use:enhance={() => {
          loading = true;
          return async ({ update }) => {
            await update();
            loading = false;
          };
        }}
        class="space-y-4"
      >
        <div class="space-y-2">
          <Label for="password">New Password</Label>
          <div class="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your new password"
              bind:value={password}
              onkeydown={handleKeyDown}
              disabled={loading}
              required
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onclick={() => (showPassword = !showPassword)}
            >
              {#if showPassword}
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                  ></path>
                </svg>
              {:else}
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  ></path>
                </svg>
              {/if}
            </button>
          </div>
          {#if password && passwordStrength().score > 0}
            <div class="text-xs space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground">Strength:</span>
                <span class={passwordStrength().color}
                  >{passwordStrength().text}</span
                >
              </div>
              <div class="w-full bg-muted rounded-full h-1">
                <div
                  class="h-1 rounded-full transition-all duration-300 {passwordStrength()
                    .score >= 4
                    ? 'bg-green-500'
                    : passwordStrength().score >= 3
                      ? 'bg-blue-500'
                      : passwordStrength().score >= 2
                        ? 'bg-yellow-500'
                        : 'bg-red-500'}"
                  style="width: {(passwordStrength().score / 5) * 100}%"
                ></div>
              </div>
              <div class="text-muted-foreground text-xs">
                {passwordStrength().feedback}
              </div>
            </div>
          {/if}
        </div>

        <div class="space-y-2">
          <Label for="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Confirm your new password"
            bind:value={confirmPassword}
            onkeydown={handleKeyDown}
            disabled={loading}
            required
          />
          {#if confirmPassword && password !== confirmPassword}
            <div class="text-xs text-red-500">Passwords do not match</div>
          {/if}
        </div>

        {#if form?.error}
          <div
            class="text-sm text-destructive text-center bg-destructive/10 p-2 rounded"
          >
            {authSanitizers.errorMessage(form.error)}
          </div>
        {/if}

        <Button
          type="submit"
          disabled={loading ||
            !password ||
            !confirmPassword ||
            password !== confirmPassword ||
            passwordStrength().score < 2}
          class="w-full cursor-pointer"
        >
          {loading ? "Updating Password..." : "Update Password"}
        </Button>
      </form>
    </Card.Content>
    <Card.Footer class="text-center">
      <p class="text-xs text-muted-foreground space-y-1">
        <span class="block"
          >Choose a strong password with at least 8 characters.</span
        >
        <span class="block"
          >Include letters, numbers, and special characters for better security.</span
        >
      </p>
    </Card.Footer>
  </Card.Root>
</div>

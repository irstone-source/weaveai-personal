<script lang="ts">
  import { enhance } from "$app/forms";
  import { signIn } from "@auth/sveltekit/client";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Separator from "$lib/components/ui/separator/index.js";
  import { authSanitizers, validatePasswordSafety } from "$lib/utils/sanitization.js";
  import { validatePassword, BALANCED_PASSWORD_POLICY } from "$lib/utils/password-validation.js";
  import { validateEmailForAuth } from "$lib/utils/email-validation.js";

  let { form, data } = $props();
  let loading = $state(false);

  // Client-side validation
  let email = $state("");
  let password = $state("");
  let clientError = $state("");
  
  // Turnstile state
  let turnstileToken = $state("");

  function validateForm() {
    clientError = "";

    // Sanitize inputs for security
    const sanitizedEmail = authSanitizers.email(email);
    const passwordSafetyCheck = validatePasswordSafety(password);

    if (!sanitizedEmail || !passwordSafetyCheck.isValid) {
      clientError = passwordSafetyCheck.error || "All fields are required";
      return false;
    }

    // Comprehensive password validation
    const passwordValidation = validatePassword(password, BALANCED_PASSWORD_POLICY, { email: sanitizedEmail });

    if (!passwordValidation.isValid) {
      clientError = passwordValidation.errors[0] || "Password does not meet requirements";
      return false;
    }

    // Comprehensive email validation
    const emailValidation = validateEmailForAuth(email);
    if (!emailValidation.isValid) {
      clientError = emailValidation.errors[0] || "Please enter a valid email address";
      return false;
    }

    // Show warnings if any
    if (emailValidation.warnings.length > 0) {
      console.warn('Email validation warnings:', emailValidation.warnings);
    }

    // Validate Turnstile if enabled
    if (data.turnstile?.enabled && !turnstileToken) {
      clientError = "Please complete the security verification";
      return false;
    }

    // Update the form fields with sanitized values
    email = sanitizedEmail;

    return true;
  }

  async function handleGoogleSignIn() {
    if (!data.oauthProviders?.google) {
      clientError = "Google sign-in is not available.";
      return;
    }

    loading = true;
    clientError = "";
    try {
      await signIn("google", {
        callbackUrl: "/",
      });
    } catch (err) {
      console.error("OAuth provider error:", err);
      clientError = "Authentication with external provider failed. Please try again.";
      loading = false;
    }
  }

  async function handleAppleSignIn() {
    if (!data.oauthProviders?.apple) {
      clientError = "Apple sign-in is not available.";
      return;
    }

    loading = true;
    clientError = "";
    try {
      await signIn("apple", {
        callbackUrl: "/",
      });
    } catch (err) {
      console.error("OAuth provider error:", err);
      clientError = "Authentication with external provider failed. Please try again.";
      loading = false;
    }
  }

  async function handleTwitterSignIn() {
    if (!data.oauthProviders?.twitter) {
      clientError = "X sign-in is not available.";
      return;
    }

    loading = true;
    clientError = "";
    try {
      await signIn("twitter", {
        callbackUrl: "/",
      });
    } catch (err) {
      console.error("OAuth provider error:", err);
      clientError = "Authentication with external provider failed. Please try again.";
      loading = false;
    }
  }

  async function handleFacebookSignIn() {
    if (!data.oauthProviders?.facebook) {
      clientError = "Facebook sign-in is not available.";
      return;
    }

    loading = true;
    clientError = "";
    try {
      await signIn("facebook", {
        callbackUrl: "/",
      });
    } catch (err) {
      console.error("OAuth provider error:", err);
      clientError = "Authentication with external provider failed. Please try again.";
      loading = false;
    }
  }

  async function handleLinearSignIn() {
    if (!data.oauthProviders?.linear) {
      clientError = "Linear sign-in is not available.";
      return;
    }

    loading = true;
    clientError = "";
    try {
      await signIn("linear", {
        callbackUrl: "/",
      });
    } catch (err) {
      console.error("OAuth provider error:", err);
      clientError = "Authentication with external provider failed. Please try again.";
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Register - {data.settings.siteName}</title>
  <meta name="description" content={data.settings.siteDescription} />
  {#if data.turnstile?.enabled}
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  {/if}
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-6 bg-muted/20">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl font-bold">Create your account</Card.Title>
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if data.oauthProviders?.google || data.oauthProviders?.apple || data.oauthProviders?.twitter || data.oauthProviders?.facebook || data.oauthProviders?.linear}
        <!-- OAuth Provider Buttons -->
        {#if data.oauthProviders?.google}
          <!-- Google Sign Up Button -->
          <Button
            onclick={handleGoogleSignIn}
            disabled={loading}
            variant="outline"
            class="w-full cursor-pointer"
          >
            <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? "Signing up..." : "Continue with Google"}
          </Button>
        {/if}

        {#if data.oauthProviders?.apple}
          <!-- Apple Sign Up Button -->
          <Button
            onclick={handleAppleSignIn}
            disabled={loading}
            variant="outline"
            class="w-full cursor-pointer"
          >
            <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
              />
            </svg>
            {loading ? "Signing up..." : "Continue with Apple"}
          </Button>
        {/if}

        {#if data.oauthProviders?.twitter}
          <!-- X (Twitter) Sign Up Button -->
          <Button
            onclick={handleTwitterSignIn}
            disabled={loading}
            variant="outline"
            class="w-full cursor-pointer"
          >
            <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
              />
            </svg>
            {loading ? "Signing up..." : "Continue with X"}
          </Button>
        {/if}

        {#if data.oauthProviders?.facebook}
          <!-- Facebook Sign Up Button -->
          <Button
            onclick={handleFacebookSignIn}
            disabled={loading}
            variant="outline"
            class="w-full cursor-pointer"
          >
            <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="#1877F2">
              <path
                d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
              />
            </svg>
            {loading ? "Signing up..." : "Continue with Facebook"}
          </Button>
        {/if}

        {#if data.oauthProviders?.linear}
          <!-- Linear Sign Up Button -->
          <Button
            onclick={handleLinearSignIn}
            disabled={loading}
            variant="outline"
            class="w-full cursor-pointer"
          >
            <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="#5E6AD2">
              <path d="M0 0L12 12L24 0L12 24L0 0Z"/>
            </svg>
            {loading ? "Signing up..." : "Continue with Linear"}
          </Button>
        {/if}

        <div class="flex items-center">
          <div class="flex-1">
            <Separator.Root />
          </div>
          <span class="px-3 text-xs uppercase text-muted-foreground"> OR </span>
          <div class="flex-1">
            <Separator.Root />
          </div>
        </div>
      {/if}

      <form
        method="POST"
        action="?/register"
        use:enhance={() => {
          if (!validateForm()) {
            return () => {};
          }
          loading = true;
          return async ({ result, update }) => {
            // Handle redirect properly
            if (result.type === "redirect") {
              // Let SvelteKit handle the redirect
              await update();
              return;
            }

            // Handle other results
            await update();
            loading = false;
          };
        }}
        class="space-y-4"
      >
        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email"
            bind:value={email}
            disabled={loading}
            required
          />
        </div>
        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Create a password (min. 6 characters)"
            bind:value={password}
            disabled={loading}
            required
          />
        </div>

        <!-- Hidden input for Turnstile token -->
        {#if data.turnstile?.enabled}
          <input type="hidden" name="cf-turnstile-response" bind:value={turnstileToken} />
        {/if}

        {#if clientError}
          <div class="text-sm text-destructive text-center">
            {authSanitizers.errorMessage(clientError)}
          </div>
        {/if}

        {#if form?.error}
          <div class="text-sm text-destructive text-center">
            {authSanitizers.errorMessage(form.error)}
          </div>
        {/if}

        <Button type="submit" disabled={loading} class="w-full cursor-pointer">
          {loading ? "Creating account..." : "Create your account"}
        </Button>

        <p class="text-xs text-muted-foreground text-center">
          By continuing, you acknowledge {data.settings.siteName}'s
          <a class="underline underline-offset-2" href="/terms" target="_blank"
            >Terms of Service</a
          >.
        </p>

        <!-- Turnstile Widget -->
        {#if data.turnstile?.enabled && data.turnstile.siteKey}
          <div class="flex justify-center">
            <div 
              class="cf-turnstile" 
              data-sitekey={data.turnstile.siteKey}
              data-callback="onTurnstileSuccess"
              data-error-callback="onTurnstileError"
              data-expired-callback="onTurnstileExpired"
              data-theme="auto"
              data-size="normal"
            ></div>
          </div>
        {/if}
      </form>
    </Card.Content>
    <Card.Footer class="text-center">
      <p class="text-sm text-muted-foreground">
        Already have an account?
        <a href="/login" class="text-primary hover:underline cursor-pointer"
          >Log in</a
        >
      </p>
    </Card.Footer>
  </Card.Root>
</div>

{#if data.turnstile?.enabled}
  <script>
    // Global Turnstile callback functions
    window.onTurnstileSuccess = function(token) {
      // Find the Svelte component instance to update the token
      const hiddenInput = document.querySelector('input[name="cf-turnstile-response"]');
      if (hiddenInput) {
        hiddenInput.value = token;
        // Trigger input event to update Svelte binding
        hiddenInput.dispatchEvent(new Event('input'));
      }
    };

    window.onTurnstileError = function() {
      const hiddenInput = document.querySelector('input[name="cf-turnstile-response"]');
      if (hiddenInput) {
        hiddenInput.value = '';
        hiddenInput.dispatchEvent(new Event('input'));
      }
    };

    window.onTurnstileExpired = function() {
      const hiddenInput = document.querySelector('input[name="cf-turnstile-response"]');
      if (hiddenInput) {
        hiddenInput.value = '';
        hiddenInput.dispatchEvent(new Event('input'));
      }
    };
  </script>
{/if}

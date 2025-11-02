<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import type { PageData } from './$types'
  import * as Card from "$lib/components/ui/card/index.js";

  let { data }: { data: PageData } = $props()

  // Redirect to login after successful verification (if not logged in)
  onMount(() => {
    if (data.verification.success && !data.isLoggedIn) {
      // Redirect to login with success message after 3 seconds
      setTimeout(() => {
        goto('/login?message=Email verified successfully! Please sign in.')
      }, 3000)
    } else if (data.verification.success && data.isLoggedIn) {
      // Redirect to home after 3 seconds if already logged in
      setTimeout(() => {
        goto('/')
      }, 3000)
    }
  })
</script>

<svelte:head>
  <title>Email Verification - AI Models Platform</title>
  <meta name="description" content="Verify your email address to complete account setup" />
</svelte:head>

<div class="min-h-screen bg-muted/20 flex items-center justify-center p-4">
  <div class="max-w-md w-full">
    <Card.Root class="text-center">
      <Card.Content class="p-8">
      {#if data.verification.success}
        <!-- Success State -->
        <div class="mb-6">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-foreground mb-2">Email Verified!</h1>
          <p class="text-muted-foreground">{data.verification.message}</p>
        </div>

        {#if !data.isLoggedIn}
          <div class="space-y-4">
            <p class="text-sm text-muted-foreground">
              You will be redirected to the login page in a few seconds...
            </p>
            <a
              href="/login?message=Email verified successfully! Please sign in."
              class="inline-block w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Sign In Now
            </a>
          </div>
        {:else}
          <div class="space-y-4">
            <p class="text-sm text-muted-foreground">
              You will be redirected to your dashboard in a few seconds...
            </p>
            <a
              href="/"
              class="inline-block w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        {/if}
      {:else}
        <!-- Error State -->
        <div class="mb-6">
          <div class="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-foreground mb-2">Verification Failed</h1>
          <p class="text-muted-foreground mb-4">{data.verification.message}</p>
        </div>

        <div class="space-y-3">
          <a
            href="/register"
            class="inline-block w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Register New Account
          </a>
          <a
            href="/login"
            class="inline-block w-full border border-border text-foreground py-3 px-4 rounded-lg font-medium hover:bg-muted/50 transition-colors"
          >
            Sign In Instead
          </a>
        </div>

        <div class="mt-6 pt-4 border-t border-border">
          <p class="text-xs text-muted-foreground">
            If you continue having issues, please contact our support team.
          </p>
        </div>
      {/if}
      </Card.Content>
    </Card.Root>

    <!-- Footer -->
    <div class="mt-8 text-center">
      <p class="text-sm text-muted-foreground">
        © 2025 AI Models Platform. All rights reserved.
      </p>
    </div>
  </div>
</div>

<style>
  /* Add subtle animation for success state */
  @keyframes checkmark {
    0% {
      transform: scale(0);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }
</style>
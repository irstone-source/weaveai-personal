import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { getPaymentSettings, adminSettingsService } from '$lib/server/admin-settings'
import { settingsStore } from '$lib/server/settings-store'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  try {
    const settings = await getPaymentSettings();

    return {
      settings: {
        environment: settings.environment || "test",
        stripePublishableKey: settings.stripe_publishable_key || "",
        stripeSecretKey: settings.stripe_secret_key || "",
        stripeWebhookSecret: settings.stripe_webhook_secret || ""
      },
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load payment settings:', error);
    // Fallback to default values
    return {
      settings: {
        environment: "test",
        stripePublishableKey: "",
        stripeSecretKey: "",
        stripeWebhookSecret: ""
      },
      isDemoMode: isDemoModeEnabled()
    }
  }
}

export const actions: Actions = {
  update: async ({ request }) => {
    // Check demo mode - block modifications
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const data = await request.formData()

    const environment = data.get('environment')?.toString()
    const stripePublishableKey = data.get('stripePublishableKey')?.toString()
    const stripeSecretKey = data.get('stripeSecretKey')?.toString()
    const stripeWebhookSecret = data.get('stripeWebhookSecret')?.toString()

    // Basic validation
    if (!environment || !['test', 'live'].includes(environment)) {
      return fail(400, {
        error: 'Invalid environment selection',
        environment,
        stripePublishableKey,
        stripeSecretKey,
        stripeWebhookSecret
      })
    }

    // Validate Stripe keys format
    if (stripePublishableKey && !stripePublishableKey.startsWith(environment === 'test' ? 'pk_test_' : 'pk_live_')) {
      return fail(400, {
        error: `Publishable key must start with ${environment === 'test' ? 'pk_test_' : 'pk_live_'}`,
        environment,
        stripePublishableKey,
        stripeSecretKey,
        stripeWebhookSecret
      })
    }

    if (stripeSecretKey && !stripeSecretKey.startsWith(environment === 'test' ? 'sk_test_' : 'sk_live_')) {
      return fail(400, {
        error: `Secret key must start with ${environment === 'test' ? 'sk_test_' : 'sk_live_'}`,
        environment,
        stripePublishableKey,
        stripeSecretKey,
        stripeWebhookSecret
      })
    }

    if (stripeWebhookSecret && !stripeWebhookSecret.startsWith('whsec_')) {
      return fail(400, {
        error: 'Webhook secret must start with whsec_',
        environment,
        stripePublishableKey,
        stripeSecretKey,
        stripeWebhookSecret
      })
    }

    try {
      // Get current decrypted values to compare and prevent double encryption
      const currentSettings = await getPaymentSettings();

      // Helper function to check if value should be saved
      const shouldSaveValue = (newValue: string | undefined, currentValue: string | undefined) => {
        // Only save if we have a non-empty new value that's different from current
        const trimmedNew = (newValue || '').trim();
        const trimmedCurrent = (currentValue || '').trim();
        return trimmedNew && trimmedNew !== trimmedCurrent;
      };

      // Only save settings that have actually changed to prevent double encryption
      const settingsToSave = [];

      // Save environment if changed (not encrypted)
      if (environment && environment !== (currentSettings.environment || '')) {
        settingsToSave.push({ key: 'environment', value: environment, category: 'payment', description: 'Stripe environment (test or live)' });
      }

      // Only save keys that have changed
      if (shouldSaveValue(stripePublishableKey, currentSettings.stripe_publishable_key)) {
        settingsToSave.push({ key: 'stripe_publishable_key', value: stripePublishableKey!.trim(), category: 'payment', description: 'Stripe publishable key for frontend' });
      }
      if (shouldSaveValue(stripeSecretKey, currentSettings.stripe_secret_key)) {
        settingsToSave.push({ key: 'stripe_secret_key', value: stripeSecretKey!.trim(), category: 'payment', description: 'Stripe secret key for server-side API calls (encrypted)' });
      }
      if (shouldSaveValue(stripeWebhookSecret, currentSettings.stripe_webhook_secret)) {
        settingsToSave.push({ key: 'stripe_webhook_secret', value: stripeWebhookSecret!.trim(), category: 'payment', description: 'Stripe webhook secret for event verification (encrypted)' });
      }

      // Only save if there are actual changes
      if (settingsToSave.length > 0) {
        await adminSettingsService.setSettings(settingsToSave);
      }

      // Clear the settings cache to force refresh on next request
      settingsStore.clearCache();
      
      console.log('Payment settings saved successfully');

      // Get updated settings to return current values
      const updatedSettings = await getPaymentSettings();

      return {
        success: true,
        environment: updatedSettings.environment || 'test',
        stripePublishableKey: updatedSettings.stripe_publishable_key || '',
        stripeSecretKey: updatedSettings.stripe_secret_key || '',
        stripeWebhookSecret: updatedSettings.stripe_webhook_secret || ''
      }
    } catch (error) {
      console.error('Error saving payment settings:', error)
      return fail(500, {
        error: 'Failed to save payment settings. Please try again.',
        environment,
        stripePublishableKey,
        stripeSecretKey,
        stripeWebhookSecret
      })
    }
  }
}
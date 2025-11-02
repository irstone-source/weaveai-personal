import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { getSecuritySettings, adminSettingsService } from '$lib/server/admin-settings'
import { settingsStore } from '$lib/server/settings-store'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  try {
    const settings = await getSecuritySettings();

    const siteKey = settings.turnstile_site_key || "";
    const secretKey = settings.turnstile_secret_key || "";
    const hasKeys = siteKey.trim() !== "" && secretKey.trim() !== "";
    
    // Determine turnstile enabled state based on the logic:
    // 1. If no keys are present, force disabled
    // 2. If keys are present and no explicit setting exists, auto-enable
    // 3. If keys are present and explicit setting exists, use the explicit setting
    let turnstileEnabled = false;
    
    if (hasKeys) {
      if (settings.turnstile_enabled === undefined) {
        // Keys exist but no explicit setting - auto-enable
        turnstileEnabled = true;
      } else {
        // Keys exist and explicit setting exists - use the setting
        turnstileEnabled = settings.turnstile_enabled === 'true';
      }
    }
    // If no keys, turnstileEnabled remains false

    return {
      settings: {
        turnstileEnabled,
        turnstileSiteKey: siteKey,
        turnstileSecretKey: secretKey
      },
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load security settings:', error);
    // Fallback to default values
    return {
      settings: {
        turnstileEnabled: false,
        turnstileSiteKey: "",
        turnstileSecretKey: ""
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

    const turnstileEnabled = data.get('turnstileEnabled') === 'true'
    const turnstileSiteKey = data.get('turnstileSiteKey')?.toString()
    const turnstileSecretKey = data.get('turnstileSecretKey')?.toString()

    try {
      // Get current values to compare and only save changed settings
      const currentSettings = await getSecuritySettings();

      // Helper function to check if value should be saved
      const shouldSaveValue = (newValue: string | undefined, currentValue: string | undefined) => {
        // For boolean values (enabled), always save the current state
        if (typeof newValue === 'boolean' || newValue === 'true' || newValue === 'false') {
          return true;
        }
        // For string values, only save if we have a non-empty new value that's different from current
        const trimmedNew = (newValue || '').trim();
        const trimmedCurrent = (currentValue || '').trim();
        return trimmedNew !== trimmedCurrent;
      };

      // Only save settings that have actually changed
      const settingsToSave = [];

      // Always save the enabled state
      settingsToSave.push({
        key: 'turnstile_enabled',
        value: turnstileEnabled.toString(),
        category: 'security',
        description: 'Enable or disable Cloudflare Turnstile CAPTCHA protection'
      });

      if (shouldSaveValue(turnstileSiteKey, currentSettings.turnstile_site_key)) {
        settingsToSave.push({
          key: 'turnstile_site_key',
          value: (turnstileSiteKey || '').trim(),
          category: 'security',
          description: 'Cloudflare Turnstile site key (public)'
        });
      }

      if (shouldSaveValue(turnstileSecretKey, currentSettings.turnstile_secret_key)) {
        settingsToSave.push({
          key: 'turnstile_secret_key',
          value: (turnstileSecretKey || '').trim(),
          category: 'security',
          description: 'Cloudflare Turnstile secret key (private)',
          encrypted: true
        });
      }

      // Save settings
      if (settingsToSave.length > 0) {
        await adminSettingsService.setSettings(settingsToSave);
      }

      // Clear the settings cache to force refresh on next request
      settingsStore.clearCache();
      
      console.log('Security settings saved successfully');

      // Get updated settings to return current values
      const updatedSettings = await getSecuritySettings();

      const updatedSiteKey = updatedSettings.turnstile_site_key || '';
      const updatedSecretKey = updatedSettings.turnstile_secret_key || '';
      const updatedHasKeys = updatedSiteKey.trim() !== "" && updatedSecretKey.trim() !== "";
      
      // Apply the same logic as in load function
      let updatedTurnstileEnabled = false;
      if (updatedHasKeys) {
        if (updatedSettings.turnstile_enabled === undefined) {
          updatedTurnstileEnabled = true;
        } else {
          updatedTurnstileEnabled = updatedSettings.turnstile_enabled === 'true';
        }
      }

      return {
        success: true,
        turnstileEnabled: updatedTurnstileEnabled,
        turnstileSiteKey: updatedSiteKey,
        turnstileSecretKey: updatedSecretKey
      }
    } catch (error) {
      console.error('Error saving security settings:', error)
      return fail(500, {
        error: 'Failed to save settings. Please try again.',
        turnstileEnabled,
        turnstileSiteKey,
        turnstileSecretKey
      })
    }
  }
}
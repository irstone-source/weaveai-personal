import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { getGeneralSettings, adminSettingsService } from '$lib/server/admin-settings'
import { settingsStore } from '$lib/server/settings-store'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  try {
    const settings = await getGeneralSettings();

    // Provide default values if settings don't exist
    return {
      settings: {
        siteName: settings.site_name || "AI Chat Interface",
        siteTitle: settings.site_title || "AI Chat Interface - 65+ Models",
        siteDescription: settings.site_description || "A unified web application for interacting with 65+ AI models from 9 different providers through a single, intuitive interface.",
        defaultLanguage: settings.default_language || "en",
        defaultTheme: settings.default_theme || "dark"
      },
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load general settings:', error);
    // Fallback to default values
    return {
      settings: {
        siteName: "AI Chat Interface",
        siteTitle: "AI Chat Interface - 65+ Models",
        siteDescription: "A unified web application for interacting with 65+ AI models from 9 different providers through a single, intuitive interface.",
        defaultLanguage: "en",
        defaultTheme: "dark"
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

    const siteName = data.get('siteName')?.toString()
    const siteTitle = data.get('siteTitle')?.toString()
    const siteDescription = data.get('siteDescription')?.toString()
    const defaultLanguage = data.get('defaultLanguage')?.toString()
    const defaultTheme = data.get('defaultTheme')?.toString()

    // Basic validation
    if (!siteName || !siteTitle) {
      return fail(400, {
        error: 'Site name and title are required',
        siteName,
        siteTitle,
        siteDescription,
        defaultLanguage,
        defaultTheme
      })
    }

    // Validate language (must be 'en' or 'de')
    if (defaultLanguage && !['en', 'de'].includes(defaultLanguage)) {
      return fail(400, {
        error: 'Invalid language selection',
        siteName,
        siteTitle,
        siteDescription,
        defaultLanguage,
        defaultTheme
      })
    }

    // Validate theme (must be 'light', 'dark', or 'system')
    if (defaultTheme && !['light', 'dark', 'system'].includes(defaultTheme)) {
      return fail(400, {
        error: 'Invalid theme selection',
        siteName,
        siteTitle,
        siteDescription,
        defaultLanguage,
        defaultTheme
      })
    }

    try {
      // Get current values to compare and only save changed settings
      const currentSettings = await getGeneralSettings();

      // Helper function to check if value should be saved
      const shouldSaveValue = (newValue: string | undefined, currentValue: string | undefined) => {
        // Only save if we have a non-empty new value that's different from current
        const trimmedNew = (newValue || '').trim();
        const trimmedCurrent = (currentValue || '').trim();
        return trimmedNew && trimmedNew !== trimmedCurrent;
      };

      // Only save settings that have actually changed
      const settingsToSave = [];

      if (shouldSaveValue(siteName, currentSettings.site_name)) {
        settingsToSave.push({ key: 'site_name', value: siteName!.trim(), category: 'general', description: 'The name displayed in the browser tab and throughout the app' });
      }
      if (shouldSaveValue(siteTitle, currentSettings.site_title)) {
        settingsToSave.push({ key: 'site_title', value: siteTitle!.trim(), category: 'general', description: 'SEO title used in meta tags' });
      }
      if (shouldSaveValue(siteDescription, currentSettings.site_description)) {
        settingsToSave.push({ key: 'site_description', value: siteDescription!.trim(), category: 'general', description: 'Used for SEO meta descriptions and site information' });
      }
      if (shouldSaveValue(defaultLanguage, currentSettings.default_language)) {
        settingsToSave.push({ key: 'default_language', value: defaultLanguage!.trim(), category: 'general', description: 'Default language for new users' });
      }
      if (shouldSaveValue(defaultTheme, currentSettings.default_theme)) {
        settingsToSave.push({ key: 'default_theme', value: defaultTheme!.trim(), category: 'general', description: 'Default theme mode for new users' });
      }

      // Only save if there are actual changes
      if (settingsToSave.length > 0) {
        await adminSettingsService.setSettings(settingsToSave);
      }

      // Clear the settings cache to force refresh on next request
      settingsStore.clearCache();
      
      console.log('General settings saved successfully');

      // Get updated settings to return current values
      const updatedSettings = await getGeneralSettings();

      return {
        success: true,
        siteName: updatedSettings.site_name || '',
        siteTitle: updatedSettings.site_title || '',
        siteDescription: updatedSettings.site_description || '',
        defaultLanguage: updatedSettings.default_language || 'en',
        defaultTheme: updatedSettings.default_theme || 'dark'
      }
    } catch (error) {
      console.error('Error saving general settings:', error)
      return fail(500, {
        error: 'Failed to save settings. Please try again.',
        siteName,
        siteTitle,
        siteDescription,
        defaultLanguage,
        defaultTheme
      })
    }
  }
}
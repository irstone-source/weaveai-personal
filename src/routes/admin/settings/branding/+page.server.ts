import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { getBrandingSettings, adminSettingsService } from '$lib/server/admin-settings'
import { getCurrentBrandingFile, uploadBrandingFile, deleteBrandingFile } from '$lib/server/file-upload'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'
import { settingsStore } from '$lib/server/settings-store'

export const load: PageServerLoad = async () => {
  try {
    const settings = await getBrandingSettings();
    const logoDarkFile = await getCurrentBrandingFile('logo-dark');
    const logoLightFile = await getCurrentBrandingFile('logo-light');
    const faviconFile = await getCurrentBrandingFile('favicon');

    return {
      settings: {
        currentLogoDark: logoDarkFile?.url || null,
        currentLogoLight: logoLightFile?.url || null,
        currentFavicon: faviconFile?.url || null,
        logoWidth: settings.logo_width || "170",
        logoHeight: settings.logo_height || "27",
      },
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load branding settings:', error);
    // Fallback to default values
    return {
      settings: {
        currentLogoDark: null,
        currentLogoLight: null,
        currentFavicon: null,
        logoWidth: "170",
        logoHeight: "27",
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

    const logoDark = data.get('logoDark') as File
    const logoLight = data.get('logoLight') as File
    const favicon = data.get('favicon') as File
    const logoWidth = data.get('logoWidth')?.toString()
    const logoHeight = data.get('logoHeight')?.toString()

    // Validation
    const logoWidthNum = logoWidth ? parseInt(logoWidth) : 32
    const logoHeightNum = logoHeight ? parseInt(logoHeight) : 32

    if (isNaN(logoWidthNum) || logoWidthNum < 16 || logoWidthNum > 512) {
      return fail(400, {
        error: 'Logo width must be between 16 and 512 pixels',
        logoWidth,
        logoHeight
      })
    }

    if (isNaN(logoHeightNum) || logoHeightNum < 16 || logoHeightNum > 512) {
      return fail(400, {
        error: 'Logo height must be between 16 and 512 pixels',
        logoWidth,
        logoHeight
      })
    }

    try {
      let logoDarkUrl = null;
      let logoLightUrl = null;
      let faviconUrl = null;

      // Handle dark logo upload
      if (logoDark && logoDark.size > 0) {
        try {
          // Delete existing dark logo first
          await deleteBrandingFile('logo-dark');

          // Upload new dark logo
          const uploadedFile = await uploadBrandingFile(logoDark, 'logo-dark');
          logoDarkUrl = uploadedFile.url;

          console.log('Dark logo uploaded successfully:', uploadedFile.filename);
        } catch (uploadError: any) {
          return fail(400, {
            error: uploadError.message || 'Failed to upload dark logo',
            logoWidth,
            logoHeight
          });
        }
      }

      // Handle light logo upload
      if (logoLight && logoLight.size > 0) {
        try {
          // Delete existing light logo first
          await deleteBrandingFile('logo-light');

          // Upload new light logo
          const uploadedFile = await uploadBrandingFile(logoLight, 'logo-light');
          logoLightUrl = uploadedFile.url;

          console.log('Light logo uploaded successfully:', uploadedFile.filename);
        } catch (uploadError: any) {
          return fail(400, {
            error: uploadError.message || 'Failed to upload light logo',
            logoWidth,
            logoHeight
          });
        }
      }

      // Handle favicon upload
      if (favicon && favicon.size > 0) {
        try {
          // Delete existing favicon first
          await deleteBrandingFile('favicon');

          // Upload new favicon
          const uploadedFile = await uploadBrandingFile(favicon, 'favicon');
          faviconUrl = uploadedFile.url;

          console.log('Favicon uploaded successfully:', uploadedFile.filename);
        } catch (uploadError: any) {
          return fail(400, {
            error: uploadError.message || 'Failed to upload favicon',
            logoWidth,
            logoHeight
          });
        }
      }

      // Get current values to compare and only save changed settings
      const currentSettings = await getBrandingSettings();

      // Helper function to check if value should be saved
      const shouldSaveValue = (newValue: string | undefined, currentValue: string | undefined) => {
        // Only save if we have a non-empty new value that's different from current
        const trimmedNew = (newValue || '').trim();
        const trimmedCurrent = (currentValue || '').trim();
        return trimmedNew && trimmedNew !== trimmedCurrent;
      };

      // Only save settings that have actually changed
      const settingsToSave = [];

      if (shouldSaveValue(logoWidth, currentSettings.logo_width)) {
        settingsToSave.push({ key: 'logo_width', value: logoWidth!.trim(), category: 'branding', description: 'Logo width in pixels' });
      }
      if (shouldSaveValue(logoHeight, currentSettings.logo_height)) {
        settingsToSave.push({ key: 'logo_height', value: logoHeight!.trim(), category: 'branding', description: 'Logo height in pixels' });
      }


      // Only save if there are actual changes
      if (settingsToSave.length > 0) {
        await adminSettingsService.setSettings(settingsToSave);
      }

      console.log('Branding settings saved successfully');

      // Clear the settings cache to ensure immediate logo updates
      settingsStore.clearCache();

      // Get updated settings to return current values
      const updatedSettings = await getBrandingSettings();

      return {
        success: true,
        currentLogoDark: logoDarkUrl || updatedSettings.currentLogoDark,
        currentLogoLight: logoLightUrl || updatedSettings.currentLogoLight,
        currentFavicon: faviconUrl || updatedSettings.currentFavicon,
        logoWidth: updatedSettings.logo_width || "170",
        logoHeight: updatedSettings.logo_height || "27",
      }
    } catch (error) {
      console.error('Error saving branding settings:', error)
      return fail(500, {
        error: 'Failed to save branding settings. Please try again.',
        logoWidth,
        logoHeight
      })
    }
  }
}
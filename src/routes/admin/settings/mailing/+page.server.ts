import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { getMailingSettings, adminSettingsService } from '$lib/server/admin-settings'
import { settingsStore } from '$lib/server/settings-store'
import { emailService } from '$lib/server/email'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  try {
    const settings = await getMailingSettings();

    // Provide default values if settings don't exist
    return {
      settings: {
        smtpHost: settings.smtp_host || "",
        smtpPort: settings.smtp_port || "",
        smtpSecure: settings.smtp_secure || "",
        smtpUser: settings.smtp_user || "",
        smtpPass: settings.smtp_pass || "",
        fromEmail: settings.from_email || "",
        fromName: settings.from_name || ""
      },
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load mailing settings:', error);
    // Fallback to empty values
    return {
      settings: {
        smtpHost: "",
        smtpPort: "",
        smtpSecure: "",
        smtpUser: "",
        smtpPass: "",
        fromEmail: "",
        fromName: ""
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

    const smtpHost = data.get('smtpHost')?.toString()
    const smtpPort = data.get('smtpPort')?.toString()
    const smtpSecure = data.get('smtpSecure')?.toString()
    const smtpUser = data.get('smtpUser')?.toString()
    const smtpPass = data.get('smtpPass')?.toString()
    const fromEmail = data.get('fromEmail')?.toString()
    const fromName = data.get('fromName')?.toString()

    // Basic validation - require essential fields
    if (!smtpHost || !smtpUser || !smtpPass) {
      return fail(400, {
        error: 'SMTP Host, Username, and Password are required',
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        fromEmail,
        fromName
      })
    }

    // Validate port number if provided
    if (smtpPort && (isNaN(Number(smtpPort)) || Number(smtpPort) <= 0 || Number(smtpPort) > 65535)) {
      return fail(400, {
        error: 'SMTP Port must be a valid number between 1 and 65535',
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        fromEmail,
        fromName
      })
    }

    // Validate email format for fromEmail if provided
    if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      return fail(400, {
        error: 'From Email must be a valid email address',
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        fromEmail,
        fromName
      })
    }

    try {
      // Get current values to compare and only save changed settings
      const currentSettings = await getMailingSettings();

      // Helper function to check if value should be saved
      const shouldSaveValue = (newValue: string | undefined, currentValue: string | undefined) => {
        // Only save if we have a non-empty new value that's different from current
        const trimmedNew = (newValue || '').trim();
        const trimmedCurrent = (currentValue || '').trim();
        return trimmedNew && trimmedNew !== trimmedCurrent;
      };

      // Only save settings that have actually changed
      const settingsToSave = [];

      if (shouldSaveValue(smtpHost, currentSettings.smtp_host)) {
        settingsToSave.push({ key: 'smtp_host', value: smtpHost!.trim(), category: 'mailing', description: 'SMTP server hostname' });
      }
      if (shouldSaveValue(smtpPort, currentSettings.smtp_port)) {
        settingsToSave.push({ key: 'smtp_port', value: smtpPort!.trim(), category: 'mailing', description: 'SMTP server port number' });
      }
      if (shouldSaveValue(smtpSecure, currentSettings.smtp_secure)) {
        settingsToSave.push({ key: 'smtp_secure', value: smtpSecure!.trim(), category: 'mailing', description: 'Use secure connection (true/false)' });
      }
      if (shouldSaveValue(smtpUser, currentSettings.smtp_user)) {
        settingsToSave.push({ key: 'smtp_user', value: smtpUser!.trim(), category: 'mailing', description: 'SMTP username' });
      }
      if (shouldSaveValue(smtpPass, currentSettings.smtp_pass)) {
        settingsToSave.push({ key: 'smtp_pass', value: smtpPass!.trim(), category: 'mailing', description: 'SMTP password (encrypted)' });
      }
      if (shouldSaveValue(fromEmail, currentSettings.from_email)) {
        settingsToSave.push({ key: 'from_email', value: fromEmail!.trim(), category: 'mailing', description: 'From email address' });
      }
      if (shouldSaveValue(fromName, currentSettings.from_name)) {
        settingsToSave.push({ key: 'from_name', value: fromName!.trim(), category: 'mailing', description: 'From display name' });
      }

      // Only save if there are actual changes
      if (settingsToSave.length > 0) {
        await adminSettingsService.setSettings(settingsToSave);
      }

      // Clear the settings cache to force refresh on next request
      settingsStore.clearCache();

      // Reconfigure email service to use new settings
      await emailService.reconfigure();

      console.log('Mailing settings saved successfully');

      // Get updated settings to return current values
      const updatedSettings = await getMailingSettings();

      return {
        success: true,
        smtpHost: updatedSettings.smtp_host || '',
        smtpPort: updatedSettings.smtp_port || '',
        smtpSecure: updatedSettings.smtp_secure || '',
        smtpUser: updatedSettings.smtp_user || '',
        smtpPass: updatedSettings.smtp_pass || '',
        fromEmail: updatedSettings.from_email || '',
        fromName: updatedSettings.from_name || ''
      }
    } catch (error) {
      console.error('Error saving mailing settings:', error)
      return fail(500, {
        error: 'Failed to save mailing settings. Please try again.',
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        fromEmail,
        fromName
      })
    }
  }
}
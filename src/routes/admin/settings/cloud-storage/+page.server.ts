import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { getCloudStorageSettings, adminSettingsService } from '$lib/server/admin-settings'
import { settingsStore } from '$lib/server/settings-store'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  try {
    const settings = await getCloudStorageSettings();

    // Provide default values if settings don't exist
    return {
      settings: {
        r2AccountId: settings.r2_account_id || "",
        r2AccessKeyId: settings.r2_access_key_id || "",
        r2SecretAccessKey: settings.r2_secret_access_key || "",
        r2BucketName: settings.r2_bucket_name || "",
        r2PublicUrl: settings.r2_public_url || ""
      },
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load cloud storage settings:', error);
    // Fallback to empty values
    return {
      settings: {
        r2AccountId: "",
        r2AccessKeyId: "",
        r2SecretAccessKey: "",
        r2BucketName: "",
        r2PublicUrl: ""
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

    const r2AccountId = data.get('r2AccountId')?.toString()
    const r2AccessKeyId = data.get('r2AccessKeyId')?.toString()
    const r2SecretAccessKey = data.get('r2SecretAccessKey')?.toString()
    const r2BucketName = data.get('r2BucketName')?.toString()
    const r2PublicUrl = data.get('r2PublicUrl')?.toString()

    // Basic validation - require all fields except public URL
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
      return fail(400, {
        error: 'Account ID, Access Key ID, Secret Access Key, and Bucket Name are required',
        r2AccountId,
        r2AccessKeyId,
        r2SecretAccessKey,
        r2BucketName,
        r2PublicUrl
      })
    }

    try {
      // Get current values to compare and only save changed settings
      const currentSettings = await getCloudStorageSettings();

      // Helper function to check if value should be saved
      const shouldSaveValue = (newValue: string | undefined, currentValue: string | undefined) => {
        // Only save if we have a non-empty new value that's different from current
        const trimmedNew = (newValue || '').trim();
        const trimmedCurrent = (currentValue || '').trim();
        return trimmedNew && trimmedNew !== trimmedCurrent;
      };

      // Only save settings that have actually changed
      const settingsToSave = [];

      if (shouldSaveValue(r2AccountId, currentSettings.r2_account_id)) {
        settingsToSave.push({ key: 'r2_account_id', value: r2AccountId!.trim(), category: 'cloud_storage', description: 'Cloudflare R2 Account ID (encrypted)' });
      }
      if (shouldSaveValue(r2AccessKeyId, currentSettings.r2_access_key_id)) {
        settingsToSave.push({ key: 'r2_access_key_id', value: r2AccessKeyId!.trim(), category: 'cloud_storage', description: 'Cloudflare R2 Access Key ID (encrypted)' });
      }
      if (shouldSaveValue(r2SecretAccessKey, currentSettings.r2_secret_access_key)) {
        settingsToSave.push({ key: 'r2_secret_access_key', value: r2SecretAccessKey!.trim(), category: 'cloud_storage', description: 'Cloudflare R2 Secret Access Key (encrypted)' });
      }
      if (shouldSaveValue(r2BucketName, currentSettings.r2_bucket_name)) {
        settingsToSave.push({ key: 'r2_bucket_name', value: r2BucketName!.trim(), category: 'cloud_storage', description: 'Cloudflare R2 Bucket Name' });
      }
      if (shouldSaveValue(r2PublicUrl, currentSettings.r2_public_url)) {
        settingsToSave.push({ key: 'r2_public_url', value: r2PublicUrl!.trim(), category: 'cloud_storage', description: 'Cloudflare R2 Public URL (optional)' });
      }

      // Only save if there are actual changes
      if (settingsToSave.length > 0) {
        await adminSettingsService.setSettings(settingsToSave);
      }

      // Clear the settings cache to force refresh on next request
      settingsStore.clearCache();
      
      console.log('Cloud storage settings saved successfully');

      // Get updated settings to return current values
      const updatedSettings = await getCloudStorageSettings();

      return {
        success: true,
        r2AccountId: updatedSettings.r2_account_id || '',
        r2AccessKeyId: updatedSettings.r2_access_key_id || '',
        r2SecretAccessKey: updatedSettings.r2_secret_access_key || '',
        r2BucketName: updatedSettings.r2_bucket_name || '',
        r2PublicUrl: updatedSettings.r2_public_url || ''
      }
    } catch (error) {
      console.error('Error saving cloud storage settings:', error)
      return fail(500, {
        error: 'Failed to save cloud storage settings. Please try again.',
        r2AccountId,
        r2AccessKeyId,
        r2SecretAccessKey,
        r2BucketName,
        r2PublicUrl
      })
    }
  }
}
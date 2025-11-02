import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { getAIModelSettings, adminSettingsService } from '$lib/server/admin-settings'
import { settingsStore } from '$lib/server/settings-store'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  try {
    const settings = await getAIModelSettings();

    return {
      settings: {
        openrouterApiKey: settings.openrouter_api_key || "",
        geminiApiKey: settings.gemini_api_key || "",
        openaiApiKey: settings.openai_api_key || "",
        xaiApiKey: settings.xai_api_key || "",
        stabilityaiApiKey: settings.stabilityai_api_key || "",
        bflApiKey: settings.bfl_api_key || "",
        alibabaApiKey: settings.alibaba_api_key || "",
        lumalabsApiKey: settings.lumalabs_api_key || "",
        klingApiAccessKey: settings.kling_api_access_key || "",
        klingApiSecretKey: settings.kling_api_secret_key || ""
      },
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load AI model settings:', error);
    // Fallback to default values
    return {
      settings: {
        openrouterApiKey: "",
        geminiApiKey: "",
        openaiApiKey: "",
        xaiApiKey: "",
        stabilityaiApiKey: "",
        bflApiKey: "",
        alibabaApiKey: "",
        lumalabsApiKey: "",
        klingApiAccessKey: "",
        klingApiSecretKey: ""
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

    const openrouterApiKey = data.get('openrouterApiKey')?.toString()
    const geminiApiKey = data.get('geminiApiKey')?.toString()
    const openaiApiKey = data.get('openaiApiKey')?.toString()
    const xaiApiKey = data.get('xaiApiKey')?.toString()
    const stabilityaiApiKey = data.get('stabilityaiApiKey')?.toString()
    const bflApiKey = data.get('bflApiKey')?.toString()
    const alibabaApiKey = data.get('alibabaApiKey')?.toString()
    const lumalabsApiKey = data.get('lumalabsApiKey')?.toString()
    const klingApiAccessKey = data.get('klingApiAccessKey')?.toString()
    const klingApiSecretKey = data.get('klingApiSecretKey')?.toString()

    // Validation for OpenRouter API Key
    if (openrouterApiKey && openrouterApiKey.length < 10) {
      return fail(400, {
        error: 'OpenRouter API key is too short. Please provide a valid API key.',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    // Validation for Google Gemini API Key
    if (geminiApiKey && !geminiApiKey.startsWith('AIza')) {
      return fail(400, {
        error: 'Invalid Google Gemini API key format. It should start with "AIza".',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    // Validation for OpenAI API Key
    if (openaiApiKey && !openaiApiKey.startsWith('sk-')) {
      return fail(400, {
        error: 'Invalid OpenAI API key format. It should start with "sk-".',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    // Validation for xAI API Key
    if (xaiApiKey && !xaiApiKey.startsWith('xai-')) {
      return fail(400, {
        error: 'Invalid xAI API key format. It should start with "xai-".',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    // Validation for Stability AI API Key
    if (stabilityaiApiKey && !stabilityaiApiKey.startsWith('sk-')) {
      return fail(400, {
        error: 'Invalid Stability AI API key format. It should start with "sk-".',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    // Validation for Black Forest Labs API Key
    if (bflApiKey && bflApiKey.length < 20) {
      return fail(400, {
        error: 'Black Forest Labs API key is too short. Please provide a valid API key.',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    // Validation for Alibaba API Key
    if (alibabaApiKey && alibabaApiKey.length < 10) {
      return fail(400, {
        error: 'Alibaba API key is too short. Please provide a valid API key.',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    // Validation for Luma Labs API Key
    if (lumalabsApiKey && lumalabsApiKey.length < 10) {
      return fail(400, {
        error: 'Luma Labs API key is too short. Please provide a valid API key.',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    // Validation for Kling AI keys - both must be provided if one is provided
    if ((klingApiAccessKey && !klingApiSecretKey) || (!klingApiAccessKey && klingApiSecretKey)) {
      return fail(400, {
        error: 'Both Kling API Access Key and Secret Key must be provided together.',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    if (klingApiAccessKey && klingApiAccessKey.length < 10) {
      return fail(400, {
        error: 'Kling API Access Key is too short. Please provide a valid API key.',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    if (klingApiSecretKey && klingApiSecretKey.length < 10) {
      return fail(400, {
        error: 'Kling API Secret Key is too short. Please provide a valid API key.',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }

    try {
      // Get current decrypted values to compare and prevent double encryption
      const currentSettings = await getAIModelSettings();

      // Helper function to check if value should be saved
      const shouldSaveValue = (newValue: string | undefined, currentValue: string | undefined) => {
        // Only save if we have a non-empty new value that's different from current
        const trimmedNew = (newValue || '').trim();
        const trimmedCurrent = (currentValue || '').trim();
        return trimmedNew && trimmedNew !== trimmedCurrent;
      };

      // Only save settings that have actually changed to prevent double encryption
      const settingsToSave = [];
      
      if (shouldSaveValue(openrouterApiKey, currentSettings.openrouter_api_key)) {
        settingsToSave.push({ key: 'openrouter_api_key', value: openrouterApiKey!.trim(), category: 'ai_models', description: 'OpenRouter API key for 32+ text models (encrypted)' });
      }
      if (shouldSaveValue(geminiApiKey, currentSettings.gemini_api_key)) {
        settingsToSave.push({ key: 'gemini_api_key', value: geminiApiKey!.trim(), category: 'ai_models', description: 'Google Gemini API key for multimodal models (encrypted)' });
      }
      if (shouldSaveValue(openaiApiKey, currentSettings.openai_api_key)) {
        settingsToSave.push({ key: 'openai_api_key', value: openaiApiKey!.trim(), category: 'ai_models', description: 'OpenAI API key for DALL-E and GPT Image (encrypted)' });
      }
      if (shouldSaveValue(xaiApiKey, currentSettings.xai_api_key)) {
        settingsToSave.push({ key: 'xai_api_key', value: xaiApiKey!.trim(), category: 'ai_models', description: 'xAI API key for Grok-2-Image model (encrypted)' });
      }
      if (shouldSaveValue(stabilityaiApiKey, currentSettings.stabilityai_api_key)) {
        settingsToSave.push({ key: 'stabilityai_api_key', value: stabilityaiApiKey!.trim(), category: 'ai_models', description: 'Stability AI API key for Stable Diffusion models (encrypted)' });
      }
      if (shouldSaveValue(bflApiKey, currentSettings.bfl_api_key)) {
        settingsToSave.push({ key: 'bfl_api_key', value: bflApiKey!.trim(), category: 'ai_models', description: 'Black Forest Labs API key for FLUX models (encrypted)' });
      }
      if (shouldSaveValue(alibabaApiKey, currentSettings.alibaba_api_key)) {
        settingsToSave.push({ key: 'alibaba_api_key', value: alibabaApiKey!.trim(), category: 'ai_models', description: 'Alibaba API key for Wan series models (encrypted)' });
      }
      if (shouldSaveValue(lumalabsApiKey, currentSettings.lumalabs_api_key)) {
        settingsToSave.push({ key: 'lumalabs_api_key', value: lumalabsApiKey!.trim(), category: 'ai_models', description: 'Luma Labs API key for Dream Machine models (encrypted)' });
      }
      if (shouldSaveValue(klingApiAccessKey, currentSettings.kling_api_access_key)) {
        settingsToSave.push({ key: 'kling_api_access_key', value: klingApiAccessKey!.trim(), category: 'ai_models', description: 'Kling AI Access Key for image/video generation (encrypted)' });
      }
      if (shouldSaveValue(klingApiSecretKey, currentSettings.kling_api_secret_key)) {
        settingsToSave.push({ key: 'kling_api_secret_key', value: klingApiSecretKey!.trim(), category: 'ai_models', description: 'Kling AI Secret Key for JWT authentication (encrypted)' });
      }

      // Only save if there are actual changes
      if (settingsToSave.length > 0) {
        await adminSettingsService.setSettings(settingsToSave);
      }

      // Clear the settings cache to force refresh on next request
      settingsStore.clearCache();
      
      console.log('AI model settings saved successfully');

      // Get updated settings to return current values (decrypted)
      const updatedSettings = await getAIModelSettings();

      return {
        success: true,
        openrouterApiKey: updatedSettings.openrouter_api_key || '',
        geminiApiKey: updatedSettings.gemini_api_key || '',
        openaiApiKey: updatedSettings.openai_api_key || '',
        xaiApiKey: updatedSettings.xai_api_key || '',
        stabilityaiApiKey: updatedSettings.stabilityai_api_key || '',
        bflApiKey: updatedSettings.bfl_api_key || '',
        alibabaApiKey: updatedSettings.alibaba_api_key || '',
        lumalabsApiKey: updatedSettings.lumalabs_api_key || '',
        klingApiAccessKey: updatedSettings.kling_api_access_key || '',
        klingApiSecretKey: updatedSettings.kling_api_secret_key || ''
      }
    } catch (error) {
      console.error('Error saving AI model settings:', error)
      return fail(500, {
        error: 'Failed to save AI model settings. Please try again.',
        openrouterApiKey,
        geminiApiKey,
        openaiApiKey,
        xaiApiKey,
        stabilityaiApiKey,
        bflApiKey,
        alibabaApiKey,
        lumalabsApiKey,
        klingApiAccessKey,
        klingApiSecretKey
      })
    }
  }
}
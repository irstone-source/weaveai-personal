import { adminSettingsService } from './admin-settings';
import { getCurrentBrandingFile } from './file-upload';

// Define the structure of cached settings
export interface CachedSettings {
  // General settings
  siteName: string;
  siteTitle: string;
  siteDescription: string;
  defaultLanguage: string;
  defaultTheme: string;

  // Payment settings
  paymentEnvironment: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;

  // OAuth settings
  googleEnabled: boolean;
  googleClientId: string;
  googleClientSecret: string;
  appleEnabled: boolean;
  appleClientId: string;
  appleClientSecret: string;
  twitterEnabled: boolean;
  twitterClientId: string;
  twitterClientSecret: string;
  facebookEnabled: boolean;
  facebookClientId: string;
  facebookClientSecret: string;
  linearEnabled: boolean;
  linearClientId: string;
  linearClientSecret: string;

  // Integration settings
  fathomEnabled: boolean;
  fathomApiKey: string;

  // AI Model settings
  openrouterApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  xaiApiKey: string;
  stabilityaiApiKey: string;
  bflApiKey: string;
  alibabaApiKey: string;
  lumalabsApiKey: string;
  klingApiAccessKey: string;
  klingApiSecretKey: string;

  // Cloud Storage settings
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;

  // Security settings
  turnstileSiteKey: string;
  turnstileSecretKey: string;

  // Branding settings
  logoUrlDark: string;
  logoUrlLight: string;
  logoWidth: string;
  logoHeight: string;
  currentFavicon: string | null;

  // Metadata
  lastUpdated: Date;
}

// Default fallback values
const DEFAULT_SETTINGS: Omit<CachedSettings, 'lastUpdated'> = {
  siteName: "AI Chat Interface",
  siteTitle: "AI Chat Interface - 65+ Models",
  siteDescription: "A unified web application for interacting with 65+ AI models from 9 different providers through a single, intuitive interface.",
  defaultLanguage: "en",
  defaultTheme: "dark",
  paymentEnvironment: "test",
  stripePublishableKey: "",
  stripeSecretKey: "",
  stripeWebhookSecret: "",
  googleEnabled: true,
  googleClientId: "",
  googleClientSecret: "",
  appleEnabled: true,
  appleClientId: "",
  appleClientSecret: "",
  twitterEnabled: true,
  twitterClientId: "",
  twitterClientSecret: "",
  facebookEnabled: true,
  facebookClientId: "",
  facebookClientSecret: "",
  linearEnabled: true,
  linearClientId: "",
  linearClientSecret: "",
  fathomEnabled: false,
  fathomApiKey: "",
  openrouterApiKey: "",
  geminiApiKey: "",
  openaiApiKey: "",
  xaiApiKey: "",
  stabilityaiApiKey: "",
  bflApiKey: "",
  alibabaApiKey: "",
  lumalabsApiKey: "",
  klingApiAccessKey: "",
  klingApiSecretKey: "",
  r2AccountId: "",
  r2AccessKeyId: "",
  r2SecretAccessKey: "",
  r2BucketName: "",
  r2PublicUrl: "",
  turnstileSiteKey: "",
  turnstileSecretKey: "",
  logoUrlDark: "/branding/logos/default-dark-logo.png", // Default fallback for dark mode
  logoUrlLight: "/branding/logos/default-light-logo.png", // Default fallback for light mode
  logoWidth: "170", // Default logo width in pixels
  logoHeight: "27", // Default logo height in pixels
  currentFavicon: null // Default no custom favicon
};

class SettingsStore {
  private cache: CachedSettings | null = null;
  private isLoading: boolean = false;
  private lastFetch: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

  /**
   * Get all settings, using cache if available and fresh
   */
  async getSettings(): Promise<CachedSettings> {
    const now = Date.now();

    // Return cached settings if they're fresh and available
    if (this.cache && (now - this.lastFetch) < this.CACHE_TTL) {
      return this.cache;
    }

    // If already loading, wait for the current load to complete
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return this.cache || this.createDefaultSettings();
    }

    try {
      this.isLoading = true;
      await this.refreshCache();
      return this.cache || this.createDefaultSettings();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get a specific setting value
   */
  async getSetting<K extends keyof Omit<CachedSettings, 'lastUpdated'>>(
    key: K
  ): Promise<CachedSettings[K]> {
    const settings = await this.getSettings();
    return settings[key];
  }

  /**
   * Force refresh the cache from database
   */
  async refreshCache(): Promise<void> {
    try {
      console.log('Refreshing settings cache from database...');

      // Load general, payment, oauth, ai model, cloud storage, security, branding settings, integrations, and branding files from database
      const [generalSettings, paymentSettings, oauthSettings, aiModelSettings, cloudStorageSettings, securitySettings, brandingSettings, integrationSettings, brandingDarkFile, brandingLightFile, faviconFile] = await Promise.all([
        adminSettingsService.getSettingsByCategory('general'),
        adminSettingsService.getSettingsByCategory('payment'),
        adminSettingsService.getSettingsByCategory('oauth'),
        adminSettingsService.getSettingsByCategory('ai_models'),
        adminSettingsService.getSettingsByCategory('cloud_storage'),
        adminSettingsService.getSettingsByCategory('security'),
        adminSettingsService.getSettingsByCategory('branding'),
        adminSettingsService.getSettingsByCategory('integrations'),
        getCurrentBrandingFile('logo-dark'),
        getCurrentBrandingFile('logo-light'),
        getCurrentBrandingFile('favicon')
      ]);

      // Transform database settings to our cached format
      this.cache = {
        siteName: generalSettings.site_name || DEFAULT_SETTINGS.siteName,
        siteTitle: generalSettings.site_title || DEFAULT_SETTINGS.siteTitle,
        siteDescription: generalSettings.site_description || DEFAULT_SETTINGS.siteDescription,
        defaultLanguage: generalSettings.default_language || DEFAULT_SETTINGS.defaultLanguage,
        defaultTheme: generalSettings.default_theme || DEFAULT_SETTINGS.defaultTheme,
        paymentEnvironment: paymentSettings.environment || DEFAULT_SETTINGS.paymentEnvironment,
        stripePublishableKey: paymentSettings.stripe_publishable_key || DEFAULT_SETTINGS.stripePublishableKey,
        stripeSecretKey: paymentSettings.stripe_secret_key || DEFAULT_SETTINGS.stripeSecretKey,
        stripeWebhookSecret: paymentSettings.stripe_webhook_secret || DEFAULT_SETTINGS.stripeWebhookSecret,
        googleEnabled: oauthSettings.google_enabled !== 'false',
        googleClientId: oauthSettings.google_client_id || DEFAULT_SETTINGS.googleClientId,
        googleClientSecret: oauthSettings.google_client_secret || DEFAULT_SETTINGS.googleClientSecret,
        appleEnabled: oauthSettings.apple_enabled !== 'false',
        appleClientId: oauthSettings.apple_client_id || DEFAULT_SETTINGS.appleClientId,
        appleClientSecret: oauthSettings.apple_client_secret || DEFAULT_SETTINGS.appleClientSecret,
        twitterEnabled: oauthSettings.twitter_enabled !== 'false',
        twitterClientId: oauthSettings.twitter_client_id || DEFAULT_SETTINGS.twitterClientId,
        twitterClientSecret: oauthSettings.twitter_client_secret || DEFAULT_SETTINGS.twitterClientSecret,
        facebookEnabled: oauthSettings.facebook_enabled !== 'false',
        facebookClientId: oauthSettings.facebook_client_id || DEFAULT_SETTINGS.facebookClientId,
        facebookClientSecret: oauthSettings.facebook_client_secret || DEFAULT_SETTINGS.facebookClientSecret,
        linearEnabled: oauthSettings.linear_enabled !== 'false',
        linearClientId: oauthSettings.linear_client_id || DEFAULT_SETTINGS.linearClientId,
        linearClientSecret: oauthSettings.linear_client_secret || DEFAULT_SETTINGS.linearClientSecret,
        fathomEnabled: integrationSettings.fathom_enabled === 'true',
        fathomApiKey: integrationSettings.fathom_api_key || DEFAULT_SETTINGS.fathomApiKey,
        openrouterApiKey: aiModelSettings.openrouter_api_key || DEFAULT_SETTINGS.openrouterApiKey,
        geminiApiKey: aiModelSettings.gemini_api_key || DEFAULT_SETTINGS.geminiApiKey,
        openaiApiKey: aiModelSettings.openai_api_key || DEFAULT_SETTINGS.openaiApiKey,
        xaiApiKey: aiModelSettings.xai_api_key || DEFAULT_SETTINGS.xaiApiKey,
        stabilityaiApiKey: aiModelSettings.stabilityai_api_key || DEFAULT_SETTINGS.stabilityaiApiKey,
        bflApiKey: aiModelSettings.bfl_api_key || DEFAULT_SETTINGS.bflApiKey,
        alibabaApiKey: aiModelSettings.alibaba_api_key || DEFAULT_SETTINGS.alibabaApiKey,
        lumalabsApiKey: aiModelSettings.lumalabs_api_key || DEFAULT_SETTINGS.lumalabsApiKey,
        klingApiAccessKey: aiModelSettings.kling_api_access_key || DEFAULT_SETTINGS.klingApiAccessKey,
        klingApiSecretKey: aiModelSettings.kling_api_secret_key || DEFAULT_SETTINGS.klingApiSecretKey,
        r2AccountId: cloudStorageSettings.r2_account_id || DEFAULT_SETTINGS.r2AccountId,
        r2AccessKeyId: cloudStorageSettings.r2_access_key_id || DEFAULT_SETTINGS.r2AccessKeyId,
        r2SecretAccessKey: cloudStorageSettings.r2_secret_access_key || DEFAULT_SETTINGS.r2SecretAccessKey,
        r2BucketName: cloudStorageSettings.r2_bucket_name || DEFAULT_SETTINGS.r2BucketName,
        r2PublicUrl: cloudStorageSettings.r2_public_url || DEFAULT_SETTINGS.r2PublicUrl,
        turnstileSiteKey: securitySettings.turnstile_site_key || DEFAULT_SETTINGS.turnstileSiteKey,
        turnstileSecretKey: securitySettings.turnstile_secret_key || DEFAULT_SETTINGS.turnstileSecretKey,
        logoUrlDark: brandingDarkFile?.url || DEFAULT_SETTINGS.logoUrlDark,
        logoUrlLight: brandingLightFile?.url || DEFAULT_SETTINGS.logoUrlLight,
        logoWidth: brandingSettings.logo_width || DEFAULT_SETTINGS.logoWidth,
        logoHeight: brandingSettings.logo_height || DEFAULT_SETTINGS.logoHeight,
        currentFavicon: faviconFile?.url || DEFAULT_SETTINGS.currentFavicon,
        lastUpdated: new Date()
      };

      this.lastFetch = Date.now();
      console.log('Settings cache refreshed successfully');

    } catch (error) {
      console.error('Failed to refresh settings cache:', error);

      // Use default settings if database fails
      if (!this.cache) {
        this.cache = this.createDefaultSettings();
      }
    }
  }

  /**
   * Clear the cache (useful when settings are updated)
   */
  clearCache(): void {
    console.log('Clearing settings cache');
    this.cache = null;
    this.lastFetch = 0;
  }

  /**
   * Get settings synchronously from cache (returns defaults if cache is empty)
   */
  getCachedSettings(): CachedSettings {
    return this.cache || this.createDefaultSettings();
  }

  /**
   * Check if cache is considered fresh
   */
  isCacheFresh(): boolean {
    if (!this.cache) return false;
    return (Date.now() - this.lastFetch) < this.CACHE_TTL;
  }

  private createDefaultSettings(): CachedSettings {
    return {
      ...DEFAULT_SETTINGS,
      lastUpdated: new Date()
    };
  }
}

// Export singleton instance
export const settingsStore = new SettingsStore();

// Convenience functions for common operations
export async function getSiteSettings() {
  return await settingsStore.getSettings();
}

export async function getSiteName(): Promise<string> {
  return await settingsStore.getSetting('siteName');
}

export async function getSiteTitle(): Promise<string> {
  return await settingsStore.getSetting('siteTitle');
}

export async function getSiteDescription(): Promise<string> {
  return await settingsStore.getSetting('siteDescription');
}

export async function getDefaultLanguage(): Promise<string> {
  return await settingsStore.getSetting('defaultLanguage');
}

export async function getDefaultTheme(): Promise<string> {
  return await settingsStore.getSetting('defaultTheme');
}

export async function refreshSiteSettings() {
  await settingsStore.refreshCache();
}

// Payment settings convenience functions
export async function getPaymentEnvironment(): Promise<string> {
  return await settingsStore.getSetting('paymentEnvironment');
}

export async function getStripePublishableKey(): Promise<string> {
  return await settingsStore.getSetting('stripePublishableKey');
}

export async function getStripeSecretKey(): Promise<string> {
  return await settingsStore.getSetting('stripeSecretKey');
}

export async function getStripeWebhookSecret(): Promise<string> {
  return await settingsStore.getSetting('stripeWebhookSecret');
}

export async function getPaymentSettings() {
  const settings = await settingsStore.getSettings();
  return {
    paymentEnvironment: settings.paymentEnvironment,
    stripePublishableKey: settings.stripePublishableKey,
    stripeSecretKey: settings.stripeSecretKey,
    stripeWebhookSecret: settings.stripeWebhookSecret
  };
}

// OAuth settings convenience functions
export async function getGoogleEnabled(): Promise<boolean> {
  return await settingsStore.getSetting('googleEnabled');
}

export async function getGoogleClientId(): Promise<string> {
  return await settingsStore.getSetting('googleClientId');
}

export async function getGoogleClientSecret(): Promise<string> {
  return await settingsStore.getSetting('googleClientSecret');
}

export async function getOAuthSettings() {
  const settings = await settingsStore.getSettings();
  return {
    googleEnabled: settings.googleEnabled,
    googleClientId: settings.googleClientId,
    googleClientSecret: settings.googleClientSecret,
    appleEnabled: settings.appleEnabled,
    appleClientId: settings.appleClientId,
    appleClientSecret: settings.appleClientSecret,
    twitterEnabled: settings.twitterEnabled,
    twitterClientId: settings.twitterClientId,
    twitterClientSecret: settings.twitterClientSecret,
    facebookEnabled: settings.facebookEnabled,
    facebookClientId: settings.facebookClientId,
    facebookClientSecret: settings.facebookClientSecret,
    linearEnabled: settings.linearEnabled,
    linearClientId: settings.linearClientId,
    linearClientSecret: settings.linearClientSecret
  };
}

// Apple OAuth settings convenience functions
export async function getAppleEnabled(): Promise<boolean> {
  return await settingsStore.getSetting('appleEnabled');
}

export async function getAppleClientId(): Promise<string> {
  return await settingsStore.getSetting('appleClientId');
}

export async function getAppleClientSecret(): Promise<string> {
  return await settingsStore.getSetting('appleClientSecret');
}

// Twitter OAuth settings convenience functions
export async function getTwitterEnabled(): Promise<boolean> {
  return await settingsStore.getSetting('twitterEnabled');
}

export async function getTwitterClientId(): Promise<string> {
  return await settingsStore.getSetting('twitterClientId');
}

export async function getTwitterClientSecret(): Promise<string> {
  return await settingsStore.getSetting('twitterClientSecret');
}

// Facebook OAuth settings convenience functions
export async function getFacebookEnabled(): Promise<boolean> {
  return await settingsStore.getSetting('facebookEnabled');
}

export async function getFacebookClientId(): Promise<string> {
  return await settingsStore.getSetting('facebookClientId');
}

export async function getFacebookClientSecret(): Promise<string> {
  return await settingsStore.getSetting('facebookClientSecret');
}

// AI Model settings convenience functions
export async function getAIModelSettings() {
  const settings = await settingsStore.getSettings();
  return {
    openrouterApiKey: settings.openrouterApiKey,
    geminiApiKey: settings.geminiApiKey,
    openaiApiKey: settings.openaiApiKey,
    xaiApiKey: settings.xaiApiKey,
    stabilityaiApiKey: settings.stabilityaiApiKey,
    bflApiKey: settings.bflApiKey,
    alibabaApiKey: settings.alibabaApiKey,
    lumalabsApiKey: settings.lumalabsApiKey,
    klingApiAccessKey: settings.klingApiAccessKey,
    klingApiSecretKey: settings.klingApiSecretKey
  };
}

export async function getOpenRouterApiKey(): Promise<string> {
  return await settingsStore.getSetting('openrouterApiKey');
}

export async function getGeminiApiKey(): Promise<string> {
  return await settingsStore.getSetting('geminiApiKey');
}

export async function getOpenAIApiKey(): Promise<string> {
  return await settingsStore.getSetting('openaiApiKey');
}

export async function getXAIApiKey(): Promise<string> {
  return await settingsStore.getSetting('xaiApiKey');
}

export async function getStabilityAIApiKey(): Promise<string> {
  return await settingsStore.getSetting('stabilityaiApiKey');
}

export async function getBFLApiKey(): Promise<string> {
  return await settingsStore.getSetting('bflApiKey');
}

export async function getAlibabaApiKey(): Promise<string> {
  return await settingsStore.getSetting('alibabaApiKey');
}

export async function getLumaLabsApiKey(): Promise<string> {
  return await settingsStore.getSetting('lumalabsApiKey');
}

export async function getKlingApiAccessKey(): Promise<string> {
  return await settingsStore.getSetting('klingApiAccessKey');
}

export async function getKlingApiSecretKey(): Promise<string> {
  return await settingsStore.getSetting('klingApiSecretKey');
}

// Cloud Storage settings convenience functions
export async function getCloudStorageSettingsFromCache() {
  const settings = await settingsStore.getSettings();
  return {
    r2AccountId: settings.r2AccountId,
    r2AccessKeyId: settings.r2AccessKeyId,
    r2SecretAccessKey: settings.r2SecretAccessKey,
    r2BucketName: settings.r2BucketName,
    r2PublicUrl: settings.r2PublicUrl
  };
}

export async function getR2AccountId(): Promise<string> {
  return await settingsStore.getSetting('r2AccountId');
}

export async function getR2AccessKeyId(): Promise<string> {
  return await settingsStore.getSetting('r2AccessKeyId');
}

export async function getR2SecretAccessKey(): Promise<string> {
  return await settingsStore.getSetting('r2SecretAccessKey');
}

export async function getR2BucketName(): Promise<string> {
  return await settingsStore.getSetting('r2BucketName');
}

export async function getR2PublicUrl(): Promise<string> {
  return await settingsStore.getSetting('r2PublicUrl');
}

// Turnstile security settings convenience functions
export async function getTurnstileSettings() {
  const settings = await settingsStore.getSettings();
  return {
    turnstileSiteKey: settings.turnstileSiteKey,
    turnstileSecretKey: settings.turnstileSecretKey
  };
}

export async function getTurnstileSiteKey(): Promise<string> {
  return await settingsStore.getSetting('turnstileSiteKey');
}

export async function getTurnstileSecretKey(): Promise<string> {
  return await settingsStore.getSetting('turnstileSecretKey');
}

// Logo settings convenience functions
export async function getLogoUrlDark(): Promise<string> {
  return await settingsStore.getSetting('logoUrlDark');
}

export async function getLogoUrlLight(): Promise<string> {
  return await settingsStore.getSetting('logoUrlLight');
}

export async function getLogoWidth(): Promise<string> {
  return await settingsStore.getSetting('logoWidth');
}

export async function getLogoHeight(): Promise<string> {
  return await settingsStore.getSetting('logoHeight');
}

export async function getCurrentFavicon(): Promise<string | null> {
  return await settingsStore.getSetting('currentFavicon');
}
import type { CachedSettings } from '$lib/server/settings-store';

/**
 * Client-side settings store that provides reactive access to site settings
 */
export class SettingsState {
  private _settings = $state<CachedSettings | null>(null);

  constructor(initialSettings?: CachedSettings) {
    if (initialSettings) {
      this._settings = initialSettings;
    }
  }

  /**
   * Get the current settings
   */
  get settings(): CachedSettings | null {
    return this._settings;
  }

  /**
   * Update the settings (typically from server-side data)
   */
  setSettings(newSettings: CachedSettings) {
    this._settings = newSettings;
  }

  /**
   * Get a specific setting value with fallback
   */
  getSetting<K extends keyof Omit<CachedSettings, 'lastUpdated'>>(
    key: K,
    fallback: CachedSettings[K]
  ): CachedSettings[K] {
    return this._settings?.[key] ?? fallback;
  }

  /**
   * Convenient getters for common settings
   */
  get siteName(): string {
    return this._settings?.siteName ?? "AI Chat Interface";
  }

  get siteTitle(): string {
    return this._settings?.siteTitle ?? "AI Chat Interface - 65+ Models";
  }

  get siteDescription(): string {
    return this._settings?.siteDescription ?? "A unified web application for interacting with 65+ AI models from 9 different providers through a single, intuitive interface.";
  }



  get logoUrlDark(): string {
    return this._settings?.logoUrlDark ?? "/branding/logos/default-dark-logo.png";
  }

  get logoUrlLight(): string {
    return this._settings?.logoUrlLight ?? "/branding/logos/default-light-logo.png";
  }

  get logoWidth(): string {
    return this._settings?.logoWidth ?? "170";
  }

  get logoHeight(): string {
    return this._settings?.logoHeight ?? "27";
  }

  get currentFavicon(): string | null {
    return this._settings?.currentFavicon ?? null;
  }

  /**
   * Convenient getters for payment settings
   */
  get paymentEnvironment(): string {
    return this._settings?.paymentEnvironment ?? "test";
  }

  get stripePublishableKey(): string {
    return this._settings?.stripePublishableKey ?? "";
  }

  get stripeSecretKey(): string {
    return this._settings?.stripeSecretKey ?? "";
  }

  get stripeWebhookSecret(): string {
    return this._settings?.stripeWebhookSecret ?? "";
  }
}
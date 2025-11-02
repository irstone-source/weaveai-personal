import { db } from './db';
import { adminSettings, adminFiles } from './db/schema';
import { eq } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Encryption key - in production, use environment variable
const ENCRYPTION_KEY = process.env.ADMIN_SETTINGS_ENCRYPTION_KEY || 'your-32-character-secret-key-here';

// Ensure key is 32 bytes for AES-256
function getKey(): Buffer {
  if (ENCRYPTION_KEY.length >= 32) {
    return Buffer.from(ENCRYPTION_KEY.slice(0, 32));
  }
  return Buffer.concat([Buffer.from(ENCRYPTION_KEY), Buffer.alloc(32)]).subarray(0, 32);
}

// Encrypt sensitive values
function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Prepend IV to encrypted data
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt sensitive values
function decrypt(encryptedText: string): string {
  const key = getKey();
  const parts = encryptedText.split(':');

  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];

  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// List of sensitive keys that should be encrypted
const SENSITIVE_KEYS = [
  'stripe_secret_key',
  'stripe_webhook_secret',
  'google_client_secret',
  'apple_client_secret',
  'twitter_client_secret',
  'facebook_client_secret',
  'openrouter_api_key',
  'gemini_api_key',
  'openai_api_key',
  'xai_api_key',
  'stabilityai_api_key',
  'bfl_api_key',
  'alibaba_api_key',
  'lumalabs_api_key',
  'kling_api_access_key',
  'kling_api_secret_key',
  'r2_account_id',
  'r2_access_key_id',
  'r2_secret_access_key',
  'turnstile_secret_key',
  'smtp_pass',
  'linear_client_secret',
  'fathom_api_key'
];

function shouldEncrypt(key: string): boolean {
  return SENSITIVE_KEYS.some(sensitiveKey => key.includes(sensitiveKey));
}

export interface AdminSetting {
  id: string;
  key: string;
  value: string | null;
  category: string;
  encrypted: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  path: string;
  url: string | null;
  storageLocation: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AdminSettingsService {

  // Get a single setting by key
  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.key, key))
      .limit(1);

    if (!setting || !setting.value) {
      return null;
    }

    if (setting.encrypted) {
      try {
        return decrypt(setting.value);
      } catch (error) {
        console.error(`Failed to decrypt setting ${key}:`, error);
        return null;
      }
    }

    return setting.value;
  }

  // Get multiple settings by category
  async getSettingsByCategory(category: string): Promise<Record<string, string>> {
    const settings = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.category, category));

    const result: Record<string, string> = {};

    for (const setting of settings) {
      if (setting.value) {
        if (setting.encrypted) {
          try {
            result[setting.key] = decrypt(setting.value);
          } catch (error) {
            console.error(`Failed to decrypt setting ${setting.key}:`, error);
          }
        } else {
          result[setting.key] = setting.value;
        }
      }
    }

    return result;
  }

  // Set a single setting
  async setSetting(key: string, value: string, category: string, description?: string): Promise<void> {
    const isEncrypted = shouldEncrypt(key);
    const finalValue = isEncrypted ? encrypt(value) : value;

    // Check if setting exists
    const [existing] = await db
      .select({ id: adminSettings.id })
      .from(adminSettings)
      .where(eq(adminSettings.key, key))
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(adminSettings)
        .set({
          value: finalValue,
          category,
          encrypted: isEncrypted,
          description,
          updatedAt: new Date(),
        })
        .where(eq(adminSettings.key, key));
    } else {
      // Create new
      await db
        .insert(adminSettings)
        .values({
          key,
          value: finalValue,
          category,
          encrypted: isEncrypted,
          description,
        });
    }
  }

  // Set multiple settings atomically
  async setSettings(settings: Array<{ key: string; value: string; category: string; description?: string }>): Promise<void> {
    // Filter out empty values to avoid storing empty strings in database
    const validSettings = settings.filter(setting => {
      return setting.value && setting.value.trim() !== '';
    });

    // For simplicity, we'll do individual updates
    // In production, you might want to use a transaction
    for (const setting of validSettings) {
      await this.setSetting(setting.key, setting.value, setting.category, setting.description);
    }
  }

  // Delete a setting
  async deleteSetting(key: string): Promise<void> {
    await db
      .delete(adminSettings)
      .where(eq(adminSettings.key, key));
  }

  // Get all settings (for export/backup)
  async getAllSettings(): Promise<AdminSetting[]> {
    const settings = await db
      .select()
      .from(adminSettings);

    // Decrypt sensitive values for internal use
    return settings.map(setting => ({
      ...setting,
      value: setting.encrypted && setting.value ? decrypt(setting.value) : setting.value,
    }));
  }

  // File management methods
  async saveFile(file: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    category: string;
    path: string;
    url?: string;
    storageLocation?: string;
  }): Promise<AdminFile> {
    const [savedFile] = await db
      .insert(adminFiles)
      .values({
        ...file,
        storageLocation: file.storageLocation || 'local'
      })
      .returning();

    return savedFile;
  }

  async getFile(category: string): Promise<AdminFile | null> {
    const [file] = await db
      .select()
      .from(adminFiles)
      .where(eq(adminFiles.category, category))
      .limit(1);

    return file || null;
  }

  async deleteFile(id: string): Promise<void> {
    await db
      .delete(adminFiles)
      .where(eq(adminFiles.id, id));
  }
}

// Export a singleton instance
export const adminSettingsService = new AdminSettingsService();

// Helper functions for common settings groups
export async function getGeneralSettings() {
  return await adminSettingsService.getSettingsByCategory('general');
}

export async function getBrandingSettings() {
  return await adminSettingsService.getSettingsByCategory('branding');
}

export async function getPaymentSettings() {
  return await adminSettingsService.getSettingsByCategory('payment');
}

export async function getOAuthSettings() {
  return await adminSettingsService.getSettingsByCategory('oauth');
}

export async function getAIModelSettings() {
  return await adminSettingsService.getSettingsByCategory('ai_models');
}

export async function getCloudStorageSettings() {
  return await adminSettingsService.getSettingsByCategory('cloud_storage');
}

export async function getSecuritySettings() {
  return await adminSettingsService.getSettingsByCategory('security');
}

export async function getMailingSettings() {
  return await adminSettingsService.getSettingsByCategory('mailing');
}
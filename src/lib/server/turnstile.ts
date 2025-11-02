import { getTurnstileSecretKey } from './settings-store';
import { getSecuritySettings } from './admin-settings';
import { env } from '$env/dynamic/private';

// Cloudflare Turnstile siteverify endpoint
const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Response interface from Cloudflare Turnstile API
interface TurnstileVerificationResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

// Our internal verification result
export interface TurnstileVerificationResult {
  success: boolean;
  error?: string;
  errorCodes?: string[];
}

/**
 * Verify a Turnstile token with Cloudflare
 * @param token - The Turnstile token to verify
 * @param remoteip - Optional IP address of the user
 * @returns Promise<TurnstileVerificationResult>
 */
export async function verifyTurnstileToken(
  token: string,
  remoteip?: string
): Promise<TurnstileVerificationResult> {
  try {
    // Get secret key from settings (with fallback to environment variable)
    let secretKey = await getTurnstileSecretKey();
    
    // Fallback to environment variable if not set in admin settings
    if (!secretKey && env.TURNSTILE_SECRET_KEY) {
      secretKey = env.TURNSTILE_SECRET_KEY;
    }
    
    if (!secretKey) {
      return {
        success: false,
        error: 'Turnstile not configured'
      };
    }

    if (!token) {
      return {
        success: false,
        error: 'Turnstile token is required'
      };
    }

    // Prepare form data for the request
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    // Make the verification request
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      console.error('Turnstile verification request failed:', response.status, response.statusText);
      return {
        success: false,
        error: `Verification request failed: ${response.status} ${response.statusText}`
      };
    }

    const data: TurnstileVerificationResponse = await response.json();

    if (data.success) {
      return {
        success: true
      };
    } else {
      console.warn('Turnstile verification failed:', data['error-codes']);
      return {
        success: false,
        error: 'Turnstile verification failed',
        errorCodes: data['error-codes']
      };
    }

  } catch (error) {
    console.error('Error during Turnstile verification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown verification error'
    };
  }
}

/**
 * Check if Turnstile is enabled and configured with proper fallback logic
 * Priority: 1. Database settings, 2. Environment variables (auto-enable if present)
 * @returns Promise<boolean>
 */
export async function isTurnstileEnabled(): Promise<boolean> {
  try {
    const securitySettings = await getSecuritySettings();
    
    // Check if ANY Turnstile settings exist in database
    const hasDbSettings = !!(
      securitySettings.turnstile_enabled !== undefined ||
      securitySettings.turnstile_site_key ||
      securitySettings.turnstile_secret_key
    );
    
    if (hasDbSettings) {
      // DATABASE MODE: Use database settings exclusively
      const isEnabled = securitySettings.turnstile_enabled === 'true';
      const dbSiteKey = securitySettings.turnstile_site_key || '';
      const dbSecretKey = securitySettings.turnstile_secret_key || '';
      const hasDbKeys = !!(dbSiteKey.trim() && dbSecretKey.trim());
      const result = isEnabled && hasDbKeys;
      
      console.log(`Turnstile: Using database configuration - ${result ? 'enabled' : 'disabled'}`);
      
      return result;
    } else {
      // ENVIRONMENT FALLBACK MODE: Auto-enable if env keys exist
      const envSiteKey = env.TURNSTILE_SITE_KEY || '';
      const envSecretKey = env.TURNSTILE_SECRET_KEY || '';
      const hasEnvKeys = !!(envSiteKey.trim() && envSecretKey.trim());
      
      console.log(`Turnstile: Using environment configuration - ${hasEnvKeys ? 'enabled' : 'disabled'}`);
      
      return hasEnvKeys; // Auto-enable if environment keys exist
    }
  } catch (error) {
    console.error('Error checking Turnstile configuration:', error);
    return false;
  }
}

/**
 * Get human-readable error message for Turnstile error codes
 * @param errorCodes - Array of error codes from Turnstile API
 * @returns string
 */
export function getTurnstileErrorMessage(errorCodes?: string[]): string {
  if (!errorCodes || errorCodes.length === 0) {
    return 'Verification failed';
  }

  const errorMessages: Record<string, string> = {
    'missing-input-secret': 'Secret key is missing',
    'invalid-input-secret': 'Secret key is invalid',
    'missing-input-response': 'Verification token is missing',
    'invalid-input-response': 'Verification token is invalid or has expired',
    'bad-request': 'Request is malformed',
    'timeout-or-duplicate': 'Token has expired or was already used',
    'internal-error': 'Internal error occurred during verification'
  };

  const messages = errorCodes
    .map(code => errorMessages[code] || `Unknown error: ${code}`)
    .join(', ');

  return `Verification failed: ${messages}`;
}
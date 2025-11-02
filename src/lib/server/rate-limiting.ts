import { AUTH_RATE_LIMITS, rateLimiter } from './security-headers.js';

/**
 * Rate limiting service for authentication endpoints
 * Provides progressive delays and brute force protection
 */

export interface RateLimitResult {
  allowed: boolean;
  resetTime?: number;
  remaining?: number;
  message?: string;
}

/**
 * Generate rate limit key for different authentication operations
 */
function generateRateLimitKey(operation: string, identifier: string, ip?: string): string {
  // Use both email and IP for better security
  const key = ip ? `${operation}:${identifier}:${ip}` : `${operation}:${identifier}`;
  return key;
}

/**
 * Check rate limit for login attempts
 */
export function checkLoginRateLimit(email: string, clientIP?: string): RateLimitResult {
  const config = AUTH_RATE_LIMITS.login;
  const key = generateRateLimitKey('login', email, clientIP);

  const result = rateLimiter.isAllowed(key, config);

  if (!result.allowed) {
    const resetInMinutes = result.resetTime ? Math.ceil((result.resetTime - Date.now()) / (1000 * 60)) : 15;
    return {
      allowed: false,
      resetTime: result.resetTime,
      message: `Too many login attempts. Please try again in ${resetInMinutes} minute${resetInMinutes !== 1 ? 's' : ''}.`
    };
  }

  return { allowed: true };
}


/**
 * Check rate limit for password reset requests
 */
export function checkPasswordResetRateLimit(email: string, clientIP?: string): RateLimitResult {
  const config = AUTH_RATE_LIMITS.passwordReset;
  const key = generateRateLimitKey('password-reset', email, clientIP);

  const result = rateLimiter.isAllowed(key, config);

  if (!result.allowed) {
    const resetInMinutes = result.resetTime ? Math.ceil((result.resetTime - Date.now()) / (1000 * 60)) : 60;
    return {
      allowed: false,
      resetTime: result.resetTime,
      message: `Too many password reset requests. Please try again in ${resetInMinutes} minute${resetInMinutes !== 1 ? 's' : ''}.`
    };
  }

  return { allowed: true };
}

/**
 * Check rate limit for email verification requests
 */
export function checkEmailVerificationRateLimit(email: string, clientIP?: string): RateLimitResult {
  const config = AUTH_RATE_LIMITS.emailVerification;
  const key = generateRateLimitKey('email-verify', email, clientIP);

  const result = rateLimiter.isAllowed(key, config);

  if (!result.allowed) {
    const resetInMinutes = result.resetTime ? Math.ceil((result.resetTime - Date.now()) / (1000 * 60)) : 60;
    return {
      allowed: false,
      resetTime: result.resetTime,
      message: `Too many verification email requests. Please try again in ${resetInMinutes} minute${resetInMinutes !== 1 ? 's' : ''}.`
    };
  }

  return { allowed: true };
}

/**
 * Progressive delay for failed login attempts
 * Implements exponential backoff for the same IP/email combination
 */
class ProgressiveDelayManager {
  private failures: Map<string, { count: number; lastAttempt: number }> = new Map();
  private readonly BASE_DELAY = 1000; // 1 second
  private readonly MAX_DELAY = 30000; // 30 seconds
  private readonly FAILURE_WINDOW = 60 * 60 * 1000; // 1 hour

  /**
   * Record a failed login attempt
   */
  recordFailure(email: string, clientIP?: string): void {
    const key = generateRateLimitKey('failure', email, clientIP);
    const now = Date.now();
    const existing = this.failures.get(key);

    if (!existing || (now - existing.lastAttempt) > this.FAILURE_WINDOW) {
      // First failure or window expired
      this.failures.set(key, { count: 1, lastAttempt: now });
    } else {
      // Increment failure count
      this.failures.set(key, { count: existing.count + 1, lastAttempt: now });
    }
  }

  /**
   * Get required delay before next attempt
   */
  getRequiredDelay(email: string, clientIP?: string): number {
    const key = generateRateLimitKey('failure', email, clientIP);
    const failure = this.failures.get(key);

    if (!failure) {
      return 0;
    }

    const now = Date.now();
    if ((now - failure.lastAttempt) > this.FAILURE_WINDOW) {
      // Window expired
      this.failures.delete(key);
      return 0;
    }

    // Calculate exponential backoff: base * 2^(failures-1)
    const delay = Math.min(this.BASE_DELAY * Math.pow(2, failure.count - 1), this.MAX_DELAY);
    const timeSinceLastAttempt = now - failure.lastAttempt;

    return Math.max(0, delay - timeSinceLastAttempt);
  }

  /**
   * Clear failures for successful login
   */
  clearFailures(email: string, clientIP?: string): void {
    const key = generateRateLimitKey('failure', email, clientIP);
    this.failures.delete(key);
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, failure] of this.failures.entries()) {
      if ((now - failure.lastAttempt) > this.FAILURE_WINDOW) {
        this.failures.delete(key);
      }
    }
  }
}

// Global progressive delay manager
export const progressiveDelayManager = new ProgressiveDelayManager();

// Clean up progressive delays every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    progressiveDelayManager.cleanup();
  }, 10 * 60 * 1000);
}

/**
 * Check if login attempt should be delayed
 */
export function checkLoginDelay(email: string, clientIP?: string): {
  shouldDelay: boolean;
  delayMs: number;
  message?: string;
} {
  const delayMs = progressiveDelayManager.getRequiredDelay(email, clientIP);

  if (delayMs > 0) {
    const delaySeconds = Math.ceil(delayMs / 1000);
    return {
      shouldDelay: true,
      delayMs,
      message: `Please wait ${delaySeconds} second${delaySeconds !== 1 ? 's' : ''} before trying again.`
    };
  }

  return { shouldDelay: false, delayMs: 0 };
}

/**
 * Record successful login (clears progressive delays)
 */
export function recordSuccessfulLogin(email: string, clientIP?: string): void {
  progressiveDelayManager.clearFailures(email, clientIP);
}

/**
 * Record failed login attempt
 */
export function recordFailedLogin(email: string, clientIP?: string): void {
  progressiveDelayManager.recordFailure(email, clientIP);
}

/**
 * Comprehensive authentication rate limit check
 * Combines both rate limiting and progressive delays
 */
export function checkAuthenticationLimits(
  operation: 'login' | 'password-reset' | 'email-verify',
  email: string,
  clientIP?: string
): RateLimitResult {
  // Check operation-specific rate limits
  let rateLimitResult: RateLimitResult;

  switch (operation) {
    case 'login':
      rateLimitResult = checkLoginRateLimit(email, clientIP);
      break;
    case 'password-reset':
      rateLimitResult = checkPasswordResetRateLimit(email, clientIP);
      break;
    case 'email-verify':
      rateLimitResult = checkEmailVerificationRateLimit(email, clientIP);
      break;
    default:
      return { allowed: false, message: 'Invalid operation' };
  }

  if (!rateLimitResult.allowed) {
    return rateLimitResult;
  }

  // For login operations, also check progressive delays
  if (operation === 'login') {
    const delayCheck = checkLoginDelay(email, clientIP);
    if (delayCheck.shouldDelay) {
      return {
        allowed: false,
        message: delayCheck.message
      };
    }
  }

  return { allowed: true };
}

/**
 * Get client IP address from request headers
 * Handles various proxy configurations
 */
export function getClientIP(request: Request): string {
  // Check various headers for the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  if (realIP) {
    return realIP;
  }

  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, get the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to a default value
  return 'unknown';
}
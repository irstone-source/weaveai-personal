import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Security headers middleware for comprehensive protection
 * Implements OWASP recommended security headers
 */

/**
 * Generate Content Security Policy based on environment
 */
function generateCSP(): string {
  const isDev = env.NODE_ENV === 'development';

  // Base CSP directives
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-eval'", // Required for Vite in development
      "'unsafe-inline'", // Required for some dynamic content - should be minimized in production
      "https://challenges.cloudflare.com", // Turnstile
      "https://js.stripe.com", // Stripe
      ...(isDev ? ["'unsafe-eval'", "'unsafe-inline'"] : [])
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for dynamic styles - consider using nonces in production
      "https://fonts.googleapis.com"
    ],
    'font-src': [
      "'self'",
      "data:",
      "https://fonts.gstatic.com"
    ],
    'img-src': [
      "'self'",
      "data:",
      "blob:",
      "https:", // Allow images from HTTPS sources (for OAuth avatars, etc.)
      ...(isDev ? ["http:"] : [])
    ],
    'media-src': [
      "'self'",
      "data:",
      "blob:"
    ],
    'connect-src': [
      "'self'",
      "https://api.stripe.com",
      "https://challenges.cloudflare.com", // Turnstile
      "https://*.googleapis.com", // Google APIs
      "https://*.facebook.com", // Facebook OAuth
      "https://*.twitter.com", // Twitter OAuth
      "https://*.apple.com", // Apple OAuth
      ...(isDev ? ["ws:", "wss:"] : []) // WebSocket for HMR in development
    ],
    'frame-src': [
      "'self'",
      "https://js.stripe.com",
      "https://challenges.cloudflare.com" // Turnstile
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'", "https://preview.codecanyon.net"]
  };

  // Only upgrade insecure requests in production (causes issues in local HTTP development)
  if (!isDev) {
    directives['upgrade-insecure-requests'] = [];
  }

  // Build CSP string
  return Object.entries(directives)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
}

/**
 * Security headers configuration
 */
export function getSecurityHeaders(): Record<string, string> {
  const isDev = env.NODE_ENV === 'development';
  const isProduction = env.NODE_ENV === 'production';

  const headers: Record<string, string> = {
    // Content Security Policy
    'Content-Security-Policy': generateCSP(),

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Allow iframe embedding from self and CodeCanyon preview
    // Note: Modern browsers prefer CSP frame-ancestors, but we keep this for legacy browser support
    'X-Frame-Options': 'SAMEORIGIN',

    // XSS Protection (legacy but still useful)
    'X-XSS-Protection': '1; mode=block',

    // Referrer Policy - balance between security and functionality
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions Policy (Feature Policy)
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=(self)',
      'usb=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()',
      'autoplay=()',
      'encrypted-media=()',
      'picture-in-picture=()'
    ].join(', '),

    // Cross-Origin Policies
    'Cross-Origin-Embedder-Policy': 'unsafe-none', // Required for some third-party integrations
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups', // Required for OAuth popups
    'Cross-Origin-Resource-Policy': 'same-site'
  };

  // Production-only headers
  if (isProduction) {
    // HTTP Strict Transport Security
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';

    // Expect-CT for certificate transparency (modern browsers)
    headers['Expect-CT'] = 'max-age=86400, enforce';
  }

  // Development-specific adjustments
  if (isDev) {
    // Relax some restrictions for development
    headers['Cross-Origin-Embedder-Policy'] = 'unsafe-none';

    // Don't enforce HSTS in development
    delete headers['Strict-Transport-Security'];
    delete headers['Expect-CT'];
  }

  return headers;
}

/**
 * Security headers middleware
 */
export const securityHeaders: Handle = async ({ event, resolve }) => {
  // Get the response first
  const response = await resolve(event);

  // Apply security headers
  const headers = getSecurityHeaders();

  Object.entries(headers).forEach(([name, value]) => {
    response.headers.set(name, value);
  });

  // Remove potentially dangerous headers
  response.headers.delete('Server');
  response.headers.delete('X-Powered-By');

  // Add custom security header to identify protected responses
  response.headers.set('X-Security-Headers', 'enabled');

  return response;
};

/**
 * Validate and sanitize redirect URLs for security
 * Prevents open redirect vulnerabilities
 */
export function validateRedirectUrl(url: string | null | undefined, defaultUrl: string = '/'): string {
  if (!url || typeof url !== 'string') {
    return defaultUrl;
  }

  try {
    // Parse the URL
    const parsedUrl = new URL(url, 'http://localhost'); // Use dummy base for relative URLs

    // Only allow relative URLs or same-origin URLs
    if (url.startsWith('/') && !url.startsWith('//')) {
      // Relative URL - safe
      return url;
    }

    // For absolute URLs, check if they're same-origin
    const currentOrigin = env.PUBLIC_ORIGIN || 'http://localhost:5173';
    const currentUrl = new URL(currentOrigin);

    if (parsedUrl.origin === currentUrl.origin) {
      return url;
    }

    // Not safe - return default
    return defaultUrl;
  } catch {
    // URL parsing failed - return default
    return defaultUrl;
  }
}

/**
 * Rate limiting configuration for authentication endpoints
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  message: string; // Error message when limit exceeded
}

/**
 * Rate limiting configurations for different auth operations
 */
export const AUTH_RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: 'Too many login attempts. Please try again in 15 minutes.'
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset requests per hour
    message: 'Too many password reset requests. Please try again in 1 hour.'
  },
  emailVerification: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 verification emails per hour
    message: 'Too many verification email requests. Please try again in 1 hour.'
  }
};

/**
 * Simple in-memory rate limiting (for production, consider using Redis)
 */
class SimpleRateLimit {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check if request is within rate limit
   */
  isAllowed(key: string, config: RateLimitConfig): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const attempt = this.attempts.get(key);

    if (!attempt || now > attempt.resetTime) {
      // No previous attempts or window expired
      this.attempts.set(key, { count: 1, resetTime: now + config.windowMs });
      return { allowed: true };
    }

    if (attempt.count >= config.max) {
      // Rate limit exceeded
      return { allowed: false, resetTime: attempt.resetTime };
    }

    // Increment attempt count
    attempt.count++;
    this.attempts.set(key, attempt);
    return { allowed: true };
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, attempt] of this.attempts.entries()) {
      if (now > attempt.resetTime) {
        this.attempts.delete(key);
      }
    }
  }
}

// Global rate limiter instance
export const rateLimiter = new SimpleRateLimit();

// Clean up rate limiter every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    rateLimiter.cleanup();
  }, 5 * 60 * 1000);
}
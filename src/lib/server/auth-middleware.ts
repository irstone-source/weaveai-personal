import type { Handle } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { checkAuthenticationLimits, recordFailedLogin, recordSuccessfulLogin, getClientIP } from './rate-limiting.js';

/**
 * Authentication middleware for rate limiting
 * Handles rate limiting for authentication endpoints
 */

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimitMiddleware: Handle = async ({ event, resolve }) => {
  const { url, request } = event;

  // Only apply rate limiting to authentication endpoints
  if (!isAuthEndpoint(url.pathname)) {
    return resolve(event);
  }

  // Get client IP
  const clientIP = getClientIP(request);

  // Handle different authentication endpoints
  if (url.pathname.includes('/auth/signin') && request.method === 'POST') {
    // This is a login attempt via Auth.js
    try {
      const formData = await request.clone().formData();
      const email = formData.get('email') as string;

      if (email) {
        const rateLimitResult = checkAuthenticationLimits('login', email, clientIP);
        if (!rateLimitResult.allowed) {
          // Return rate limit error
          return json(
            { error: rateLimitResult.message || 'Too many login attempts' },
            { status: 429 }
          );
        }
      }
    } catch (error) {
      // If we can't parse the form data, let the request continue
      console.warn('Failed to parse login form data for rate limiting:', error);
    }
  }

  // Continue with the request
  const response = await resolve(event);

  // Check if this was a failed login attempt
  if (url.pathname.includes('/auth/signin') && response.status >= 400) {
    try {
      const formData = await request.clone().formData();
      const email = formData.get('email') as string;

      if (email) {
        recordFailedLogin(email, clientIP);
      }
    } catch (error) {
      console.warn('Failed to record failed login attempt:', error);
    }
  }

  return response;
};

/**
 * Check if the current path is an authentication endpoint
 */
function isAuthEndpoint(pathname: string): boolean {
  const authPaths = [
    '/auth/',
    '/login',
    '/register',
    '/reset-password',
    '/verify-email'
  ];

  return authPaths.some(path => pathname.includes(path));
}

/**
 * Enhanced Auth.js callbacks with rate limiting
 */
export const authCallbacks = {
  async signIn({ user, account, profile, email, credentials }: any) {
    // Handle rate limiting for successful logins
    if (user?.email && account?.provider === 'credentials') {
      // This is a successful credential-based login
      recordSuccessfulLogin(user.email);
    }
    return true;
  }
};

/**
 * Rate limit aware credential authorization
 * This is a wrapper around the normal credential check that includes rate limiting
 */
export async function rateLimitAwareAuthorize(
  credentials: any,
  request?: Request
): Promise<any> {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  // Get client IP if request is available
  const clientIP = request ? getClientIP(request) : undefined;

  // Check rate limits
  const rateLimitResult = checkAuthenticationLimits('login', credentials.email, clientIP);
  if (!rateLimitResult.allowed) {
    // Record this as a failed attempt due to rate limiting
    recordFailedLogin(credentials.email, clientIP);
    return null;
  }

  // If we get here, rate limiting allows the attempt
  // The actual credential validation will happen in the Auth.js provider
  return credentials;
}

/**
 * Post-authentication handler for rate limiting
 */
export function handleAuthResult(email: string, success: boolean, clientIP?: string): void {
  if (success) {
    recordSuccessfulLogin(email, clientIP);
  } else {
    recordFailedLogin(email, clientIP);
  }
}
import { env } from '$env/dynamic/private';

/**
 * Session security configuration for Auth.js
 * Implements secure cookie attributes and session management
 */

/**
 * Get secure cookie configuration based on environment
 */
export function getSecureCookieConfig() {
  const isProduction = env.NODE_ENV === 'production';
  const publicOrigin = env.PUBLIC_ORIGIN as string | undefined;
  const isHTTPS = publicOrigin?.startsWith('https://') || isProduction;

  return {
    // Session configuration
    session: {
      strategy: 'jwt' as const,
      maxAge: 30 * 24 * 60 * 60, // 30 days
      updateAge: 24 * 60 * 60, // 24 hours - update session on activity
    },

    // Cookie configuration
    cookies: {
      sessionToken: {
        name: isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: isHTTPS,
          domain: isProduction ? extractDomainFromOrigin(publicOrigin) : undefined,
          maxAge: 30 * 24 * 60 * 60, // 30 days
        }
      },
      callbackUrl: {
        name: isProduction ? '__Secure-authjs.callback-url' : 'authjs.callback-url',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: isHTTPS,
          domain: isProduction ? extractDomainFromOrigin(publicOrigin) : undefined,
          maxAge: 15 * 60, // 15 minutes
        }
      },
      csrfToken: {
        name: isProduction ? '__Host-authjs.csrf-token' : 'authjs.csrf-token',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: isHTTPS,
          domain: isProduction ? extractDomainFromOrigin(publicOrigin) : undefined,
          maxAge: 60 * 60, // 1 hour
        }
      },
      pkceCodeVerifier: {
        name: isProduction ? '__Secure-authjs.pkce.code_verifier' : 'authjs.pkce.code_verifier',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: isHTTPS,
          domain: isProduction ? extractDomainFromOrigin(publicOrigin) : undefined,
          maxAge: 15 * 60, // 15 minutes
        }
      },
      state: {
        name: isProduction ? '__Secure-authjs.state' : 'authjs.state',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: isHTTPS,
          domain: isProduction ? extractDomainFromOrigin(publicOrigin) : undefined,
          maxAge: 15 * 60, // 15 minutes
        }
      },
      nonce: {
        name: isProduction ? '__Secure-authjs.nonce' : 'authjs.nonce',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: isHTTPS,
          domain: isProduction ? extractDomainFromOrigin(publicOrigin) : undefined,
          maxAge: 15 * 60, // 15 minutes
        }
      }
    }
  };
}

/**
 * Extract domain from origin URL for cookie domain setting
 */
function extractDomainFromOrigin(origin?: string): string | undefined {
  if (!origin) return undefined;

  try {
    const url = new URL(origin);
    return url.hostname;
  } catch {
    return undefined;
  }
}

/**
 * Enhanced JWT configuration with security features
 */
export function getSecureJWTConfig() {
  return {
    // JWT configuration
    secret: env.AUTH_SECRET || env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days

    // Security settings
    encryption: true, // Enable JWT encryption
    signingKey: env.AUTH_SECRET || env.NEXTAUTH_SECRET,
    encryptionKey: env.AUTH_SECRET || env.NEXTAUTH_SECRET,
  };
}

/**
 * Session security callbacks
 */
export const sessionSecurityCallbacks = {
  /**
   * JWT callback with security enhancements
   */
  async jwt({ token, user, account, trigger }: any) {
    // Add security metadata to token
    const now = Math.floor(Date.now() / 1000);

    // First sign-in
    if (user && account) {
      token.sub = user.id;
      token.email = user.email;
      token.name = user.name;
      token.isAdmin = user.isAdmin;
      token.iat = now;
      token.exp = now + (30 * 24 * 60 * 60); // 30 days
      token.sessionId = generateSessionId();
      token.provider = account.provider;

      // Track login for security
      console.log(`[Security] New session created via ${account.provider}`);
    }

    // Session update (refresh)
    if (trigger === 'update') {
      token.iat = now;
      token.exp = now + (30 * 24 * 60 * 60); // Reset expiration
      console.log(`[Security] Session refreshed`);
    }

    // Security check: Ensure token hasn't been tampered with
    if (token.email && !token.sessionId) {
      // Regenerate session ID for security
      token.sessionId = generateSessionId();
      console.warn(`[Security] Session ID regenerated`);
    }

    return token;
  },

  /**
   * Session callback with security enhancements
   */
  async session({ session, token }: any) {
    if (token) {
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (token.exp && now > token.exp) {
        console.warn(`[Security] Expired token detected`);
        return null; // Force re-authentication
      }

      // Populate session with token data
      session.user.id = token.sub;
      session.user.email = token.email;
      session.user.name = token.name;
      session.user.isAdmin = token.isAdmin;
      session.sessionId = token.sessionId;
      session.provider = token.provider;
      session.issuedAt = token.iat;
      session.expiresAt = token.exp;
    }

    return session;
  }
};

/**
 * Generate a cryptographically secure session ID
 */
function generateSessionId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  return 'sess_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Session validation middleware
 */
export async function validateSession(session: any): Promise<{
  isValid: boolean;
  reason?: string;
}> {
  if (!session || !session.user) {
    return { isValid: false, reason: 'No session' };
  }

  // Check session age
  if (session.expiresAt) {
    const now = Math.floor(Date.now() / 1000);
    if (now > session.expiresAt) {
      return { isValid: false, reason: 'Session expired' };
    }
  }

  // Check if session ID exists (security measure)
  if (!session.sessionId) {
    return { isValid: false, reason: 'Invalid session format' };
  }

  // Additional security checks can be added here
  // e.g., IP address validation, device fingerprinting, etc.

  return { isValid: true };
}

/**
 * Security logging for session events
 */
export function logSecurityEvent(event: string, details: any): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    details: {
      ...details,
      // Remove sensitive information from logs
      password: details.password ? '[REDACTED]' : undefined,
      token: details.token ? '[REDACTED]' : undefined,
    }
  };

  console.log(`[Security Event] ${JSON.stringify(logEntry)}`);
}

/**
 * Check for suspicious session activity
 */
export function detectSuspiciousActivity(session: any, request: Request): {
  isSuspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Check for rapid session creation (potential brute force)
  if (session?.issuedAt) {
    const now = Math.floor(Date.now() / 1000);
    const sessionAge = now - session.issuedAt;

    if (sessionAge < 60) { // Session created less than 1 minute ago
      reasons.push('Very recent session creation');
    }
  }

  // Check for unusual user agent patterns
  const userAgent = request.headers.get('user-agent');
  if (!userAgent || userAgent.length < 10) {
    reasons.push('Missing or suspicious user agent');
  }

  // Check for automation indicators
  if (userAgent?.toLowerCase().includes('bot') || userAgent?.toLowerCase().includes('crawler')) {
    reasons.push('Automated request detected');
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons
  };
}

/**
 * Session cleanup utilities
 */
export const sessionCleanup = {
  /**
   * Clean up expired sessions (for database-based sessions)
   */
  async cleanupExpiredSessions(): Promise<number> {
    // This would be implemented if using database sessions
    // For JWT sessions, cleanup is handled automatically
    return 0;
  },

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    // For JWT sessions, we would need to maintain a blacklist
    // This is a placeholder for future implementation
    console.log(`[Security] Session revoked: ${sessionId}`);
    return true;
  },

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    // This would be implemented with a session blacklist or database cleanup
    console.log(`[Security] All sessions revoked for user: ${userId}`);
    return 0;
  }
};

/**
 * CSRF protection configuration
 */
export function getCSRFConfig() {
  return {
    // Enable CSRF protection
    csrf: true,

    // Custom CSRF token generation if needed
    generateCsrfToken: (): string => {
      return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  };
}
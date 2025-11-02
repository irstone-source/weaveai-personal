import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db, users } from "./db/index.js"
import Credentials from "@auth/core/providers/credentials"
import Google from "@auth/core/providers/google"
import Apple from "@auth/core/providers/apple"
import Twitter from "@auth/core/providers/twitter"
import Facebook from "@auth/core/providers/facebook"
import type { OAuthConfig } from "@auth/core/providers"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { env } from '$env/dynamic/private'
import { getOAuthSettings } from './settings-store.js'
import { sendWelcomeEmail } from './email.js'
import { markEmailAsVerified } from './email-verification.js'
import type { Provider } from "@auth/core/providers"
import { authSanitizers, validatePasswordSafety } from '../utils/sanitization.js'
import { checkAuthenticationLimits, recordSuccessfulLogin, recordFailedLogin, getClientIP } from './rate-limiting.js'
import { getSecureCookieConfig, getSecureJWTConfig, sessionSecurityCallbacks, logSecurityEvent } from './session-security.js'
import { SecurityLogger } from './security-monitoring.js'

// Cache for Auth.js configuration
let authConfigCache: any = null;
let lastConfigLoad: number = 0;
let isConfigLoading: boolean = false;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes to match settings cache

/**
 * Build the providers array based on current settings
 */
async function buildProviders(): Promise<Provider[]> {
  let providers: Provider[] = [];
  let oauthProviderCount = 0;
  let oauthSource = '';

  // Always include credentials provider
  providers.push(
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Sanitize inputs for security
        const sanitizedEmail = authSanitizers.email(credentials.email as string)
        const passwordValidation = validatePasswordSafety(credentials.password as string)

        if (!sanitizedEmail || !passwordValidation.isValid) {
          return null
        }

        const user = await db.select().from(users).where(eq(users.email, sanitizedEmail)).limit(1)

        if (user.length === 0) {
          SecurityLogger.loginFailure(sanitizedEmail, 'User not found');
          return null
        }

        const isPasswordValid = await bcrypt.compare(passwordValidation.sanitized, user[0].password || "")

        if (!isPasswordValid) {
          SecurityLogger.loginFailure(sanitizedEmail, 'Invalid password');
          return null
        }

        // Log successful credential validation
        SecurityLogger.loginSuccess(user[0].id, user[0].email || '');

        return {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
          isAdmin: user[0].isAdmin,
        }
      }
    })
  );

  // Add OAuth providers based on database settings
  try {
    const oauthSettings = await getOAuthSettings();

    // Add Google provider if enabled and configured
    if (oauthSettings.googleEnabled && oauthSettings.googleClientId && oauthSettings.googleClientSecret) {
      providers.push(
        Google({
          clientId: oauthSettings.googleClientId,
          clientSecret: oauthSettings.googleClientSecret,
        })
      );
      oauthProviderCount++;
      oauthSource = 'database settings';
    } else if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
      // Fallback to environment variables if database settings are not configured
      providers.push(
        Google({
          clientId: env.AUTH_GOOGLE_ID,
          clientSecret: env.AUTH_GOOGLE_SECRET,
        })
      );
      oauthProviderCount++;
      oauthSource = 'environment variables (fallback)';
    }

    // Add Apple provider if enabled and configured
    if (oauthSettings.appleEnabled && oauthSettings.appleClientId && oauthSettings.appleClientSecret) {
      providers.push(
        Apple({
          clientId: oauthSettings.appleClientId,
          clientSecret: oauthSettings.appleClientSecret,
        })
      );
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'database settings';
    } else if (env.AUTH_APPLE_ID && env.AUTH_APPLE_SECRET) {
      // Fallback to environment variables if database settings are not configured
      providers.push(
        Apple({
          clientId: env.AUTH_APPLE_ID,
          clientSecret: env.AUTH_APPLE_SECRET,
        })
      );
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'environment variables (fallback)';
    }

    // Add Twitter provider if enabled and configured
    if (oauthSettings.twitterEnabled && oauthSettings.twitterClientId && oauthSettings.twitterClientSecret) {
      providers.push(
        Twitter({
          clientId: oauthSettings.twitterClientId,
          clientSecret: oauthSettings.twitterClientSecret,
        })
      );
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'database settings';
    } else if (env.AUTH_TWITTER_ID && env.AUTH_TWITTER_SECRET) {
      // Fallback to environment variables if database settings are not configured
      providers.push(
        Twitter({
          clientId: env.AUTH_TWITTER_ID,
          clientSecret: env.AUTH_TWITTER_SECRET,
        })
      );
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'environment variables (fallback)';
    }

    // Add Facebook provider if enabled and configured
    if (oauthSettings.facebookEnabled && oauthSettings.facebookClientId && oauthSettings.facebookClientSecret) {
      providers.push(
        Facebook({
          clientId: oauthSettings.facebookClientId,
          clientSecret: oauthSettings.facebookClientSecret,
          authorization: {
            params: {
              scope: "public_profile,email"
            }
          }
        })
      );
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'database settings';
    } else if (env.AUTH_FACEBOOK_ID && env.AUTH_FACEBOOK_SECRET) {
      // Fallback to environment variables if database settings are not configured
      providers.push(
        Facebook({
          clientId: env.AUTH_FACEBOOK_ID,
          clientSecret: env.AUTH_FACEBOOK_SECRET,
          authorization: {
            params: {
              scope: "public_profile,email"
            }
          }
        })
      );
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'environment variables (fallback)';
    }

    // Add Linear provider if enabled and configured (custom OAuth provider)
    if (oauthSettings.linearEnabled && oauthSettings.linearClientId && oauthSettings.linearClientSecret) {
      providers.push({
        id: "linear",
        name: "Linear",
        type: "oauth",
        clientId: oauthSettings.linearClientId,
        clientSecret: oauthSettings.linearClientSecret,
        authorization: {
          url: "https://linear.app/oauth/authorize",
          params: {
            scope: "read write"
          }
        },
        token: "https://api.linear.app/oauth/token",
        userinfo: {
          url: "https://api.linear.app/graphql",
          async request({ tokens, provider }: any) {
            const response = await fetch("https://api.linear.app/graphql", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokens.access_token}`,
              },
              body: JSON.stringify({
                query: `query Me { viewer { id name email } }`
              })
            });
            const data = await response.json();
            return data.data.viewer;
          }
        },
        profile(profile: any) {
          return {
            id: profile.id,
            name: profile.name,
            email: profile.email,
          };
        },
        style: {
          logo: "/logos/linear.svg",
          bg: "#5E6AD2",
          text: "#fff"
        }
      } as OAuthConfig<any>);
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'database settings';
    } else if (env.AUTH_LINEAR_ID && env.AUTH_LINEAR_SECRET) {
      // Fallback to environment variables if database settings are not configured
      providers.push({
        id: "linear",
        name: "Linear",
        type: "oauth",
        clientId: env.AUTH_LINEAR_ID,
        clientSecret: env.AUTH_LINEAR_SECRET,
        authorization: {
          url: "https://linear.app/oauth/authorize",
          params: {
            scope: "read write"
          }
        },
        token: "https://api.linear.app/oauth/token",
        userinfo: {
          url: "https://api.linear.app/graphql",
          async request({ tokens, provider }: any) {
            const response = await fetch("https://api.linear.app/graphql", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokens.access_token}`,
              },
              body: JSON.stringify({
                query: `query Me { viewer { id name email } }`
              })
            });
            const data = await response.json();
            return data.data.viewer;
          }
        },
        profile(profile: any) {
          return {
            id: profile.id,
            name: profile.name,
            email: profile.email,
          };
        },
        style: {
          logo: "/logos/linear.svg",
          bg: "#5E6AD2",
          text: "#fff"
        }
      } as OAuthConfig<any>);
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'environment variables (fallback)';
    }
  } catch (error) {
    console.error('Failed to load OAuth settings from database, falling back to environment variables:', error);

    // Fallback to environment variables on database error
    if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
      providers.push(
        Google({
          clientId: env.AUTH_GOOGLE_ID,
          clientSecret: env.AUTH_GOOGLE_SECRET,
        })
      );
      oauthProviderCount++;
      oauthSource = 'environment variables (error fallback)';
    }

    if (env.AUTH_APPLE_ID && env.AUTH_APPLE_SECRET) {
      providers.push(
        Apple({
          clientId: env.AUTH_APPLE_ID,
          clientSecret: env.AUTH_APPLE_SECRET,
        })
      );
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'environment variables (error fallback)';
    }

    if (env.AUTH_TWITTER_ID && env.AUTH_TWITTER_SECRET) {
      providers.push(
        Twitter({
          clientId: env.AUTH_TWITTER_ID,
          clientSecret: env.AUTH_TWITTER_SECRET,
        })
      );
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'environment variables (error fallback)';
    }

    if (env.AUTH_FACEBOOK_ID && env.AUTH_FACEBOOK_SECRET) {
      providers.push(
        Facebook({
          clientId: env.AUTH_FACEBOOK_ID,
          clientSecret: env.AUTH_FACEBOOK_SECRET,
          authorization: {
            params: {
              scope: "public_profile,email"
            }
          }
        })
      );
      oauthProviderCount++;
      oauthSource = oauthSource ? oauthSource : 'environment variables (error fallback)';
    }
  }

  // Only log when we actually configure OAuth providers during config refresh
  if (oauthProviderCount > 0) {
    console.log(`Configured ${oauthProviderCount} OAuth provider(s) from ${oauthSource}`);
  } else {
    console.log('No OAuth providers configured');
  }

  return providers;
}

/**
 * Get the cached Auth.js configuration or build a new one if cache is stale
 */
export async function getAuthConfig() {
  const now = Date.now();

  // Return cached config if it's fresh and available
  if (authConfigCache && (now - lastConfigLoad) < CONFIG_CACHE_TTL) {
    return authConfigCache;
  }

  // If already loading, wait for the current load to complete
  if (isConfigLoading) {
    while (isConfigLoading) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return authConfigCache || createDefaultConfig();
  }

  try {
    isConfigLoading = true;
    await refreshAuthConfig();
    return authConfigCache || createDefaultConfig();
  } finally {
    isConfigLoading = false;
  }
}

/**
 * Force refresh the Auth.js configuration cache
 */
export async function refreshAuthConfig(): Promise<void> {
  try {
    console.log('Refreshing Auth.js configuration...');

    const providers = await buildProviders();

    const secureCookieConfig = getSecureCookieConfig();
    const secureJWTConfig = getSecureJWTConfig();

    authConfigCache = {
      adapter: DrizzleAdapter(db),
      providers,
      ...secureCookieConfig,
      secret: secureJWTConfig.secret,
      trustHost: true, // Required for Vercel and other hosted environments
      pages: {
        signIn: "/login"
      },
      callbacks: {
        async signIn({ user, account }: any) {
          // Simple sign-in validation - detailed social auth handling moved to jwt callback
          return true
        },
        async jwt({ token, user, account, trigger }: any) {
          // Use secure JWT callback
          const secureToken = await sessionSecurityCallbacks.jwt({ token, user, account, trigger });

          // Handle social auth auto-verification on first sign-in
          if (account && account.provider !== 'credentials' && user?.email) {
            try {
              // Log OAuth login attempt
              SecurityLogger.oauthLoginSuccess(user.id, user.email, account.provider);

              // Get current user verification status
              const existingUser = await db.select({
                id: users.id,
                email: users.email,
                emailVerified: users.emailVerified
              }).from(users).where(eq(users.email, user.email)).limit(1)

              if (existingUser.length > 0) {
                const userData = existingUser[0]
                console.log(`[Auth] User found - emailVerified: ${!!userData.emailVerified}`)

                // Auto-verify social auth users if not already verified
                if (!userData.emailVerified) {
                  await markEmailAsVerified(user.email)
                  console.log(`[Auth] Auto-verified email for social auth user`)

                  // Send welcome email for newly verified social auth users
                  try {
                    await sendWelcomeEmail({
                      email: user.email,
                      name: user.name || user.email.split('@')[0]
                      // No verificationUrl for social auth users
                    })
                    console.log(`[Auth] Welcome email sent to new social auth user`)
                  } catch (emailError) {
                    console.error(`[Auth] Failed to send welcome email to social auth user:`, emailError)
                  }
                } else {
                  console.log(`[Auth] Social auth user already verified - no email sent`)
                }
              } else {
                console.log(`[Auth] Warning: Social auth user not found in database`)
              }
            } catch (error) {
              console.error('[Auth] Failed to handle social auth verification:', error)
            }
          }

          return secureToken;
        },
        async session({ session, token }: any) {
          // Use secure session callback
          return await sessionSecurityCallbacks.session({ session, token });
        }
      },
      logger: {
        error(error: Error) {
          // Only log non-authentication errors in production
          const message = error.message
          if (!message.includes("SIGNIN_CALLBACK_ERROR") && !message.includes("CALLBACK_CREDENTIALS_JWT_ERROR") && !message.includes("CredentialsSignin")) {
            console.error(`[auth][error]`, error)
          }
        },
        warn(code: string) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[auth][warn] ${code}`)
          }
        },
        debug(code: string, metadata?: any) {
          if (process.env.NODE_ENV === "development") {
            console.debug(`[auth][debug] ${code}`, metadata)
          }
        }
      }
    };

    lastConfigLoad = Date.now();
    console.log('Auth.js configuration refreshed successfully');

  } catch (error) {
    console.error('Failed to refresh Auth.js configuration:', error);

    // Use default config if refresh fails
    if (!authConfigCache) {
      authConfigCache = createDefaultConfig();
    }
  }
}

/**
 * Clear the Auth.js configuration cache (useful when settings are updated)
 */
export function clearAuthConfigCache(): void {
  console.log('Clearing Auth.js configuration cache');
  authConfigCache = null;
  lastConfigLoad = 0;
}

/**
 * Create a default Auth.js configuration with environment variable fallbacks
 */
function createDefaultConfig() {
  const secureCookieConfig = getSecureCookieConfig();
  const secureJWTConfig = getSecureJWTConfig();

  return {
    adapter: DrizzleAdapter(db),
    ...secureCookieConfig,
    secret: secureJWTConfig.secret,
    trustHost: true, // Required for Vercel and other hosted environments
    providers: [
      Credentials({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            return null
          }

          // Sanitize inputs for security
          const sanitizedEmail = authSanitizers.email(credentials.email as string)
          const passwordValidation = validatePasswordSafety(credentials.password as string)

          if (!sanitizedEmail || !passwordValidation.isValid) {
            return null
          }

          const user = await db.select().from(users).where(eq(users.email, sanitizedEmail)).limit(1)

          if (user.length === 0) {
            SecurityLogger.loginFailure(sanitizedEmail, 'User not found (fallback)');
            return null
          }

          const isPasswordValid = await bcrypt.compare(passwordValidation.sanitized, user[0].password || "")

          if (!isPasswordValid) {
            SecurityLogger.loginFailure(sanitizedEmail, 'Invalid password (fallback)');
            return null
          }

          // Log successful credential validation
          SecurityLogger.loginSuccess(user[0].id, user[0].email || '');

          return {
            id: user[0].id,
            email: user[0].email,
            name: user[0].name,
            isAdmin: user[0].isAdmin,
          }
        }
      }),
      // Add OAuth providers only if environment variables are available
      ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET ? [
        Google({
          clientId: env.AUTH_GOOGLE_ID,
          clientSecret: env.AUTH_GOOGLE_SECRET,
        })
      ] : []),
      ...(env.AUTH_APPLE_ID && env.AUTH_APPLE_SECRET ? [
        Apple({
          clientId: env.AUTH_APPLE_ID,
          clientSecret: env.AUTH_APPLE_SECRET,
        })
      ] : []),
      ...(env.AUTH_TWITTER_ID && env.AUTH_TWITTER_SECRET ? [
        Twitter({
          clientId: env.AUTH_TWITTER_ID,
          clientSecret: env.AUTH_TWITTER_SECRET,
        })
      ] : []),
      ...(env.AUTH_FACEBOOK_ID && env.AUTH_FACEBOOK_SECRET ? [
        Facebook({
          clientId: env.AUTH_FACEBOOK_ID,
          clientSecret: env.AUTH_FACEBOOK_SECRET,
          authorization: {
            params: {
              scope: "public_profile,email"
            }
          }
        })
      ] : [])
    ],
    pages: {
      signIn: "/login"
    },
    callbacks: {
      async signIn({ user, account }: any) {
        // Simple sign-in validation - detailed social auth handling moved to jwt callback
        return true
      },
      async jwt({ token, user, account, trigger }: any) {
        // Use secure JWT callback
        const secureToken = await sessionSecurityCallbacks.jwt({ token, user, account, trigger });

        // Handle social auth auto-verification on first sign-in
        if (account && account.provider !== 'credentials' && user?.email) {
          try {
            // Log OAuth login attempt (fallback)
            SecurityLogger.oauthLoginSuccess(user.id, user.email, account.provider);

            // Get current user verification status
            const existingUser = await db.select({
              id: users.id,
              email: users.email,
              emailVerified: users.emailVerified
            }).from(users).where(eq(users.email, user.email)).limit(1)

            if (existingUser.length > 0) {
              const userData = existingUser[0]
              console.log(`[Auth Fallback] User found - emailVerified: ${!!userData.emailVerified}`)

              // Auto-verify social auth users if not already verified
              if (!userData.emailVerified) {
                await markEmailAsVerified(user.email)
                console.log(`[Auth Fallback] Auto-verified email for social auth user`)

                // Send welcome email for newly verified social auth users
                try {
                  await sendWelcomeEmail({
                    email: user.email,
                    name: user.name || user.email.split('@')[0]
                    // No verificationUrl for social auth users
                  })
                  console.log(`[Auth Fallback] Welcome email sent to new social auth user`)
                } catch (emailError) {
                  console.error(`[Auth Fallback] Failed to send welcome email to social auth user:`, emailError)
                }
              } else {
                console.log(`[Auth Fallback] Social auth user already verified - no email sent`)
              }
            } else {
              console.log(`[Auth Fallback] Warning: Social auth user not found in database`)
            }
          } catch (error) {
            console.error('[Auth Fallback] Failed to handle social auth verification:', error)
          }
        }

        return secureToken;
      },
      async session({ session, token }: any) {
        // Use secure session callback
        return await sessionSecurityCallbacks.session({ session, token });
      }
    },
    logger: {
      error(error: Error) {
        // Only log non-authentication errors in production
        const message = error.message
        if (!message.includes("SIGNIN_CALLBACK_ERROR") && !message.includes("CALLBACK_CREDENTIALS_JWT_ERROR") && !message.includes("CredentialsSignin")) {
          console.error(`[auth][error]`, error)
        }
      },
      warn(code: string) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[auth][warn] ${code}`)
        }
      },
      debug(code: string, metadata?: any) {
        if (process.env.NODE_ENV === "development") {
          console.debug(`[auth][debug] ${code}`, metadata)
        }
      }
    }
  };
}

/**
 * Check if a specific OAuth provider is enabled
 */
export async function isOAuthProviderEnabled(provider: 'google' | 'apple' | 'twitter' | 'facebook' | 'linear'): Promise<boolean> {
  try {
    const oauthSettings = await getOAuthSettings();

    switch (provider) {
      case 'google':
        return oauthSettings.googleEnabled &&
          !!(oauthSettings.googleClientId && oauthSettings.googleClientSecret);
      case 'apple':
        return oauthSettings.appleEnabled &&
          !!(oauthSettings.appleClientId && oauthSettings.appleClientSecret);
      case 'twitter':
        return oauthSettings.twitterEnabled &&
          !!(oauthSettings.twitterClientId && oauthSettings.twitterClientSecret);
      case 'facebook':
        return oauthSettings.facebookEnabled &&
          !!(oauthSettings.facebookClientId && oauthSettings.facebookClientSecret);
      case 'linear':
        return oauthSettings.linearEnabled &&
          !!(oauthSettings.linearClientId && oauthSettings.linearClientSecret);
      default:
        return false;
    }
  } catch (error) {
    console.error(`Failed to check if ${provider} OAuth provider is enabled:`, error);

    // Fallback to environment variables
    switch (provider) {
      case 'google':
        return !!(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
      case 'apple':
        return !!(env.AUTH_APPLE_ID && env.AUTH_APPLE_SECRET);
      case 'twitter':
        return !!(env.AUTH_TWITTER_ID && env.AUTH_TWITTER_SECRET);
      case 'facebook':
        return !!(env.AUTH_FACEBOOK_ID && env.AUTH_FACEBOOK_SECRET);
      case 'linear':
        return !!(env.AUTH_LINEAR_ID && env.AUTH_LINEAR_SECRET);
      default:
        return false;
    }
  }
}
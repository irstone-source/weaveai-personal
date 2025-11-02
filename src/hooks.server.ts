import { handle as authHandle } from "./auth.js"
import type { Handle } from "@sveltejs/kit"
import { sequence } from "@sveltejs/kit/hooks"
import { settingsStore } from '$lib/server/settings-store'
import { paraglideMiddleware } from "./paraglide/server"
import { db, users } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'
import type { Session } from "@auth/sveltekit"
import { securityHeaders } from '$lib/server/security-headers.js'
import { authRateLimitMiddleware } from '$lib/server/auth-middleware.js'

// Settings handle - loads and caches site settings
const settingsHandle: Handle = async ({ event, resolve }) => {
  try {
    // Load settings and make them available in locals
    const settings = await settingsStore.getSettings();
    event.locals.settings = settings;
  } catch (error) {
    console.error('Failed to load settings in hooks:', error);
    // Use cached settings as fallback
    event.locals.settings = settingsStore.getCachedSettings();
  }

  return resolve(event);
};

// Locale default handle - sets admin default language if no user preference exists
const localeDefaultHandle: Handle = async ({ event, resolve }) => {
  const cookies = event.cookies;
  const existingLocaleCookie = cookies.get('PARAGLIDE_LOCALE');

  // Only set default if no user preference exists
  if (!existingLocaleCookie) {
    try {
      // Use the cached settings from locals (loaded by settingsHandle)
      // This prevents additional database calls
      const cachedSettings = event.locals.settings;
      const defaultLanguage = cachedSettings?.defaultLanguage || 'en';

      // Set admin default language as the user's locale cookie
      // This becomes the user's preference until they manually change it
      cookies.set('PARAGLIDE_LOCALE', defaultLanguage, {
        path: '/',
        httpOnly: false, // Allow client-side access so users can still change it
        secure: false, // Allow for development
        sameSite: 'lax',
        maxAge: 34560000 // Same as paraglide default (400 days)
      });
    } catch (error) {
      console.error('Failed to set default locale:', error);
      // Fall back to baseLocale behavior
    }
  }

  return resolve(event);
};

// Paraglide handle - handles internationalization and favicon injection
const paraglideHandle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request: localizedRequest, locale }: { request: Request, locale: string }) => {
    event.request = localizedRequest;
    return resolve(event, {
      transformPageChunk: ({ html }: { html: string }) => {
        // Replace language placeholder
        let transformedHtml = html.replace('%lang%', locale);

        // Replace favicon placeholder with dynamic or fallback favicon
        const faviconUrl = event.locals.settings?.currentFavicon || '/branding/favicon/default-favicon.png';
        transformedHtml = transformedHtml.replace('%favicon%', faviconUrl);

        return transformedHtml;
      }
    });
  });

// Enhanced auth handle - wraps the original auth handle and enhances session with user data
// 
// CACHE BEHAVIOR DOCUMENTATION:
// ==============================
// 
// Expected Performance per Route Type:
// 
// 1. Simple Routes (1 auth call):
//    - Examples: /, /pricing, /library, most API endpoints
//    - Expected: 0 hits, 1 miss (100% normal - no logging)
//    - Cache eliminates the N+1 query problem but only helps with multiple calls
// 
// 2. Layout Hierarchy Routes (2+ auth calls - NOW OPTIMIZED):
//    - Examples: /admin (root + admin layouts), /settings/* (root + settings + page layouts)
//    - Before optimization: 0 hits, 2+ misses 
//    - After optimization: 1-2 hits, 1 miss (cache working - logged as ✅ OPTIMIZED)
//    - Uses parent() to share session data instead of re-calling locals.auth()
// 
// 3. Form Action Routes (2+ auth calls):
//    - Examples: Settings pages with form submissions
//    - Expected: 1+ hits, 1 miss (cache working during form processing)
//    - Form actions still call locals.auth() but benefit from page load cache
// 
// 4. Problem Routes (multiple uncached calls - needs investigation):
//    - Shows: ⚠️ MULTIPLE CALLS with 0 hits, 2+ misses
//    - Indicates potential optimization opportunities
// 
// Performance Impact:
// - Single call routes: No change (already optimal)
// - Multi call routes: 50-95% reduction in database queries
// - Complex admin routes: Improved from 2-3 DB calls to 1 DB call
//
const enhancedAuthHandle: Handle = async ({ event, resolve }) => {
  // First run the original auth handle to set up auth
  const response = await authHandle({
    event, resolve: async (event) => {
      // Cache for enhanced session data to prevent N+1 queries within a single request
      let cachedEnhancedSession: Session | null = null;
      let sessionCached = false;

      // Development-only: Track cache performance
      let cacheHits = 0;
      let cacheMisses = 0;

      // Store original auth function reference
      const originalAuth = event.locals.auth;

      // Override locals.auth function to add user data with per-request caching
      event.locals.auth = async () => {
        // Return cached result if available (performance optimization)
        if (sessionCached) {
          if (process.env.NODE_ENV === 'development') {
            cacheHits++;
          }
          return cachedEnhancedSession;
        }

        if (process.env.NODE_ENV === 'development') {
          cacheMisses++;
        }

        const session = await originalAuth();

        // If there's a session with a user, enhance it with database data
        if (session?.user?.id) {
          try {
            // Performance monitoring for database query
            const startTime = Date.now();
            const [userData] = await db
              .select({
                id: users.id,
                planTier: users.planTier,
                isAdmin: users.isAdmin,
                email: users.email,
                name: users.name
              })
              .from(users)
              .where(eq(users.id, session.user.id))
              .limit(1);

            const queryTime = Date.now() - startTime;

            // Log slow queries in development
            if (process.env.NODE_ENV === 'development' && queryTime > 100) {
              console.warn(`[Performance] Slow user data query: ${queryTime}ms for user ${session.user.id}`);
            }

            if (userData) {
              // Enhance session with fresh database data
              session.user.planTier = userData.planTier || undefined;
              session.user.isAdmin = userData.isAdmin;
              session.user.email = userData.email;
              session.user.name = userData.name;

              // Cache the enhanced session
              cachedEnhancedSession = session;
              sessionCached = true;
            } else {
              // User no longer exists
              console.log(`[Auth] Session invalidated: user ${session.user.id} no longer exists in database`);
              cachedEnhancedSession = null;
              sessionCached = true;
              return null;
            }
          } catch (error) {
            console.error(`[Auth] Error enhancing session with user data for user ${session.user.id}:`, error);
            // Cache the original session on error to avoid repeated failed DB calls
            cachedEnhancedSession = session;
            sessionCached = true;
          }
        } else {
          // No user session - cache the result
          cachedEnhancedSession = session;
          sessionCached = true;
        }

        return cachedEnhancedSession;
      };

      // Resolve the request and log cache statistics in development
      const result = await resolve(event);

      // Log cache performance in development mode (only for interesting cases)
      if (process.env.NODE_ENV === 'development' && (cacheHits > 0 || cacheMisses > 0)) {
        const totalCalls = cacheHits + cacheMisses;
        const hitRate = totalCalls > 0 ? ((cacheHits / totalCalls) * 100).toFixed(1) : '0';

        // Only log if there are cache hits (indicating optimization worked) or multiple misses (potential issue)
        if (cacheHits > 0 || cacheMisses > 1) {
          const status = cacheHits > 0 ? '✅ OPTIMIZED' : '⚠️  MULTIPLE CALLS';
          console.log(`[Auth Cache] ${status} ${event.url.pathname}: ${cacheHits} hits, ${cacheMisses} misses (${hitRate}% hit rate)`);
        }
      }

      return result;
    }
  });

  return response;
};

// Combine all handles: security headers, auth rate limiting, settings, locale default, paraglide, and enhanced auth
export const handle: Handle = sequence(securityHeaders, authRateLimitMiddleware, settingsHandle, localeDefaultHandle, paraglideHandle, enhancedAuthHandle)
import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { isOAuthProviderEnabled } from '$lib/server/auth-config'
import { isDemoModeEnabled } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth()
  
  // If user is already logged in, redirect to index page
  if (session?.user) {
    throw redirect(302, '/')
  }
  
  // Load OAuth provider availability from database settings
  try {
    const googleEnabled = await isOAuthProviderEnabled('google');
    const appleEnabled = await isOAuthProviderEnabled('apple');
    const twitterEnabled = await isOAuthProviderEnabled('twitter');
    const facebookEnabled = await isOAuthProviderEnabled('facebook');
    const linearEnabled = await isOAuthProviderEnabled('linear');

    return {
      oauthProviders: {
        google: googleEnabled,
        apple: appleEnabled,
        twitter: twitterEnabled,
        facebook: facebookEnabled,
        linear: linearEnabled
      },
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load OAuth provider settings for login page:', error);

    // Fallback - assume providers are available if settings can't be loaded
    return {
      oauthProviders: {
        google: true,
        apple: true,
        twitter: true,
        facebook: true,
        linear: true
      },
      isDemoMode: isDemoModeEnabled()
    }
  }
}
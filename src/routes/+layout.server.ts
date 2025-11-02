import type { LayoutServerLoad } from './$types'
import { isDemoModeEnabled } from '$lib/constants/demo-mode.js'

export const load: LayoutServerLoad = async ({ locals }) => {
  const session = await locals.auth()
  
  // Get admin default settings from cached settings (loaded by settingsHandle in hooks)
  // This eliminates the database call on every page load
  const cachedSettings = locals.settings;
  const adminDefaults = {
    theme: cachedSettings?.defaultTheme || 'dark',
    language: cachedSettings?.defaultLanguage || 'en'
  };
  
  return {
    session,
    // Pass settings from locals to all pages
    settings: locals.settings,
    adminDefaults,
    isDemoMode: isDemoModeEnabled()
  }
}
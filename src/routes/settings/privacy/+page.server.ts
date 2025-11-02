import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { db, users } from '$lib/server/db'
import { eq } from 'drizzle-orm'

export const load: PageServerLoad = async ({ parent }) => {
  // Get user data from parent settings layout (already includes marketingConsent field)
  const { user } = await parent();
  
  if (!user) {
    return {
      user: null
    }
  }
  
  return {
    user: {
      id: user.id,
      marketingConsent: (user as any).marketingConsent ?? false // Default to false for privacy compliance
    }
  }
}

export const actions: Actions = {
  updatePrivacySettings: async ({ request, locals }) => {
    const session = await locals.auth()
    
    if (!session?.user?.id) {
      return fail(401, {
        error: 'You must be logged in to update privacy settings'
      })
    }
    
    const data = await request.formData()
    const marketingConsentValue = data.get('marketingConsent')
    
    // Validate the checkbox input - should be either 'on' or null/undefined
    const marketingConsent = marketingConsentValue === 'on'
    
    // Additional validation to ensure we have a valid boolean
    if (marketingConsentValue !== null && marketingConsentValue !== 'on') {
      return fail(400, {
        error: 'Invalid marketing consent value',
        marketingConsent: false
      })
    }
    
    try {
      // Update the user's marketing consent preference
      await db
        .update(users)
        .set({
          marketingConsent
        })
        .where(eq(users.id, session.user.id))
      
      return {
        success: true,
        message: `Marketing consent ${marketingConsent ? 'enabled' : 'disabled'} successfully`,
        marketingConsent
      }
    } catch (error) {
      console.error('Error updating privacy settings:', error)
      return fail(500, {
        error: 'Failed to update privacy settings. Please try again.',
        marketingConsent
      })
    }
  }
}
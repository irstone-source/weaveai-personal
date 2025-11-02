import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { db, users } from '$lib/server/db'
import { eq } from 'drizzle-orm'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async ({ parent }) => {
  // Get user data from parent settings layout (already fetched from database with all needed fields)
  const { user } = await parent();

  return {
    user,
    isDemoMode: isDemoModeEnabled()
  }
}

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    // Check demo mode - block modifications
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const session = await locals.auth()

    if (!session?.user?.id) {
      return fail(401, {
        error: 'You must be logged in to update your profile'
      })
    }
    
    const data = await request.formData()
    const name = data.get('name')?.toString()
    const email = data.get('email')?.toString()
    
    // Validation
    if (!name || name.trim().length === 0) {
      return fail(400, {
        error: 'Name is required',
        name,
        email
      })
    }
    
    if (!email || email.trim().length === 0) {
      return fail(400, {
        error: 'Email is required',
        name,
        email
      })
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return fail(400, {
        error: 'Please enter a valid email address',
        name,
        email
      })
    }
    
    try {
      // Check if email is already taken by another user
      if (email !== session.user.email) {
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
        
        if (existingUser.length > 0 && existingUser[0].id !== session.user.id) {
          return fail(400, {
            error: 'This email address is already in use',
            name,
            email
          })
        }
      }
      
      // Update the user profile
      await db
        .update(users)
        .set({
          name: name.trim(),
          email: email.trim()
        })
        .where(eq(users.id, session.user.id))
      
      return {
        success: true,
        message: 'Profile updated successfully'
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      return fail(500, {
        error: 'Failed to update profile. Please try again.',
        name,
        email
      })
    }
  }
}
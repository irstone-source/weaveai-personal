import type { LayoutServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'
import { db, users, accounts } from '$lib/server/db'
import { eq } from 'drizzle-orm'

export const load: LayoutServerLoad = async ({ locals, parent }) => {
  // Get session from parent layout to avoid duplicate auth call
  const { session } = await parent();
  
  if (!session?.user?.id) {
    throw redirect(302, '/login?callbackUrl=/settings')
  }
  
  // Fetch fresh user data from database to ensure consistency across settings pages
  try {
    const dbUser = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        isAdmin: users.isAdmin,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        marketingConsent: users.marketingConsent
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
    
    if (dbUser.length === 0) {
      throw redirect(302, '/login?callbackUrl=/settings')
    }

    // Get auth providers for this user
    const authProviders = await db
      .select({
        provider: accounts.provider,
        type: accounts.type
      })
      .from(accounts)
      .where(eq(accounts.userId, session.user.id))
    
    return {
      session,
      user: dbUser[0],
      authProviders: authProviders.map(account => ({
        provider: account.provider,
        type: account.type
      }))
    }
  } catch (error) {
    console.error('Error loading user data for settings:', error)
    // Fallback to session data if database query fails
    return {
      session,
      user: session.user,
      authProviders: []
    }
  }
}
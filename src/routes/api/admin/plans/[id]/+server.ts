import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db, pricingPlans, users } from '$lib/server/db'
import { eq } from 'drizzle-orm'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  try {
    // Check if user is authenticated and is admin
    const session = await locals.getSession();
    if (!session?.user?.id) {
      throw error(401, 'Unauthorized');
    }

    // Check if user is admin
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id));

    if (!user?.isAdmin) {
      throw error(403, 'Forbidden - Admin access required');
    }

    // Check demo mode - block modifications
    if (isDemoModeEnabled()) {
      return json({
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED,
        type: 'demo_mode_restriction'
      }, { status: 403 });
    }

    const planId = params.id

    if (!planId) {
      throw error(400, 'Plan ID is required')
    }

    const { isActive } = await request.json()
    
    if (typeof isActive !== 'boolean') {
      throw error(400, 'isActive must be a boolean')
    }

    // Update the plan status
    const result = await db
      .update(pricingPlans)
      .set({ 
        isActive,
        updatedAt: new Date()
      })
      .where(eq(pricingPlans.id, planId))
      .returning()

    if (result.length === 0) {
      throw error(404, 'Plan not found')
    }

    return json({ 
      success: true, 
      plan: result[0] 
    })
  } catch (err) {
    console.error('Error updating plan status:', err)
    
    if (err instanceof Response) {
      throw err
    }
    
    throw error(500, 'Failed to update plan status')
  }
}
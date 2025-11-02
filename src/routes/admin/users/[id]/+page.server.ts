import type { PageServerLoad, Actions } from './$types'
import { db, users, paymentHistory, subscriptions, usageTracking, pricingPlans } from '$lib/server/db'
import { eq, desc, and } from 'drizzle-orm'
import { error, fail } from '@sveltejs/kit'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async ({ params, locals }) => {
  const userId = params.id

  // Additional admin check (layout already verifies, but double-check for security)
  const session = await locals.auth()
  if (!session?.user?.isAdmin) {
    throw error(403, 'Forbidden: Admin access required')
  }

  // Fetch user information
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user.length) {
    throw error(404, 'User not found')
  }

  // Fetch user's payment history
  const userPayments = await db
    .select({
      id: paymentHistory.id,
      amount: paymentHistory.amount,
      currency: paymentHistory.currency,
      status: paymentHistory.status,
      description: paymentHistory.description,
      paymentMethodType: paymentHistory.paymentMethodType,
      last4: paymentHistory.last4,
      brand: paymentHistory.brand,
      paidAt: paymentHistory.paidAt,
      createdAt: paymentHistory.createdAt
    })
    .from(paymentHistory)
    .where(eq(paymentHistory.userId, userId))
    .orderBy(desc(paymentHistory.createdAt))

  // Fetch user's subscriptions
  const userSubscriptions = await db
    .select({
      id: subscriptions.id,
      planTier: subscriptions.planTier,
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      createdAt: subscriptions.createdAt,
      updatedAt: subscriptions.updatedAt
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))

  // Get current month and year for usage tracking
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // JavaScript months are 0-indexed
  const currentYear = now.getFullYear()

  // Fetch user's current month usage
  const userUsage = await db
    .select({
      textGenerationCount: usageTracking.textGenerationCount,
      imageGenerationCount: usageTracking.imageGenerationCount,
      videoGenerationCount: usageTracking.videoGenerationCount,
      lastResetAt: usageTracking.lastResetAt
    })
    .from(usageTracking)
    .where(
      and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.month, currentMonth),
        eq(usageTracking.year, currentYear)
      )
    )
    .limit(1)

  // Fetch plan limits based on user's plan tier (including free plans)
  let planLimits = null
  if (user[0].planTier) {
    const planData = await db
      .select({
        name: pricingPlans.name,
        tier: pricingPlans.tier,
        textGenerationLimit: pricingPlans.textGenerationLimit,
        imageGenerationLimit: pricingPlans.imageGenerationLimit,
        videoGenerationLimit: pricingPlans.videoGenerationLimit
      })
      .from(pricingPlans)
      .where(
        and(
          eq(pricingPlans.tier, user[0].planTier),
          eq(pricingPlans.isActive, true)
        )
      )
      .limit(1)

    planLimits = planData[0] || null
  }

  // Calculate usage data with defaults
  const currentUsage = userUsage[0] || {
    textGenerationCount: 0,
    imageGenerationCount: 0,
    videoGenerationCount: 0,
    lastResetAt: null
  }

  return {
    user: user[0],
    payments: userPayments,
    subscriptions: userSubscriptions,
    usage: currentUsage,
    planLimits,
    currentMonth,
    currentYear,
    currentAdminId: session.user.id,
    isDemoMode: isDemoModeEnabled()
  }
}

export const actions: Actions = {
  updateUser: async ({ request, params, locals }) => {
    // Verify admin access
    const session = await locals.auth()
    if (!session?.user?.isAdmin) {
      return fail(403, { error: 'Forbidden: Admin access required' })
    }

    // Check demo mode - block modifications
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const userId = params.id
    const formData = await request.formData()
    const name = formData.get('name')?.toString()?.trim()
    const email = formData.get('email')?.toString()?.trim()

    // Validation
    if (!name || name.length < 1) {
      return fail(400, { error: 'Name is required and cannot be empty' })
    }

    if (!email || email.length < 1) {
      return fail(400, { error: 'Email is required and cannot be empty' })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return fail(400, { error: 'Please enter a valid email address' })
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!existingUser.length) {
      return fail(404, { error: 'User not found' })
    }

    // Check if email is already taken by another user
    const emailExists = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (emailExists.length && emailExists[0].id !== userId) {
      return fail(400, { error: 'Email address is already in use by another user' })
    }

    try {
      // Update user
      await db
        .update(users)
        .set({
          name,
          email,
          // Note: updatedAt would be here if it exists in schema
        })
        .where(eq(users.id, userId))

      return { success: true, message: 'User updated successfully' }
    } catch (err) {
      console.error('Error updating user:', err)
      return fail(500, { error: 'Failed to update user. Please try again.' })
    }
  },

  updateUserRole: async ({ request, params, locals }) => {
    // Verify admin access
    const session = await locals.auth()
    if (!session?.user?.isAdmin) {
      return fail(403, { error: 'Forbidden: Admin access required' })
    }

    // Check demo mode - block modifications
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const userId = params.id
    const currentAdminId = session.user.id
    const formData = await request.formData()
    const isAdminValue = formData.get('isAdmin')

    // Convert to boolean
    const isAdmin = isAdminValue === 'true'

    // Prevent admin from removing their own admin privileges
    if (userId === currentAdminId && !isAdmin) {
      return fail(400, { error: 'You cannot remove your own admin privileges' })
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!existingUser.length) {
      return fail(404, { error: 'User not found' })
    }

    try {
      // Update user role
      await db
        .update(users)
        .set({
          isAdmin
        })
        .where(eq(users.id, userId))

      const roleText = isAdmin ? 'Admin' : 'User'
      return { success: true, message: `User role updated to ${roleText} successfully.` }
    } catch (err) {
      console.error('Error updating user role:', err)
      return fail(500, { error: 'Failed to update user role. Please try again.' })
    }
  }
}
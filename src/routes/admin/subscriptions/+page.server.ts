import type { PageServerLoad } from './$types'
import { db, subscriptions, users } from '$lib/server/db'
import { count, desc, eq } from 'drizzle-orm'

const SUBSCRIPTIONS_PER_PAGE = 15

export const load: PageServerLoad = async ({ url }) => {
  // Get page number from URL params, default to 1
  const page = parseInt(url.searchParams.get('page') || '1')
  const offset = (page - 1) * SUBSCRIPTIONS_PER_PAGE

  // Get total count of subscriptions
  const totalSubscriptionsResult = await db
    .select({ count: count() })
    .from(subscriptions)
  
  const totalSubscriptions = totalSubscriptionsResult[0].count

  // Fetch paginated subscriptions with user information
  const paginatedSubscriptions = await db
    .select({
      id: subscriptions.id,
      planTier: subscriptions.planTier,
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      createdAt: subscriptions.createdAt,
      userId: users.id,
      userEmail: users.email,
      userName: users.name
    })
    .from(subscriptions)
    .leftJoin(users, eq(subscriptions.userId, users.id))
    .orderBy(desc(subscriptions.createdAt)) // Most recent first
    .limit(SUBSCRIPTIONS_PER_PAGE)
    .offset(offset)
    
  return {
    subscriptions: paginatedSubscriptions,
    totalSubscriptions,
    currentPage: page,
    subscriptionsPerPage: SUBSCRIPTIONS_PER_PAGE,
    totalPages: Math.ceil(totalSubscriptions / SUBSCRIPTIONS_PER_PAGE)
  }
}
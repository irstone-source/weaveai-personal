import type { PageServerLoad } from './$types'
import { db, users, subscriptions } from '$lib/server/db'
import { count, desc, ilike, or, eq, and } from 'drizzle-orm'

const USERS_PER_PAGE = 15
const MAX_SEARCH_QUERY_LENGTH = 100

export const load: PageServerLoad = async ({ url }) => {
  // Get page number and search query from URL params
  const page = parseInt(url.searchParams.get('page') || '1')
  const rawSearchQuery = url.searchParams.get('search')?.trim() || ''
  
  // Validate search query length on server side
  const searchQuery = rawSearchQuery.length <= MAX_SEARCH_QUERY_LENGTH ? rawSearchQuery : ''
  
  const offset = (page - 1) * USERS_PER_PAGE

  // Build search conditions
  const searchConditions = searchQuery ? or(
    ilike(users.email, `%${searchQuery}%`), // Case-insensitive partial email match
    ilike(users.id, searchQuery) // Exact ID match (case-insensitive)
  ) : undefined

  // Get total count of users (with search filter if applicable)
  const totalUsersQuery = db
    .select({ count: count() })
    .from(users)
  
  if (searchConditions) {
    totalUsersQuery.where(searchConditions)
  }
  
  const totalUsersResult = await totalUsersQuery
  const totalUsers = totalUsersResult[0].count

  // Fetch paginated users with current subscription information
  const usersQuery = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      subscriptionStatus: users.subscriptionStatus,
      planTier: users.planTier,
      currentSubscriptionPlanTier: subscriptions.planTier, // Get current plan from active subscription
      currentSubscriptionStatus: subscriptions.status, // Get current subscription status
      isAdmin: users.isAdmin,
      createdAt: users.createdAt
    })
    .from(users)
    .leftJoin(subscriptions, and(
      eq(subscriptions.userId, users.id),
      or(
        eq(subscriptions.status, 'active'),
        eq(subscriptions.status, 'trialing'),
        eq(subscriptions.status, 'past_due')
      )
    ))
    .orderBy(desc(users.createdAt)) // Sort by creation date (newest first)
    .limit(USERS_PER_PAGE)
    .offset(offset)

  if (searchConditions) {
    usersQuery.where(searchConditions)
  }

  const paginatedUsers = await usersQuery
    
  return {
    users: paginatedUsers,
    totalUsers,
    currentPage: page,
    usersPerPage: USERS_PER_PAGE,
    totalPages: Math.ceil(totalUsers / USERS_PER_PAGE),
    searchQuery // Return search query to frontend
  }
}
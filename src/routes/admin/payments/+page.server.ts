import type { PageServerLoad } from './$types'
import { db, paymentHistory, users } from '$lib/server/db'
import { count, desc, eq } from 'drizzle-orm'

const PAYMENTS_PER_PAGE = 15

export const load: PageServerLoad = async ({ url }) => {
  // Get page number from URL params, default to 1
  const page = parseInt(url.searchParams.get('page') || '1')
  const offset = (page - 1) * PAYMENTS_PER_PAGE

  // Get total count of payments
  const totalPaymentsResult = await db
    .select({ count: count() })
    .from(paymentHistory)
  
  const totalPayments = totalPaymentsResult[0].count

  // Fetch paginated payments with user information
  const paginatedPayments = await db
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
      createdAt: paymentHistory.createdAt,
      userId: users.id,
      userEmail: users.email,
      userName: users.name
    })
    .from(paymentHistory)
    .leftJoin(users, eq(paymentHistory.userId, users.id))
    .orderBy(desc(paymentHistory.createdAt)) // Most recent first
    .limit(PAYMENTS_PER_PAGE)
    .offset(offset)
    
  return {
    payments: paginatedPayments,
    totalPayments,
    currentPage: page,
    paymentsPerPage: PAYMENTS_PER_PAGE,
    totalPages: Math.ceil(totalPayments / PAYMENTS_PER_PAGE)
  }
}
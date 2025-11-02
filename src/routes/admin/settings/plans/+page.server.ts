import type { PageServerLoad } from './$types'
import { db, pricingPlans } from '$lib/server/db'
import { count } from 'drizzle-orm'
import { isDemoModeEnabled } from '$lib/constants/demo-mode.js'

const PLANS_PER_PAGE = 15

export const load: PageServerLoad = async ({ url }) => {
  // Get page number from URL params, default to 1
  const page = parseInt(url.searchParams.get('page') || '1')
  const offset = (page - 1) * PLANS_PER_PAGE

  // Get total count of plans
  const totalPlansResult = await db
    .select({ count: count() })
    .from(pricingPlans)
  
  const totalPlans = totalPlansResult[0].count

  // Fetch paginated plans
  const paginatedPlans = await db
    .select({
      id: pricingPlans.id,
      name: pricingPlans.name,
      tier: pricingPlans.tier,
      priceAmount: pricingPlans.priceAmount,
      currency: pricingPlans.currency,
      billingInterval: pricingPlans.billingInterval,
      textGenerationLimit: pricingPlans.textGenerationLimit,
      imageGenerationLimit: pricingPlans.imageGenerationLimit,
      videoGenerationLimit: pricingPlans.videoGenerationLimit,
      features: pricingPlans.features,
      isActive: pricingPlans.isActive,
      createdAt: pricingPlans.createdAt,
      updatedAt: pricingPlans.updatedAt
    })
    .from(pricingPlans)
    .orderBy(pricingPlans.tier, pricingPlans.name) // Sort by tier first, then name
    .limit(PLANS_PER_PAGE)
    .offset(offset)
    
  return {
    plans: paginatedPlans,
    totalPlans,
    currentPage: page,
    plansPerPage: PLANS_PER_PAGE,
    totalPages: Math.ceil(totalPlans / PLANS_PER_PAGE),
    isDemoMode: isDemoModeEnabled()
  }
}
import type { Actions, PageServerLoad } from './$types'
import { db, pricingPlans } from '$lib/server/db'
import { fail, redirect } from '@sveltejs/kit'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  return {
    isDemoMode: isDemoModeEnabled()
  }
}

export const actions: Actions = {
  create: async ({ request }) => {
    // Check demo mode - block modifications
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const data = await request.formData()
    
    const name = data.get('name')?.toString()
    const tier = data.get('tier')?.toString()
    const stripePriceId = data.get('stripePriceId')?.toString()
    const priceAmount = data.get('priceAmount')?.toString()
    const currency = data.get('currency')?.toString() || 'usd'
    const billingInterval = data.get('billingInterval')?.toString()
    const textGenerationLimit = data.get('textGenerationLimit')?.toString()
    const imageGenerationLimit = data.get('imageGenerationLimit')?.toString()
    const videoGenerationLimit = data.get('videoGenerationLimit')?.toString()
    const features = data.get('features')?.toString()

    // Validation
    if (!name || !tier || !stripePriceId || !priceAmount || !billingInterval) {
      return fail(400, {
        error: 'Required fields are missing',
        name,
        tier,
        stripePriceId,
        priceAmount,
        currency,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        features
      })
    }

    if (!['free', 'starter', 'pro', 'advanced'].includes(tier)) {
      return fail(400, {
        error: 'Invalid tier selected',
        name,
        tier,
        stripePriceId,
        priceAmount,
        currency,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        features
      })
    }

    if (!['month', 'year'].includes(billingInterval)) {
      return fail(400, {
        error: 'Invalid billing interval selected',
        name,
        tier,
        stripePriceId,
        priceAmount,
        currency,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        features
      })
    }

    const priceAmountNum = parseInt(priceAmount)
    if (isNaN(priceAmountNum) || priceAmountNum < 0) {
      return fail(400, {
        error: 'Price amount must be a valid positive number',
        name,
        tier,
        stripePriceId,
        priceAmount,
        currency,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        features
      })
    }

    try {
      // Parse limits (null for unlimited)
      const textLimit = !textGenerationLimit || textGenerationLimit === '' ? null : parseInt(textGenerationLimit)
      const imageLimit = !imageGenerationLimit || imageGenerationLimit === '' ? null : parseInt(imageGenerationLimit)
      const videoLimit = !videoGenerationLimit || videoGenerationLimit === '' ? null : parseInt(videoGenerationLimit)

      // Parse features array
      let featuresArray: string[] = []
      if (features) {
        try {
          featuresArray = features.split('\n').map(f => f.trim()).filter(f => f.length > 0)
        } catch (error) {
          featuresArray = []
        }
      }

      // Create the plan
      await db.insert(pricingPlans).values({
        name,
        tier: tier as 'free' | 'starter' | 'pro' | 'advanced',
        stripePriceId,
        priceAmount: priceAmountNum,
        currency,
        billingInterval: billingInterval as 'month' | 'year',
        textGenerationLimit: textLimit && !isNaN(textLimit) ? textLimit : null,
        imageGenerationLimit: imageLimit && !isNaN(imageLimit) ? imageLimit : null,
        videoGenerationLimit: videoLimit && !isNaN(videoLimit) ? videoLimit : null,
        features: featuresArray,
        isActive: true
      })

      throw redirect(303, '/admin/settings/plans')
    } catch (error) {
      // Check if this is a redirect response (SvelteKit redirects are Response objects)
      if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && error.status === 303)) {
        throw error
      }
      
      console.error('Error creating plan:', error)
      return fail(500, {
        error: 'Failed to create plan',
        name,
        tier,
        stripePriceId,
        priceAmount,
        currency,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        features
      })
    }
  }
}
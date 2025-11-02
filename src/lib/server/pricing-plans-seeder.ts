import { db } from './db/index.js';
import { pricingPlans } from './db/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * Pricing Plans Seeder
 * 
 * This seeder creates initial pricing plans with placeholder Stripe price IDs.
 * Real Stripe price IDs should be configured through the Admin Dashboard at /admin/settings/plans
 * 
 * The system is fully database-driven - all pricing information is read from the database,
 * not from environment variables.
 */

export interface PricingPlanSeed {
	name: string;
	tier: 'free' | 'starter' | 'pro' | 'advanced';
	stripePriceId: string;
	priceAmount: number; // in cents
	currency: string;
	billingInterval: 'month' | 'year';
	textGenerationLimit: number | null;
	imageGenerationLimit: number | null;
	videoGenerationLimit: number | null;
	features: string[];
	isActive: boolean;
}

const pricingPlansData: PricingPlanSeed[] = [
	// Free Plan
	{
		name: 'Free Plan',
		tier: 'free',
		stripePriceId: 'free', // Special non-Stripe price ID for free plan
		priceAmount: 0, // $0.00
		currency: 'usd',
		billingInterval: 'month',
		textGenerationLimit: 10, // 10 text generations per month
		imageGenerationLimit: 5, // 5 images per month
		videoGenerationLimit: 0, // No video generation
		features: [
			'10 text generations per month',
			'5 image generations per month',
			'Access to basic AI models',
			'Limited rate limits',
			'Community support',
			'Basic chat history'
		],
		isActive: true,
	},
	// Monthly Plans
	{
		name: 'Starter',
		tier: 'starter',
		stripePriceId: 'price_starter_monthly',
		priceAmount: 1500, // $15.00
		currency: 'usd',
		billingInterval: 'month',
		textGenerationLimit: 1000, // 1000 text generations per month
		imageGenerationLimit: 50, // 50 images per month
		videoGenerationLimit: 0, // No video generation
		features: [
			'All 32+ text generation models',
			'50 image generations per month',
			'Limited to DALL-E 3 and Stable Diffusion models',
			'Basic rate limits',
			'Email support',
			'Chat history storage'
		],
		isActive: true,
	},
	{
		name: 'Pro',
		tier: 'pro',
		stripePriceId: 'price_pro_monthly',
		priceAmount: 4900, // $49.00
		currency: 'usd',
		billingInterval: 'month',
		textGenerationLimit: 5000, // 5000 text generations per month
		imageGenerationLimit: 500, // 500 images per month
		videoGenerationLimit: 5, // 5 videos per month
		features: [
			'All 32+ text generation models',
			'500 image generations per month',
			'Access to all 25+ image generation models',
			'5 video generations per month',
			'Access to all 8+ video generation models',
			'Higher rate limits',
			'Priority processing',
			'Advanced chat features',
			'Priority email support'
		],
		isActive: true,
	},
	{
		name: 'Advanced',
		tier: 'advanced',
		stripePriceId: 'price_advanced_monthly',
		priceAmount: 14900, // $149.00
		currency: 'usd',
		billingInterval: 'month',
		textGenerationLimit: null, // Unlimited
		imageGenerationLimit: null, // Unlimited
		videoGenerationLimit: 50, // 50 videos per month
		features: [
			'Unlimited text generations',
			'Unlimited image generations',
			'50 video generations per month',
			'Access to all 65+ AI models',
			'Highest rate limits',
			'Priority processing',
			'Advanced analytics',
			'API access (coming soon)',
			'Dedicated support',
			'Custom integrations',
			'Team collaboration features'
		],
		isActive: true,
	},
	// Yearly Plans (16% discount - equivalent to 10 months for 12)
	{
		name: 'Starter',
		tier: 'starter',
		stripePriceId: 'price_starter_yearly',
		priceAmount: 12600, // $126.00 yearly (normally $180, save $54)
		currency: 'usd',
		billingInterval: 'year',
		textGenerationLimit: 1000, // 1000 text generations per month
		imageGenerationLimit: 50, // 50 images per month
		videoGenerationLimit: 0, // No video generation
		features: [
			'All 32+ text generation models',
			'50 image generations per month',
			'Limited to DALL-E 3 and Stable Diffusion models',
			'Basic rate limits',
			'Email support',
			'Chat history storage'
		],
		isActive: true,
	},
	{
		name: 'Pro',
		tier: 'pro',
		stripePriceId: 'price_pro_yearly',
		priceAmount: 41160, // $411.60 yearly (normally $588, save $176.40)
		currency: 'usd',
		billingInterval: 'year',
		textGenerationLimit: 5000, // 5000 text generations per month
		imageGenerationLimit: 500, // 500 images per month
		videoGenerationLimit: 5, // 5 videos per month
		features: [
			'All 32+ text generation models',
			'500 image generations per month',
			'Access to all 25+ image generation models',
			'5 video generations per month',
			'Access to all 8+ video generation models',
			'Higher rate limits',
			'Priority processing',
			'Advanced chat features',
			'Priority email support'
		],
		isActive: true,
	},
	{
		name: 'Advanced',
		tier: 'advanced',
		stripePriceId: 'price_advanced_yearly',
		priceAmount: 125160, // $1,251.60 yearly (normally $1,788, save $536.40)
		currency: 'usd',
		billingInterval: 'year',
		textGenerationLimit: null, // Unlimited
		imageGenerationLimit: null, // Unlimited
		videoGenerationLimit: 50, // 50 videos per month
		features: [
			'Unlimited text generations',
			'Unlimited image generations',
			'50 video generations per month',
			'Access to all 65+ AI models',
			'Highest rate limits',
			'Priority processing',
			'Advanced analytics',
			'API access (coming soon)',
			'Dedicated support',
			'Custom integrations',
			'Team collaboration features'
		],
		isActive: true,
	},
];

export async function seedPricingPlans(): Promise<void> {
	console.log('Seeding pricing plans...');

	try {
		for (const planData of pricingPlansData) {
			// Check if plan already exists
			const existingPlan = await db
				.select()
				.from(pricingPlans)
				.where(eq(pricingPlans.stripePriceId, planData.stripePriceId))
				.limit(1);

			if (existingPlan.length > 0) {
				console.log(`Plan ${planData.name} already exists, updating...`);
				
				// Update existing plan
				await db
					.update(pricingPlans)
					.set({
						name: planData.name,
						tier: planData.tier,
						priceAmount: planData.priceAmount,
						currency: planData.currency,
						billingInterval: planData.billingInterval,
						textGenerationLimit: planData.textGenerationLimit,
						imageGenerationLimit: planData.imageGenerationLimit,
						videoGenerationLimit: planData.videoGenerationLimit,
						features: planData.features,
						isActive: planData.isActive,
						updatedAt: new Date(),
					})
					.where(eq(pricingPlans.stripePriceId, planData.stripePriceId));
			} else {
				console.log(`Creating new plan: ${planData.name}`);
				
				// Insert new plan
				await db.insert(pricingPlans).values(planData);
			}
		}

		console.log('Pricing plans seeded successfully!');
	} catch (error) {
		console.error('Error seeding pricing plans:', error);
		throw error;
	}
}

export async function getPricingPlans(billingInterval?: 'month' | 'year') {
	const conditions = [eq(pricingPlans.isActive, true)];
	
	if (billingInterval) {
		conditions.push(eq(pricingPlans.billingInterval, billingInterval));
	}
	
	return await db
		.select()
		.from(pricingPlans)
		.where(conditions.length === 1 ? conditions[0] : and(...conditions))
		.orderBy(pricingPlans.priceAmount);
}

// Helper function to get a specific plan by tier
export async function getPricingPlanByTier(tier: 'free' | 'starter' | 'pro' | 'advanced') {
	const [plan] = await db
		.select()
		.from(pricingPlans)
		.where(eq(pricingPlans.tier, tier))
		.limit(1);
		
	return plan || null;
}

// Helper function to validate if a price ID exists in our pricing plans
export async function isValidPriceId(priceId: string): Promise<boolean> {
	try {
		const [plan] = await db
			.select({ id: pricingPlans.id })
			.from(pricingPlans)
			.where(and(
				eq(pricingPlans.stripePriceId, priceId),
				eq(pricingPlans.isActive, true)
			))
			.limit(1);
		
		return !!plan;
	} catch (error) {
		console.error('Error validating price ID:', error);
		return false;
	}
}
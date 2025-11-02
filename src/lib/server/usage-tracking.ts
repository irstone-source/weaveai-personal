import { db } from './db/index.js';
import { usageTracking, users, subscriptions, pricingPlans, chats } from './db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { StripeService } from './stripe.js';
import { getModelProvider } from '../ai/index.js';

export class UsageLimitError extends Error {
	constructor(message: string, public remainingQuota: number = 0) {
		super(message);
		this.name = 'UsageLimitError';
	}
}

export interface UsageLimits {
	textGenerationLimit: number | null; // null = unlimited
	imageGenerationLimit: number | null;
	videoGenerationLimit: number | null;
}

export interface CurrentUsage {
	textGenerationCount: number;
	imageGenerationCount: number;
	videoGenerationCount: number;
	month: number;
	year: number;
}

export interface ModelUsageStatistic {
	model: string;
	provider: string;
	count: number;
	percentage: number;
}

export class UsageTrackingService {
	/**
	 * Get tier-based limits for a user based on their subscription
	 */
	static async getUserLimits(userId: string, planTier?: string): Promise<UsageLimits> {
		try {
			// If plan tier is provided, use it; otherwise query from database
			let userPlanTier = planTier;

			if (!userPlanTier) {
				const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
				userPlanTier = user?.planTier ?? 'free';
			}

			if (userPlanTier === 'free') {
				// Free tier limits - fetch from database
				const [freePlan] = await db
					.select()
					.from(pricingPlans)
					.where(eq(pricingPlans.tier, 'free'))
					.limit(1);
				
				if (freePlan) {
					return {
						textGenerationLimit: freePlan.textGenerationLimit,
						imageGenerationLimit: freePlan.imageGenerationLimit,
						videoGenerationLimit: freePlan.videoGenerationLimit
					};
				}
				
				// Fallback to unlimited if free plan not found in database
				return {
					textGenerationLimit: null,
					imageGenerationLimit: null,
					videoGenerationLimit: null
				};
			}

			// Get user's active subscription for paid plans
			const subscriptionData = await StripeService.getActiveSubscription(userId);
			
			if (!subscriptionData?.plan) {
				// Default to free tier limits if no subscription found
				const [freePlan] = await db
					.select()
					.from(pricingPlans)
					.where(eq(pricingPlans.tier, 'free'))
					.limit(1);
				
				if (freePlan) {
					return {
						textGenerationLimit: freePlan.textGenerationLimit,
						imageGenerationLimit: freePlan.imageGenerationLimit,
						videoGenerationLimit: freePlan.videoGenerationLimit
					};
				}
				
				// Fallback to unlimited if free plan not found
				return {
					textGenerationLimit: null,
					imageGenerationLimit: null,
					videoGenerationLimit: null
				};
			}

			// Return plan-specific limits for paid plans
			return {
				textGenerationLimit: subscriptionData.plan.textGenerationLimit,
				imageGenerationLimit: subscriptionData.plan.imageGenerationLimit,
				videoGenerationLimit: subscriptionData.plan.videoGenerationLimit
			};
		} catch (error) {
			console.error('Error getting user limits:', error);
			// Default to unlimited on error to be permissive
			return {
				textGenerationLimit: null,
				imageGenerationLimit: null,
				videoGenerationLimit: null
			};
		}
	}

	/**
	 * Check if user exists in the database
	 */
	static async userExists(userId: string): Promise<boolean> {
		try {
			const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
			return !!user;
		} catch (error) {
			console.error('Error checking user existence:', error);
			return false;
		}
	}

	/**
	 * Get the next reset time for free plan users (next 00:00 or 12:00 UTC)
	 */
	static getNextFreeResetTime(): Date {
		const now = new Date();
		const currentHour = now.getUTCHours();

		let nextReset = new Date(now);
		nextReset.setUTCMinutes(0, 0, 0); // Set to exact hour

		if (currentHour < 12) {
			// Next reset is at 12:00 UTC today
			nextReset.setUTCHours(12);
		} else {
			// Next reset is at 00:00 UTC tomorrow
			nextReset.setUTCDate(nextReset.getUTCDate() + 1);
			nextReset.setUTCHours(0);
		}

		return nextReset;
	}

	/**
	 * Get free plan period info for display
	 */
	static getFreePlanPeriod() {
		const now = new Date();
		const nextReset = this.getNextFreeResetTime();
		const hoursUntilReset = Math.floor((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60));

		// Calculate current period start (last 00:00 or 12:00 UTC)
		const currentHour = now.getUTCHours();
		const periodStart = new Date(now);
		periodStart.setUTCMinutes(0, 0, 0);

		if (currentHour >= 12) {
			// Current period started at 12:00 UTC today
			periodStart.setUTCHours(12);
		} else {
			// Current period started at 00:00 UTC today
			periodStart.setUTCHours(0);
		}

		return {
			start: periodStart.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				timeZone: 'UTC'
			}) + ' at ' + periodStart.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'UTC'
			}) + ' UTC',
			end: nextReset.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				timeZone: 'UTC'
			}) + ' at ' + nextReset.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'UTC'
			}) + ' UTC',
			daysRemaining: 0, // Not applicable for 12-hour periods
			hoursRemaining: hoursUntilReset,
			month: now.getMonth() + 1,
			year: now.getFullYear()
		};
	}

	/**
	 * Check if free plan usage should be reset (every 12 hours at 00:00 and 12:00 UTC)
	 */
	static shouldResetFreeUsage(lastResetAt: Date): boolean {
		const now = new Date();
		const timeSinceReset = now.getTime() - lastResetAt.getTime();
		const twelveHoursInMs = 12 * 60 * 60 * 1000;

		// Simple check: if it's been more than 12 hours since last reset
		if (timeSinceReset >= twelveHoursInMs) {
			return true;
		}

		// Check if we've crossed a reset boundary (00:00 or 12:00 UTC)
		const currentHour = now.getUTCHours();
		const lastResetHour = lastResetAt.getUTCHours();
		const sameDay = now.getUTCDate() === lastResetAt.getUTCDate() && now.getUTCMonth() === lastResetAt.getUTCMonth() && now.getUTCFullYear() === lastResetAt.getUTCFullYear();

		if (sameDay) {
			// Same day: check if we crossed from AM to PM (12:00 UTC)
			return (lastResetHour < 12 && currentHour >= 12);
		} else {
			// Different day: we've definitely crossed midnight (00:00 UTC)
			return true;
		}
	}

	/**
	 * Reset free plan usage to zero
	 */
	static async resetFreeUsage(userId: string, month: number, year: number): Promise<void> {
		const now = new Date();

		try {
			await db
				.update(usageTracking)
				.set({
					textGenerationCount: 0,
					imageGenerationCount: 0,
					videoGenerationCount: 0,
					lastResetAt: now,
					updatedAt: now,
				})
				.where(
					and(
						eq(usageTracking.userId, userId),
						eq(usageTracking.month, month),
						eq(usageTracking.year, year)
					)
				);

			console.log(`Reset free plan usage for user ${userId} at ${now.toISOString()}`);
		} catch (error) {
			console.error('Error resetting free plan usage:', error);
			throw error;
		}
	}

	/**
	 * Get current usage for free plan users (with 12-hour reset logic)
	 */
	static async getCurrentFreeUsage(userId: string): Promise<CurrentUsage> {
		const now = new Date();
		const currentMonth = now.getMonth() + 1; // 1-12
		const currentYear = now.getFullYear();

		try {
			const [usage] = await db
				.select()
				.from(usageTracking)
				.where(
					and(
						eq(usageTracking.userId, userId),
						eq(usageTracking.month, currentMonth),
						eq(usageTracking.year, currentYear)
					)
				);

			if (!usage) {
				// Create new usage record for this month
				const newUsage = {
					userId,
					month: currentMonth,
					year: currentYear,
					textGenerationCount: 0,
					imageGenerationCount: 0,
					videoGenerationCount: 0
				};

				await db.insert(usageTracking).values(newUsage).onConflictDoNothing();

				// Fetch the record (either the one we just created or existing one from concurrent request)
				const [createdUsage] = await db
					.select()
					.from(usageTracking)
					.where(
						and(
							eq(usageTracking.userId, userId),
							eq(usageTracking.month, currentMonth),
							eq(usageTracking.year, currentYear)
						)
					);

				return {
					textGenerationCount: createdUsage?.textGenerationCount || 0,
					imageGenerationCount: createdUsage?.imageGenerationCount || 0,
					videoGenerationCount: createdUsage?.videoGenerationCount || 0,
					month: currentMonth,
					year: currentYear
				};
			}

			// Check if usage should be reset (every 12 hours)
			if (this.shouldResetFreeUsage(usage.lastResetAt)) {
				await this.resetFreeUsage(userId, currentMonth, currentYear);

				return {
					textGenerationCount: 0,
					imageGenerationCount: 0,
					videoGenerationCount: 0,
					month: currentMonth,
					year: currentYear
				};
			}

			return {
				textGenerationCount: usage.textGenerationCount,
				imageGenerationCount: usage.imageGenerationCount,
				videoGenerationCount: usage.videoGenerationCount,
				month: usage.month,
				year: usage.year
			};
		} catch (error) {
			console.error('Error getting current free usage:', error);
			return {
				textGenerationCount: 0,
				imageGenerationCount: 0,
				videoGenerationCount: 0,
				month: currentMonth,
				year: currentYear
			};
		}
	}

	/**
	 * Get current month usage for a user
	 */
	static async getCurrentMonthUsage(userId: string, planTier?: string): Promise<CurrentUsage> {
		// If plan tier is provided, use it; otherwise query from database
		let userPlanTier = planTier;

		if (!userPlanTier) {
			try {
				const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
				userPlanTier = user?.planTier ?? 'free';
			} catch (error) {
				console.error('Error checking user plan tier:', error);
				// Continue with regular monthly logic as fallback
				userPlanTier = 'free';
			}
		}

		// Check if user is on free plan - if so, use 12-hour reset logic
		if (userPlanTier === 'free') {
			return await this.getCurrentFreeUsage(userId);
		}

		const now = new Date();
		const currentMonth = now.getMonth() + 1; // 1-12
		const currentYear = now.getFullYear();

		try {
			const [usage] = await db
				.select()
				.from(usageTracking)
				.where(
					and(
						eq(usageTracking.userId, userId),
						eq(usageTracking.month, currentMonth),
						eq(usageTracking.year, currentYear)
					)
				);

			if (!usage) {
				// Create new usage record for this month using ON CONFLICT to handle race conditions
				const newUsage = {
					userId,
					month: currentMonth,
					year: currentYear,
					textGenerationCount: 0,
					imageGenerationCount: 0,
					videoGenerationCount: 0
				};

				await db.insert(usageTracking).values(newUsage).onConflictDoNothing();
				
				// Fetch the record (either the one we just created or existing one from concurrent request)
				const [createdUsage] = await db
					.select()
					.from(usageTracking)
					.where(
						and(
							eq(usageTracking.userId, userId),
							eq(usageTracking.month, currentMonth),
							eq(usageTracking.year, currentYear)
						)
					);
				
				return {
					textGenerationCount: createdUsage?.textGenerationCount || 0,
					imageGenerationCount: createdUsage?.imageGenerationCount || 0,
					videoGenerationCount: createdUsage?.videoGenerationCount || 0,
					month: currentMonth,
					year: currentYear
				};
			}

			return {
				textGenerationCount: usage.textGenerationCount,
				imageGenerationCount: usage.imageGenerationCount,
				videoGenerationCount: usage.videoGenerationCount,
				month: usage.month,
				year: usage.year
			};
		} catch (error) {
			console.error('Error getting current usage:', error);
			return {
				textGenerationCount: 0,
				imageGenerationCount: 0,
				videoGenerationCount: 0,
				month: currentMonth,
				year: currentYear
			};
		}
	}

	/**
	 * Check if user can make a request based on their limits and current usage
	 * Includes grace period logic for recently expired subscriptions
	 */
	static async checkUsageLimit(userId: string, usageType: 'text' | 'image' | 'video'): Promise<void> {
		// Get user info and check existence in single query
		const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

		if (!user) {
			console.warn(`User ${userId} not found in database - allowing request without tracking`);
			return; // Allow the request but skip usage tracking
		}

		const planTier = user.planTier ?? 'free';

		const [limits, currentUsage] = await Promise.all([
			this.getUserLimits(userId, planTier),
			this.getCurrentMonthUsage(userId, planTier)
		]);

		const limitKey = `${usageType}GenerationLimit` as keyof UsageLimits;
		const usageKey = `${usageType}GenerationCount` as keyof CurrentUsage;
		
		const limit = limits[limitKey];
		const used = currentUsage[usageKey];

		// null or -1 means unlimited
		if (limit === null || limit === -1) {
			return; // Unlimited usage
		}

		if (used >= limit) {
			// Check for grace period if user has exceeded limits
			const hasGracePeriod = await this.checkGracePeriod(userId);
			
			if (!hasGracePeriod) {
				const remaining = Math.max(0, limit - used);
				throw new UsageLimitError(
					`${usageType.charAt(0).toUpperCase() + usageType.slice(1)} generation limit exceeded. You have used ${used}/${limit} for this month.`,
					remaining
				);
			}
			
			// Allow usage during grace period but log it
			console.log(`Grace period usage for user ${userId}: ${usageType}`);
		}
	}

	/**
	 * Track usage after successful generation
	 */
	static async trackUsage(userId: string, usageType: 'text' | 'image' | 'video'): Promise<void> {
		// Check if user exists in database - if not, skip tracking
		const userExistsInDb = await this.userExists(userId);
		if (!userExistsInDb) {
			console.warn(`User ${userId} not found in database - skipping usage tracking`);
			return;
		}

		const now = new Date();
		const currentMonth = now.getMonth() + 1;
		const currentYear = now.getFullYear();

		try {
			// Use upsert to handle race conditions
			const updateField = `${usageType}GenerationCount`;
			
			await db.insert(usageTracking).values({
				userId,
				month: currentMonth,
				year: currentYear,
				textGenerationCount: usageType === 'text' ? 1 : 0,
				imageGenerationCount: usageType === 'image' ? 1 : 0,
				videoGenerationCount: usageType === 'video' ? 1 : 0,
				lastResetAt: now,
			}).onConflictDoUpdate({
				target: [usageTracking.userId, usageTracking.month, usageTracking.year],
				set: {
					textGenerationCount: usageType === 'text' 
						? sql`${usageTracking.textGenerationCount} + 1`
						: usageTracking.textGenerationCount,
					imageGenerationCount: usageType === 'image'
						? sql`${usageTracking.imageGenerationCount} + 1` 
						: usageTracking.imageGenerationCount,
					videoGenerationCount: usageType === 'video'
						? sql`${usageTracking.videoGenerationCount} + 1`
						: usageTracking.videoGenerationCount,
					updatedAt: now,
				}
			});

			console.log(`Tracked ${usageType} usage for user ${userId}`);
		} catch (error) {
			console.error('Error tracking usage:', error);
			// Don't throw - usage tracking failure shouldn't block the request
		}
	}

	/**
	 * Check and track usage in one call (for middleware)
	 */
	static async checkAndTrackUsage(userId: string, usageType: 'text' | 'image' | 'video'): Promise<void> {
		// First check if user can make the request
		await this.checkUsageLimit(userId, usageType);
		
		// If successful, track the usage
		await this.trackUsage(userId, usageType);
	}

	/**
	 * Check if user is approaching usage limits (>75%)
	 */
	static async checkUsageWarnings(userId: string): Promise<{
		text: boolean;
		image: boolean;
		video: boolean;
	}> {
		// Get plan tier once to avoid duplicate queries
		const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
		const planTier = user?.planTier ?? 'free';

		const [limits, currentUsage] = await Promise.all([
			this.getUserLimits(userId, planTier),
			this.getCurrentMonthUsage(userId, planTier)
		]);

		return {
			text: limits.textGenerationLimit !== null && limits.textGenerationLimit !== -1 
				? (currentUsage.textGenerationCount / limits.textGenerationLimit) > 0.75
				: false,
			image: limits.imageGenerationLimit !== null && limits.imageGenerationLimit !== -1
				? (currentUsage.imageGenerationCount / limits.imageGenerationLimit) > 0.75
				: false,
			video: limits.videoGenerationLimit !== null && limits.videoGenerationLimit !== -1
				? (currentUsage.videoGenerationCount / limits.videoGenerationLimit) > 0.75
				: false
		};
	}

	/**
	 * Get usage summary for dashboard display
	 */
	static async getUsageSummary(userId: string, planTier?: string) {
		// Single query to get user info if plan tier not provided
		let userPlanTier = planTier;
		if (!userPlanTier) {
			try {
				const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
				userPlanTier = user?.planTier ?? 'free';
			} catch (error) {
				console.error('Error getting user plan tier:', error);
				userPlanTier = 'free'; // Safe fallback
			}
		}

		const [limits, currentUsage] = await Promise.all([
			this.getUserLimits(userId, userPlanTier),
			this.getCurrentMonthUsage(userId, userPlanTier)
		]);

		return {
			text: {
				used: currentUsage.textGenerationCount,
				limit: limits.textGenerationLimit,
				percentage: limits.textGenerationLimit 
					? Math.min(100, (currentUsage.textGenerationCount / limits.textGenerationLimit) * 100)
					: 0
			},
			image: {
				used: currentUsage.imageGenerationCount,
				limit: limits.imageGenerationLimit,
				percentage: limits.imageGenerationLimit
					? Math.min(100, (currentUsage.imageGenerationCount / limits.imageGenerationLimit) * 100)
					: 0
			},
			video: {
				used: currentUsage.videoGenerationCount,
				limit: limits.videoGenerationLimit,
				percentage: limits.videoGenerationLimit
					? Math.min(100, (currentUsage.videoGenerationCount / limits.videoGenerationLimit) * 100)
					: 0
			},
			month: currentUsage.month,
			year: currentUsage.year
		};
	}

	/**
	 * Get model usage statistics for a user in the current billing period
	 */
	static async getModelUsageStatistics(userId: string): Promise<ModelUsageStatistic[]> {
		try {
			// Get the current billing period for the user
			const currentUsage = await this.getCurrentMonthUsage(userId);
			const { month, year } = currentUsage;

			// Get all chats for this user in the current billing period
			const userChats = await db
				.select({
					model: chats.model,
					messages: chats.messages,
				})
				.from(chats)
				.where(
					and(
						eq(chats.userId, userId),
						sql`EXTRACT(MONTH FROM ${chats.createdAt}) = ${month}`,
						sql`EXTRACT(YEAR FROM ${chats.createdAt}) = ${year}`
					)
				);

			if (userChats.length === 0) {
				return [];
			}

			// Count model usage from user messages (each user message = 1 model interaction)
			const modelCounts = new Map<string, number>();

			for (const chat of userChats) {
				const messages = chat.messages || [];
				for (const message of messages) {
					if (message.role === 'user') {
						// Use message model (for mid-chat switches) or fallback to chat model
						const modelUsed = message.model || chat.model;
						if (modelUsed) {
							modelCounts.set(modelUsed, (modelCounts.get(modelUsed) || 0) + 1);
						}
					}
				}
			}

			// Calculate total usage and percentages
			const totalUsage = Array.from(modelCounts.values()).reduce((sum, count) => sum + count, 0);
			
			// Convert to ModelUsageStatistic array and sort by usage
			const modelStats: ModelUsageStatistic[] = Array.from(modelCounts.entries())
				.map(([model, count]) => {
					const provider = getModelProvider(model);
					return {
						model,
						provider: provider?.name || 'Unknown',
						count,
						percentage: totalUsage > 0 ? Math.round((count / totalUsage) * 100) : 0,
					};
				})
				.sort((a, b) => b.count - a.count) // Sort by usage count descending
				.slice(0, 5); // Limit to top 5 models

			return modelStats;
		} catch (error) {
			console.error('Error getting model usage statistics:', error);
			return [];
		}
	}

	/**
	 * Check if user is in grace period (recently expired subscription)
	 */
	static async checkGracePeriod(userId: string): Promise<boolean> {
		try {
			// First check if user has free plan - no grace period for free users
			const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
			
			if (user?.planTier === 'free') {
				return false; // Free users don't get grace periods
			}

			const subscriptionData = await StripeService.getActiveSubscription(userId);
			
			// If user has active subscription, no grace period needed
			if (subscriptionData?.subscription?.status === 'active') {
				return false;
			}
			
			// Check if subscription recently expired (within last 3 days)
			if (subscriptionData?.subscription) {
				const subscription = subscriptionData.subscription;
				const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
				const now = new Date();
				const daysSinceExpiry = (now.getTime() - currentPeriodEnd.getTime()) / (1000 * 60 * 60 * 24);
				
				// Grace period: 3 days after subscription expiry
				if (daysSinceExpiry <= 3 && daysSinceExpiry >= 0) {
					return true;
				}
			}
			
			return false;
		} catch (error) {
			console.error('Error checking grace period:', error);
			return false;
		}
	}

	/**
	 * Reset usage for a specific month (admin function)
	 */
	static async resetMonthlyUsage(userId: string, month?: number, year?: number): Promise<void> {
		const now = new Date();
		const targetMonth = month || (now.getMonth() + 1);
		const targetYear = year || now.getFullYear();

		try {
			await db
				.update(usageTracking)
				.set({
					textGenerationCount: 0,
					imageGenerationCount: 0,
					videoGenerationCount: 0,
					lastResetAt: now,
					updatedAt: now,
				})
				.where(
					and(
						eq(usageTracking.userId, userId),
						eq(usageTracking.month, targetMonth),
						eq(usageTracking.year, targetYear)
					)
				);

			console.log(`Reset usage for user ${userId} for ${targetMonth}/${targetYear}`);
		} catch (error) {
			console.error('Error resetting usage:', error);
			throw error;
		}
	}
}
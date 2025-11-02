import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { createHash } from 'crypto';
import { db } from '$lib/server/db';
import { memories, focusSessions, users } from '$lib/server/db/schema';
import { eq, and, inArray, gte, lte, desc, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

// Memory mode types
export type MemoryMode = 'persistent' | 'humanized';
export type PrivacyLevel = 'public' | 'contextual' | 'private' | 'vault';
export type MemoryType = 'working' | 'consolidated' | 'wisdom';

interface MemoryMetadata {
	userId: string;
	chatId?: string;
	content: string;
	contentHash: string;
	memoryType: MemoryType;
	privacyLevel: PrivacyLevel;
	category?: string;
	tags: string[];
	importance: number;
	strength: number;
	decayRate: number;
	isPermanent: boolean;
	requiresAuth: boolean;
	timestamp: string;
	[key: string]: any;
}

interface SearchOptions {
	top_k?: number;
	includePrivate?: boolean;
	privateTags?: string[];
	categories?: string[];
	memoryTypes?: MemoryType[];
	minImportance?: number;
}

interface FocusModeConfig {
	categories: string[];
	boostFactor: number;
	durationHours: number;
}

/**
 * Dual-Mode Memory System with Pinecone Vector Database
 *
 * Supports two modes:
 * - PERSISTENT: Everything forever, no degradation
 * - HUMANIZED: Biomimetic memory with degradation and focus
 */
export class PineconeMemorySystem {
	private pinecone: Pinecone | null = null;
	private openai: OpenAI;
	private indexName = 'weaveai-memories';
	private initialized = false;

	constructor() {
		// Initialize OpenAI for embeddings
		this.openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY || ''
		});

		// Initialize Pinecone if configured
		if (env.PINECONE_API_KEY) {
			try {
				this.pinecone = new Pinecone({
					apiKey: env.PINECONE_API_KEY,
				});
				this.initialized = true;
				console.log('[Memory] Pinecone initialized successfully');
			} catch (error) {
				console.error('[Memory] Failed to initialize Pinecone:', error);
			}
		} else {
			console.warn('[Memory] Pinecone API key not configured - memory system disabled');
		}
	}

	/**
	 * Ensure Pinecone index exists
	 */
	private async ensureIndex(): Promise<void> {
		if (!this.pinecone) {
			throw new Error('Pinecone not initialized - add PINECONE_API_KEY to .env');
		}

		try {
			const indexes = await this.pinecone.listIndexes();
			const indexExists = indexes.indexes?.some(idx => idx.name === this.indexName);

			if (!indexExists) {
				console.log(`[Memory] Creating Pinecone index: ${this.indexName}`);
				await this.pinecone.createIndex({
					name: this.indexName,
					dimension: 1536, // text-embedding-3-small dimensions
					metric: 'cosine',
					spec: {
						serverless: {
							cloud: 'aws',
							region: 'us-east-1'
						}
					}
				});
				console.log('[Memory] Index created successfully');
			}
		} catch (error) {
			console.error('[Memory] Error ensuring index:', error);
			throw error;
		}
	}

	/**
	 * Generate embedding for content
	 */
	private async generateEmbedding(content: string): Promise<number[]> {
		try {
			const response = await this.openai.embeddings.create({
				model: 'text-embedding-3-small',
				input: content,
			});
			return response.data[0].embedding;
		} catch (error) {
			console.error('[Memory] Error generating embedding:', error);
			throw error;
		}
	}

	/**
	 * Calculate content hash for deduplication
	 */
	private calculateContentHash(content: string): string {
		return createHash('sha256').update(content).digest('hex');
	}

	/**
	 * Get user's memory mode
	 */
	private async getUserMemoryMode(userId: string): Promise<MemoryMode> {
		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: { memoryMode: true }
		});
		return (user?.memoryMode as MemoryMode) || 'humanized';
	}

	/**
	 * Calculate decay rate based on importance and memory mode
	 */
	private calculateDecayRate(importance: number, memoryMode: MemoryMode): number {
		if (memoryMode === 'persistent') {
			return 0; // No decay in persistent mode
		}

		// Humanized mode: higher importance = slower decay
		// Range: 0-100 (representing 0% - 100% decay per month)
		const baseDecay = 50; // 50% decay per month for neutral importance (5)
		const importanceFactor = (10 - importance) / 10; // 0 = no decay, 1 = full decay
		return Math.round(baseDecay * importanceFactor);
	}

	/**
	 * Store a new memory
	 */
	async storeMemory(
		userId: string,
		content: string,
		options: {
			chatId?: string;
			privacyLevel?: PrivacyLevel;
			category?: string;
			tags?: string[];
			importance?: number;
			memoryType?: MemoryType;
		} = {}
	): Promise<string> {
		if (!this.initialized) {
			throw new Error('Memory system not initialized - configure Pinecone API key');
		}

		await this.ensureIndex();

		// Get user's memory mode
		const memoryMode = await this.getUserMemoryMode(userId);

		// Calculate content hash for deduplication
		const contentHash = this.calculateContentHash(content);

		// Check if memory already exists
		const existing = await db.query.memories.findFirst({
			where: and(
				eq(memories.userId, userId),
				eq(memories.contentHash, contentHash)
			)
		});

		if (existing) {
			console.log('[Memory] Duplicate memory detected, skipping');
			return existing.id;
		}

		// Generate embedding
		const embedding = await this.generateEmbedding(content);

		// Prepare metadata
		const importance = options.importance ?? 5;
		const decayRate = this.calculateDecayRate(importance, memoryMode);
		const isPermanent = memoryMode === 'persistent';
		const privacyLevel = options.privacyLevel ?? 'contextual';
		const memoryType = options.memoryType ?? 'working';
		const tags = options.tags ?? [];

		// Generate unique Pinecone ID
		const pineconeId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Store vector in Pinecone
		const index = this.pinecone!.index(this.indexName);
		await index.upsert([
			{
				id: pineconeId,
				values: embedding,
				metadata: {
					userId,
					chatId: options.chatId || '',
					content: content.substring(0, 1000), // Pinecone metadata limit
					contentHash,
					memoryType,
					privacyLevel,
					category: options.category || '',
					tags: tags.join(','),
					importance,
					strength: 10,
					decayRate,
					isPermanent,
					requiresAuth: privacyLevel === 'vault',
					timestamp: new Date().toISOString()
				}
			}
		]);

		// Store metadata in database
		const [memory] = await db.insert(memories).values({
			userId,
			chatId: options.chatId,
			content,
			contentHash,
			pineconeId,
			memoryType,
			privacyLevel,
			category: options.category,
			tags,
			importance,
			strength: 10,
			decayRate,
			isPermanent,
			requiresAuth: privacyLevel === 'vault',
			metadata: {
				source: 'chat',
				context: options.chatId ? `chat:${options.chatId}` : 'manual'
			}
		}).returning();

		console.log(`[Memory] Stored memory ${memory.id} in ${memoryMode} mode (decay: ${decayRate})`);
		return memory.id;
	}

	/**
	 * Search memories with semantic similarity
	 */
	async searchMemories(
		userId: string,
		query: string,
		options: SearchOptions = {}
	): Promise<any[]> {
		if (!this.initialized) {
			console.warn('[Memory] Search skipped - Pinecone not configured');
			return [];
		}

		await this.ensureIndex();

		// Generate query embedding
		const queryEmbedding = await this.generateEmbedding(query);

		// Get user's memory mode
		const memoryMode = await this.getUserMemoryMode(userId);

		// Build Pinecone filter
		const filter: any = {
			userId: { $eq: userId }
		};

		// Apply privacy filtering
		if (!options.includePrivate) {
			filter.privacyLevel = { $in: ['public', 'contextual'] };
		} else if (options.privateTags && options.privateTags.length > 0) {
			// Include private memories with specific tags
			filter.$or = [
				{ privacyLevel: { $in: ['public', 'contextual'] } },
				{
					$and: [
						{ privacyLevel: { $eq: 'private' } },
						{ tags: { $in: options.privateTags } }
					]
				}
			];
		}

		// Filter by categories
		if (options.categories && options.categories.length > 0) {
			filter.category = { $in: options.categories };
		}

		// Filter by memory types
		if (options.memoryTypes && options.memoryTypes.length > 0) {
			filter.memoryType = { $in: options.memoryTypes };
		}

		// Filter by importance
		if (options.minImportance !== undefined) {
			filter.importance = { $gte: options.minImportance };
		}

		// Query Pinecone
		const index = this.pinecone!.index(this.indexName);
		const results = await index.query({
			vector: queryEmbedding,
			filter,
			topK: options.top_k || 10,
			includeMetadata: true
		});

		// Apply degradation in humanized mode
		let processedResults = results.matches || [];

		if (memoryMode === 'humanized') {
			processedResults = await this.applyDegradation(processedResults, userId);
		}

		// Check for active focus mode
		const focusBoost = await this.getActiveFocusBoost(userId);
		if (focusBoost) {
			processedResults = this.applyFocusBoost(processedResults, focusBoost);
		}

		// Sort by score (accounting for boosts)
		processedResults.sort((a, b) => (b.score || 0) - (a.score || 0));

		// Update access counts
		const memoryIds = processedResults
			.map(r => r.metadata?.contentHash)
			.filter(Boolean) as string[];

		if (memoryIds.length > 0) {
			await db
				.update(memories)
				.set({
					accessCount: sql`${memories.accessCount} + 1`,
					lastAccessedAt: new Date()
				})
				.where(
					and(
						eq(memories.userId, userId),
						inArray(memories.contentHash, memoryIds)
					)
				);
		}

		return processedResults;
	}

	/**
	 * Apply memory degradation in humanized mode
	 */
	private async applyDegradation(results: any[], userId: string): Promise<any[]> {
		const now = new Date();

		return results.map(result => {
			const metadata = result.metadata;
			if (!metadata || metadata.isPermanent) {
				return result;
			}

			// Calculate time since creation
			const created = new Date(metadata.timestamp);
			const monthsElapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);

			// Apply decay
			const decayFactor = Math.pow(1 - metadata.decayRate / 100, monthsElapsed);
			const currentStrength = metadata.strength * decayFactor;

			// Reduce score based on degraded strength
			const degradedScore = (result.score || 0) * (currentStrength / 10);

			return {
				...result,
				score: degradedScore,
				metadata: {
					...metadata,
					currentStrength
				}
			};
		}).filter(r => {
			// Filter out memories below forget threshold (strength < 1)
			return !r.metadata?.currentStrength || r.metadata.currentStrength >= 1;
		});
	}

	/**
	 * Get active focus mode boost for user
	 */
	private async getActiveFocusBoost(userId: string): Promise<FocusModeConfig | null> {
		const activeFocus = await db.query.focusSessions.findFirst({
			where: and(
				eq(focusSessions.userId, userId),
				eq(focusSessions.isActive, true),
				gte(focusSessions.expiresAt, new Date())
			)
		});

		if (!activeFocus) return null;

		return {
			categories: activeFocus.categories as string[],
			boostFactor: activeFocus.boostFactor / 100, // Convert 200 -> 2.0
			durationHours: activeFocus.durationHours
		};
	}

	/**
	 * Apply focus mode boost to search results
	 */
	private applyFocusBoost(results: any[], focusConfig: FocusModeConfig): any[] {
		return results.map(result => {
			const category = result.metadata?.category || '';
			const shouldBoost = focusConfig.categories.some(cat =>
				category.toLowerCase().includes(cat.toLowerCase())
			);

			if (shouldBoost) {
				return {
					...result,
					score: (result.score || 0) * focusConfig.boostFactor
				};
			}

			return result;
		});
	}

	/**
	 * Toggle user's memory mode
	 */
	async toggleMemoryMode(userId: string, mode: MemoryMode): Promise<void> {
		await db.update(users)
			.set({ memoryMode: mode })
			.where(eq(users.id, userId));

		console.log(`[Memory] User ${userId} switched to ${mode} mode`);
	}

	/**
	 * Activate focus mode
	 */
	async activateFocusMode(userId: string, config: FocusModeConfig): Promise<string> {
		// Deactivate any existing focus sessions
		await db.update(focusSessions)
			.set({ isActive: false })
			.where(and(
				eq(focusSessions.userId, userId),
				eq(focusSessions.isActive, true)
			));

		// Create new focus session
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + config.durationHours);

		const [session] = await db.insert(focusSessions).values({
			userId,
			categories: config.categories,
			boostFactor: Math.round(config.boostFactor * 100), // Convert 2.0 -> 200
			durationHours: config.durationHours,
			expiresAt
		}).returning();

		console.log(`[Memory] Focus mode activated for ${config.categories.join(', ')}`);
		return session.id;
	}

	/**
	 * Deactivate focus mode
	 */
	async deactivateFocusMode(userId: string): Promise<void> {
		await db.update(focusSessions)
			.set({ isActive: false })
			.where(and(
				eq(focusSessions.userId, userId),
				eq(focusSessions.isActive, true)
			));

		console.log(`[Memory] Focus mode deactivated for user ${userId}`);
	}

	/**
	 * Get memory statistics for user
	 */
	async getMemoryStats(userId: string): Promise<any> {
		const allMemories = await db.query.memories.findMany({
			where: eq(memories.userId, userId)
		});

		const stats = {
			total: allMemories.length,
			byType: {
				working: allMemories.filter(m => m.memoryType === 'working').length,
				consolidated: allMemories.filter(m => m.memoryType === 'consolidated').length,
				wisdom: allMemories.filter(m => m.memoryType === 'wisdom').length
			},
			byPrivacy: {
				public: allMemories.filter(m => m.privacyLevel === 'public').length,
				contextual: allMemories.filter(m => m.privacyLevel === 'contextual').length,
				private: allMemories.filter(m => m.privacyLevel === 'private').length,
				vault: allMemories.filter(m => m.privacyLevel === 'vault').length
			},
			avgImportance: allMemories.reduce((sum, m) => sum + m.importance, 0) / allMemories.length || 0,
			avgStrength: allMemories.reduce((sum, m) => sum + m.strength, 0) / allMemories.length || 0,
			permanent: allMemories.filter(m => m.isPermanent).length
		};

		return stats;
	}
}

// Export singleton instance
export const memorySystem = new PineconeMemorySystem();

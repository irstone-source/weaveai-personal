import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { linearTeamMappings } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Multi-Index Pinecone Manager for Client Intelligence
 *
 * Manages one Pinecone index per Linear team (client), enabling:
 * - Data isolation (GDPR/privacy compliance)
 * - Independent scaling per client
 * - Filtered queries within client scope
 * - Easy client data deletion
 *
 * Index naming convention: client-{linearTeamId}
 * Example: client-acme-corp, client-startup-xyz
 */

export interface ClientIndexMetadata {
	linearTeamId: string;
	linearTeamName: string;
	userId: string;
	createdAt: string;
	documentCount: number;
}

export interface IndexStats {
	totalVectorCount: number;
	dimension: number;
	indexFullness: number;
	totalIndexCount: number;
}

export class PineconeMultiIndexManager {
	private pinecone: Pinecone | null = null;
	private initialized = false;
	private indexDimension = 1536; // text-embedding-3-small
	private indexMetric: 'cosine' | 'dotproduct' | 'euclidean' = 'cosine';
	private serverlessConfig = {
		cloud: 'aws' as const,
		region: 'us-east-1' as const
	};

	constructor() {
		if (env.PINECONE_API_KEY) {
			try {
				this.pinecone = new Pinecone({
					apiKey: env.PINECONE_API_KEY,
				});
				this.initialized = true;
				console.log('[Pinecone Manager] Initialized successfully');
			} catch (error) {
				console.error('[Pinecone Manager] Failed to initialize:', error);
			}
		} else {
			console.warn('[Pinecone Manager] PINECONE_API_KEY not configured');
		}
	}

	/**
	 * Check if Pinecone is configured and ready
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Generate standardized client index name
	 */
	private generateIndexName(linearTeamId: string): string {
		// Sanitize teamId for Pinecone index naming rules:
		// - lowercase only
		// - alphanumeric and hyphens
		// - max 45 characters
		const sanitized = linearTeamId
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, '-')
			.replace(/--+/g, '-')
			.substring(0, 40); // Leave room for "client-" prefix

		return `client-${sanitized}`;
	}

	/**
	 * Create a new client index for a Linear team
	 */
	async createClientIndex(
		userId: string,
		linearTeamId: string,
		linearTeamName: string
	): Promise<string> {
		if (!this.pinecone) {
			throw new Error('Pinecone not initialized - configure PINECONE_API_KEY');
		}

		const indexName = this.generateIndexName(linearTeamId);

		try {
			// Check if index already exists
			const indexes = await this.pinecone.listIndexes();
			const exists = indexes.indexes?.some(idx => idx.name === indexName);

			if (exists) {
				console.log(`[Pinecone Manager] Index ${indexName} already exists`);

				// Update database mapping
				await this.updateTeamMapping(userId, linearTeamId, indexName);

				return indexName;
			}

			// Create new index
			console.log(`[Pinecone Manager] Creating index: ${indexName}`);
			await this.pinecone.createIndex({
				name: indexName,
				dimension: this.indexDimension,
				metric: this.indexMetric,
				spec: {
					serverless: this.serverlessConfig
				}
			});

			console.log(`[Pinecone Manager] Index ${indexName} created successfully`);

			// Update database mapping
			await this.updateTeamMapping(userId, linearTeamId, indexName);

			return indexName;
		} catch (error) {
			console.error(`[Pinecone Manager] Error creating index ${indexName}:`, error);
			throw error;
		}
	}

	/**
	 * Update team mapping with Pinecone index name
	 */
	private async updateTeamMapping(
		userId: string,
		linearTeamId: string,
		indexName: string
	): Promise<void> {
		await db
			.update(linearTeamMappings)
			.set({
				pineconeIndexName: indexName,
				updatedAt: new Date()
			})
			.where(
				and(
					eq(linearTeamMappings.userId, userId),
					eq(linearTeamMappings.linearTeamId, linearTeamId)
				)
			);
	}

	/**
	 * Get client's Pinecone index (create if not exists)
	 */
	async getClientIndex(
		userId: string,
		linearTeamId: string,
		linearTeamName: string,
		autoCreate = true
	) {
		if (!this.pinecone) {
			throw new Error('Pinecone not initialized');
		}

		// Check database for existing mapping
		const mapping = await db.query.linearTeamMappings.findFirst({
			where: and(
				eq(linearTeamMappings.userId, userId),
				eq(linearTeamMappings.linearTeamId, linearTeamId)
			)
		});

		let indexName: string;

		if (mapping?.pineconeIndexName) {
			indexName = mapping.pineconeIndexName;
		} else if (autoCreate) {
			indexName = await this.createClientIndex(userId, linearTeamId, linearTeamName);
		} else {
			throw new Error(`No Pinecone index found for team ${linearTeamId}`);
		}

		// Return Pinecone index instance
		return this.pinecone.index(indexName);
	}

	/**
	 * List all client indexes with metadata
	 */
	async listAllClientIndexes(): Promise<Array<{ name: string; metadata: ClientIndexMetadata | null }>> {
		if (!this.pinecone) {
			throw new Error('Pinecone not initialized');
		}

		try {
			const indexes = await this.pinecone.listIndexes();
			const clientIndexes = indexes.indexes?.filter(idx =>
				idx.name?.startsWith('client-')
			) || [];

			// Enrich with database metadata
			const enriched = await Promise.all(
				clientIndexes.map(async (idx) => {
					const indexName = idx.name || '';

					// Find corresponding team mapping
					const mapping = await db.query.linearTeamMappings.findFirst({
						where: eq(linearTeamMappings.pineconeIndexName, indexName)
					});

					let metadata: ClientIndexMetadata | null = null;

					if (mapping) {
						// Get vector count from Pinecone
						try {
							const index = this.pinecone!.index(indexName);
							const stats = await index.describeIndexStats();

							metadata = {
								linearTeamId: mapping.linearTeamId,
								linearTeamName: mapping.linearTeamName,
								userId: mapping.userId,
								createdAt: mapping.createdAt.toISOString(),
								documentCount: stats.totalRecordCount || 0
							};
						} catch (error) {
							console.warn(`[Pinecone Manager] Could not get stats for ${indexName}:`, error);
						}
					}

					return {
						name: indexName,
						metadata
					};
				})
			);

			return enriched;
		} catch (error) {
			console.error('[Pinecone Manager] Error listing indexes:', error);
			throw error;
		}
	}

	/**
	 * Get statistics for a specific client index
	 */
	async getClientIndexStats(userId: string, linearTeamId: string): Promise<IndexStats | null> {
		if (!this.pinecone) {
			throw new Error('Pinecone not initialized');
		}

		try {
			const mapping = await db.query.linearTeamMappings.findFirst({
				where: and(
					eq(linearTeamMappings.userId, userId),
					eq(linearTeamMappings.linearTeamId, linearTeamId)
				)
			});

			if (!mapping?.pineconeIndexName) {
				return null;
			}

			const index = this.pinecone.index(mapping.pineconeIndexName);
			const stats = await index.describeIndexStats();

			return {
				totalVectorCount: stats.totalRecordCount || 0,
				dimension: this.indexDimension,
				indexFullness: stats.indexFullness || 0,
				totalIndexCount: 1 // Individual index stats
			};
		} catch (error) {
			console.error('[Pinecone Manager] Error getting index stats:', error);
			return null;
		}
	}

	/**
	 * Delete a client index (WARNING: Irreversible!)
	 */
	async deleteClientIndex(userId: string, linearTeamId: string): Promise<boolean> {
		if (!this.pinecone) {
			throw new Error('Pinecone not initialized');
		}

		try {
			const mapping = await db.query.linearTeamMappings.findFirst({
				where: and(
					eq(linearTeamMappings.userId, userId),
					eq(linearTeamMappings.linearTeamId, linearTeamId)
				)
			});

			if (!mapping?.pineconeIndexName) {
				console.warn(`[Pinecone Manager] No index found for team ${linearTeamId}`);
				return false;
			}

			const indexName = mapping.pineconeIndexName;

			console.log(`[Pinecone Manager] Deleting index: ${indexName}`);
			await this.pinecone.deleteIndex(indexName);

			// Clear index name from database
			await db
				.update(linearTeamMappings)
				.set({
					pineconeIndexName: null,
					updatedAt: new Date()
				})
				.where(
					and(
						eq(linearTeamMappings.userId, userId),
						eq(linearTeamMappings.linearTeamId, linearTeamId)
					)
				);

			console.log(`[Pinecone Manager] Index ${indexName} deleted successfully`);
			return true;
		} catch (error) {
			console.error('[Pinecone Manager] Error deleting index:', error);
			throw error;
		}
	}

	/**
	 * Get all indexes for a specific user
	 */
	async getUserIndexes(userId: string): Promise<Array<{ teamId: string; teamName: string; indexName: string }>> {
		const mappings = await db.query.linearTeamMappings.findMany({
			where: eq(linearTeamMappings.userId, userId),
			columns: {
				linearTeamId: true,
				linearTeamName: true,
				pineconeIndexName: true
			}
		});

		return mappings
			.filter(m => m.pineconeIndexName)
			.map(m => ({
				teamId: m.linearTeamId,
				teamName: m.linearTeamName,
				indexName: m.pineconeIndexName!
			}));
	}

	/**
	 * Batch create indexes for multiple teams
	 */
	async batchCreateIndexes(
		userId: string,
		teams: Array<{ linearTeamId: string; linearTeamName: string }>
	): Promise<{ created: string[]; existing: string[]; errors: Array<{ teamId: string; error: string }> }> {
		const results = {
			created: [] as string[],
			existing: [] as string[],
			errors: [] as Array<{ teamId: string; error: string }>
		};

		for (const team of teams) {
			try {
				const indexName = await this.createClientIndex(
					userId,
					team.linearTeamId,
					team.linearTeamName
				);

				// Check if it was newly created or already existed
				const indexes = await this.pinecone!.listIndexes();
				const existed = indexes.indexes?.some(idx => idx.name === indexName);

				if (existed) {
					results.existing.push(indexName);
				} else {
					results.created.push(indexName);
				}
			} catch (error) {
				results.errors.push({
					teamId: team.linearTeamId,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		console.log(`[Pinecone Manager] Batch create completed: ${results.created.length} created, ${results.existing.length} existing, ${results.errors.length} errors`);
		return results;
	}
}

// Export singleton instance
export const pineconeManager = new PineconeMultiIndexManager();

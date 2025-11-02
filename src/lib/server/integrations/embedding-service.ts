/**
 * Embedding Service for Meeting Transcripts
 *
 * Handles:
 * - Transcript chunking with speaker context
 * - Text embedding generation
 * - Vector storage in Pinecone
 * - Semantic search capabilities
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { db } from '$lib/server/db';
import {
	meetings,
	meetingTranscripts,
	meetingInsights,
	clientProfiles,
	clientInteractions
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// Configuration
// ============================================================================

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const EMBEDDING_MODEL = 'text-embedding-3-small'; // OpenAI embedding model
const CHUNK_SIZE = 500; // Characters per chunk
const CHUNK_OVERLAP = 100; // Overlap between chunks for context

// Pinecone index names
const MEETING_INDEX = 'meetings';
const CLIENT_PROFILE_INDEX = 'client-profiles';

// ============================================================================
// Types
// ============================================================================

export interface TranscriptChunk {
	id: string;
	meetingId: string;
	chunkIndex: number;
	text: string;
	speaker?: string;
	timestamp?: number;
	metadata: {
		meetingTitle: string;
		meetingDate: string;
		userId: string;
		projectId?: string;
		attendees: string[];
		[key: string]: any;
	};
}

export interface EmbeddingResult {
	chunkId: string;
	embedding: number[];
	stored: boolean;
	error?: string;
}

// ============================================================================
// Initialize Pinecone
// ============================================================================

let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
	if (!pineconeClient && PINECONE_API_KEY) {
		pineconeClient = new Pinecone({
			apiKey: PINECONE_API_KEY
		});
	}

	if (!pineconeClient) {
		throw new Error('Pinecone API key not configured');
	}

	return pineconeClient;
}

// ============================================================================
// Transcript Chunking
// ============================================================================

/**
 * Split transcript into semantic chunks with speaker context
 */
export function chunkTranscript(
	transcript: {
		fullTranscript: string;
		segments?: Array<{
			speaker: string;
			text: string;
			timestamp?: number;
			duration?: number;
		}>;
	},
	meetingId: string,
	meetingMetadata: TranscriptChunk['metadata']
): TranscriptChunk[] {

	const chunks: TranscriptChunk[] = [];

	// If we have speaker segments, chunk by speaker turns
	if (transcript.segments && transcript.segments.length > 0) {
		let currentChunk = '';
		let currentSpeaker = '';
		let currentTimestamp = 0;
		let chunkIndex = 0;

		for (const segment of transcript.segments) {
			const segmentText = `${segment.speaker}: ${segment.text}`;

			// If adding this segment exceeds chunk size, save current chunk
			if (currentChunk.length + segmentText.length > CHUNK_SIZE && currentChunk.length > 0) {
				chunks.push({
					id: `${meetingId}-chunk-${chunkIndex}`,
					meetingId,
					chunkIndex,
					text: currentChunk.trim(),
					speaker: currentSpeaker,
					timestamp: currentTimestamp,
					metadata: meetingMetadata
				});

				chunkIndex++;
				currentChunk = '';
			}

			// Start new chunk or append to current
			if (currentChunk.length === 0) {
				currentSpeaker = segment.speaker;
				currentTimestamp = segment.timestamp || 0;
			}

			currentChunk += (currentChunk ? '\n' : '') + segmentText;
		}

		// Save final chunk
		if (currentChunk.length > 0) {
			chunks.push({
				id: `${meetingId}-chunk-${chunkIndex}`,
				meetingId,
				chunkIndex,
				text: currentChunk.trim(),
				speaker: currentSpeaker,
				timestamp: currentTimestamp,
				metadata: meetingMetadata
			});
		}

	} else {
		// Fallback: simple text splitting if no segments available
		const text = transcript.fullTranscript;
		let chunkIndex = 0;
		let startIndex = 0;

		while (startIndex < text.length) {
			const endIndex = Math.min(startIndex + CHUNK_SIZE, text.length);
			const chunkText = text.slice(startIndex, endIndex);

			chunks.push({
				id: `${meetingId}-chunk-${chunkIndex}`,
				meetingId,
				chunkIndex,
				text: chunkText.trim(),
				metadata: meetingMetadata
			});

			chunkIndex++;
			startIndex = endIndex - CHUNK_OVERLAP;
		}
	}

	return chunks;
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embeddings for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
	const openaiApiKey = process.env.OPENAI_API_KEY;

	if (!openaiApiKey) {
		throw new Error('OpenAI API key not configured');
	}

	const response = await fetch('https://api.openai.com/v1/embeddings', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${openaiApiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: EMBEDDING_MODEL,
			input: text
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`OpenAI embedding error: ${error}`);
	}

	const data = await response.json();
	return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple chunks in batch
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
	const openaiApiKey = process.env.OPENAI_API_KEY;

	if (!openaiApiKey) {
		throw new Error('OpenAI API key not configured');
	}

	// OpenAI allows up to 2048 inputs per batch
	const batchSize = 100;
	const allEmbeddings: number[][] = [];

	for (let i = 0; i < texts.length; i += batchSize) {
		const batch = texts.slice(i, i + batchSize);

		const response = await fetch('https://api.openai.com/v1/embeddings', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${openaiApiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: EMBEDDING_MODEL,
				input: batch
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenAI embedding error: ${error}`);
		}

		const data = await response.json();
		const embeddings = data.data.map((item: any) => item.embedding);
		allEmbeddings.push(...embeddings);
	}

	return allEmbeddings;
}

// ============================================================================
// Vector Storage (Pinecone)
// ============================================================================

/**
 * Store chunks with embeddings in Pinecone
 */
export async function storeChunksInPinecone(
	chunks: TranscriptChunk[],
	embeddings: number[][]
): Promise<EmbeddingResult[]> {

	if (chunks.length !== embeddings.length) {
		throw new Error('Chunks and embeddings length mismatch');
	}

	const pinecone = getPineconeClient();
	const index = pinecone.index(MEETING_INDEX);

	const results: EmbeddingResult[] = [];

	try {
		// Prepare vectors for upsert
		const vectors = chunks.map((chunk, i) => ({
			id: chunk.id,
			values: embeddings[i],
			metadata: {
				meetingId: chunk.meetingId,
				chunkIndex: chunk.chunkIndex,
				text: chunk.text,
				speaker: chunk.speaker || '',
				timestamp: chunk.timestamp || 0,
				...chunk.metadata
			}
		}));

		// Upsert in batches of 100 (Pinecone limit)
		const batchSize = 100;
		for (let i = 0; i < vectors.length; i += batchSize) {
			const batch = vectors.slice(i, i + batchSize);
			await index.upsert(batch);

			// Mark as stored
			for (const vector of batch) {
				results.push({
					chunkId: vector.id,
					embedding: vector.values,
					stored: true
				});
			}
		}

		console.log(`[Embedding Service] Stored ${results.length} chunks in Pinecone`);

	} catch (error) {
		console.error('[Embedding Service] Error storing in Pinecone:', error);

		// Mark all as failed
		for (let i = 0; i < chunks.length; i++) {
			results.push({
				chunkId: chunks[i].id,
				embedding: embeddings[i],
				stored: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}

	return results;
}

// ============================================================================
// High-Level: Process Meeting Transcript
// ============================================================================

/**
 * Complete pipeline: chunk transcript, generate embeddings, store in Pinecone
 */
export async function processMeetingTranscript(
	meetingId: string
): Promise<{
	success: boolean;
	chunksProcessed: number;
	chunksStored: number;
	errors: string[];
}> {

	const errors: string[] = [];

	try {
		// Get meeting and transcript
		const [meeting] = await db
			.select()
			.from(meetings)
			.where(eq(meetings.id, meetingId))
			.limit(1);

		if (!meeting) {
			throw new Error(`Meeting ${meetingId} not found`);
		}

		const [transcript] = await db
			.select()
			.from(meetingTranscripts)
			.where(eq(meetingTranscripts.meetingId, meetingId))
			.limit(1);

		if (!transcript) {
			throw new Error(`Transcript for meeting ${meetingId} not found`);
		}

		// Prepare metadata
		const metadata: TranscriptChunk['metadata'] = {
			meetingTitle: meeting.title,
			meetingDate: meeting.startTime.toISOString(),
			userId: meeting.userId,
			projectId: meeting.projectId || undefined,
			attendees: (meeting.attendees as any[])?.map((a: any) => a.email || a.name) || []
		};

		// 1. Chunk transcript
		console.log(`[Embedding Service] Chunking transcript for meeting ${meetingId}`);
		const chunks = chunkTranscript(
			{
				fullTranscript: transcript.fullTranscript,
				segments: transcript.segments as any[]
			},
			meetingId,
			metadata
		);

		console.log(`[Embedding Service] Created ${chunks.length} chunks`);

		// 2. Generate embeddings
		console.log(`[Embedding Service] Generating embeddings...`);
		const texts = chunks.map(c => c.text);
		const embeddings = await generateEmbeddingsBatch(texts);

		console.log(`[Embedding Service] Generated ${embeddings.length} embeddings`);

		// 3. Store in Pinecone
		console.log(`[Embedding Service] Storing in Pinecone...`);
		const results = await storeChunksInPinecone(chunks, embeddings);

		const chunksStored = results.filter(r => r.stored).length;
		const failedResults = results.filter(r => !r.stored);

		if (failedResults.length > 0) {
			errors.push(...failedResults.map(r => r.error || 'Unknown error'));
		}

		// 4. Update database
		await db
			.update(meetingTranscripts)
			.set({
				isChunked: true,
				chunksStored: chunksStored,
				updatedAt: new Date()
			})
			.where(eq(meetingTranscripts.meetingId, meetingId));

		await db
			.update(meetings)
			.set({
				isInMemory: chunksStored > 0,
				processingStatus: chunksStored === chunks.length ? 'completed' : 'partial',
				updatedAt: new Date()
			})
			.where(eq(meetings.id, meetingId));

		console.log(`[Embedding Service] Processing complete: ${chunksStored}/${chunks.length} chunks stored`);

		return {
			success: chunksStored > 0,
			chunksProcessed: chunks.length,
			chunksStored,
			errors
		};

	} catch (error) {
		console.error('[Embedding Service] Error processing transcript:', error);
		errors.push(error instanceof Error ? error.message : 'Unknown error');

		return {
			success: false,
			chunksProcessed: 0,
			chunksStored: 0,
			errors
		};
	}
}

// ============================================================================
// Semantic Search
// ============================================================================

/**
 * Search meeting transcripts by semantic similarity
 */
export async function searchMeetingTranscripts(
	query: string,
	userId: string,
	options: {
		topK?: number;
		projectId?: string;
		dateRange?: {
			start: Date;
			end: Date;
		};
	} = {}
): Promise<Array<{
	meetingId: string;
	chunkId: string;
	text: string;
	score: number;
	metadata: any;
}>> {

	const pinecone = getPineconeClient();
	const index = pinecone.index(MEETING_INDEX);

	// Generate query embedding
	const queryEmbedding = await generateEmbedding(query);

	// Build filter
	const filter: any = {
		userId: { $eq: userId }
	};

	if (options.projectId) {
		filter.projectId = { $eq: options.projectId };
	}

	if (options.dateRange) {
		filter.meetingDate = {
			$gte: options.dateRange.start.toISOString(),
			$lte: options.dateRange.end.toISOString()
		};
	}

	// Query Pinecone
	const results = await index.query({
		vector: queryEmbedding,
		topK: options.topK || 10,
		filter,
		includeMetadata: true
	});

	// Format results
	return results.matches?.map(match => ({
		meetingId: match.metadata?.meetingId as string,
		chunkId: match.id,
		text: match.metadata?.text as string,
		score: match.score || 0,
		metadata: match.metadata
	})) || [];
}

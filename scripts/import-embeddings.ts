#!/usr/bin/env ts-node

import postgres from 'postgres';
import { Pinecone } from '@pinecone-database/pinecone';
import { config } from 'dotenv';

// Load environment variables
config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL!;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// User ID from database
const USER_ID = '8230779e-3473-42b8-8b26-62ddfe6a6ba7';

// Pinecone index for imported conversations (uses existing index)
const PINECONE_INDEX = process.env.PINECONE_INDEX_NAME || 'weaveai-personal';

// Embedding model
const EMBEDDING_MODEL = 'text-embedding-3-small';

// Batch sizes
const BATCH_SIZE = 100; // Messages per batch
const EMBEDDING_BATCH_SIZE = 100; // OpenAI allows up to 2048

// Rate limiting
const DELAY_MS = 50; // Delay between batches

// ============================================================================
// DATABASE CLIENT
// ============================================================================

const sql = postgres(DATABASE_URL);

// ============================================================================
// PINECONE CLIENT
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
// TYPE DEFINITIONS
// ============================================================================

interface ImportedMessage {
  id: string;
  conversationId: string;
  chatgptUuid: string;
  sender: 'human' | 'assistant';
  text: string;
  conversationName: string;
  conversationSummary: string | null;
  chatgptCreatedAt: Date;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate embeddings for text using OpenAI
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const allEmbeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
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

    // Rate limiting
    if (i + EMBEDDING_BATCH_SIZE < texts.length) {
      await delay(DELAY_MS);
    }
  }

  return allEmbeddings;
}

/**
 * Store embeddings in Pinecone
 */
async function storeEmbeddingsInPinecone(
  messages: ImportedMessage[],
  embeddings: number[][]
): Promise<{ stored: number; failed: number; errors: string[] }> {

  if (messages.length !== embeddings.length) {
    throw new Error('Messages and embeddings length mismatch');
  }

  const pinecone = getPineconeClient();
  const index = pinecone.index(PINECONE_INDEX);

  let stored = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Prepare vectors for upsert
    const vectors = messages.map((msg, i) => ({
      id: msg.id, // Use message ID as Pinecone ID
      values: embeddings[i],
      metadata: {
        messageId: msg.id,
        conversationId: msg.conversationId,
        chatgptUuid: msg.chatgptUuid,
        sender: msg.sender,
        text: msg.text.substring(0, 1000), // Limit text size in metadata
        conversationName: msg.conversationName,
        conversationSummary: msg.conversationSummary?.substring(0, 500) || '',
        userId: USER_ID,
        createdAt: msg.chatgptCreatedAt.toISOString()
      }
    }));

    // Upsert in batches of 100 (Pinecone limit)
    for (let i = 0; i < vectors.length; i += 100) {
      const batch = vectors.slice(i, i + 100);

      try {
        await index.upsert(batch);
        stored += batch.length;
      } catch (error) {
        failed += batch.length;
        errors.push(`Batch ${i}-${i + batch.length} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

  } catch (error) {
    errors.push(`Pinecone storage error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    failed = messages.length - stored;
  }

  return { stored, failed, errors };
}

/**
 * Update database with embedding status
 */
async function updateMessageEmbeddingStatus(
  messageIds: string[],
  status: { isPineconeStored: boolean; pineconeId: string | null; embeddingGenerated: boolean }
): Promise<void> {

  for (const messageId of messageIds) {
    await sql`
      UPDATE imported_message
      SET
        "isPineconeStored" = ${status.isPineconeStored},
        "pineconeId" = ${status.pineconeId || messageId},
        "embeddingGenerated" = ${status.embeddingGenerated}
      WHERE id = ${messageId}
    `;
  }
}

// ============================================================================
// MAIN EMBEDDING GENERATION FUNCTION
// ============================================================================

async function generateEmbeddingsForImportedMessages(): Promise<void> {
  console.log('\n🚀 Embedding Generation Starting...\n');
  console.log('━'.repeat(60));

  try {
    // Verify API keys
    if (!OPENAI_API_KEY) {
      console.error('\n❌ ERROR: OPENAI_API_KEY not set in .env file!');
      process.exit(1);
    }

    if (!PINECONE_API_KEY) {
      console.error('\n❌ ERROR: PINECONE_API_KEY not set in .env file!');
      process.exit(1);
    }

    // Get total message count
    const totalResult = await sql`
      SELECT COUNT(*) as count
      FROM imported_message im
      JOIN imported_conversation ic ON im."conversationId" = ic.id
      WHERE ic."userId" = ${USER_ID}
      AND im."embeddingGenerated" = false
    `;

    const totalMessages = Number(totalResult[0].count);
    console.log(`\n📊 Found ${totalMessages} messages without embeddings`);

    if (totalMessages === 0) {
      console.log('\n✅ All messages already have embeddings!');
      process.exit(0);
    }

    let processed = 0;
    let totalStored = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    // Process messages in batches
    while (processed < totalMessages) {
      console.log(`\n📥 Processing batch ${Math.floor(processed / BATCH_SIZE) + 1}...`);

      // Fetch batch of messages
      const messages = await sql<ImportedMessage[]>`
        SELECT
          im.id,
          im."conversationId",
          im."chatgptUuid",
          im.sender,
          im.text,
          ic.name as "conversationName",
          ic.summary as "conversationSummary",
          ic."chatgptCreatedAt"
        FROM imported_message im
        JOIN imported_conversation ic ON im."conversationId" = ic.id
        WHERE ic."userId" = ${USER_ID}
        AND im."embeddingGenerated" = false
        ORDER BY ic."chatgptCreatedAt" DESC, im."createdAt" ASC
        LIMIT ${BATCH_SIZE}
      `;

      if (messages.length === 0) break;

      console.log(`  ✅ Fetched ${messages.length} messages`);

      // Generate embeddings
      console.log(`  🔄 Generating embeddings...`);
      const texts = messages.map(m => m.text);

      try {
        const embeddings = await generateEmbeddings(texts);
        console.log(`  ✅ Generated ${embeddings.length} embeddings`);

        // Store in Pinecone
        console.log(`  🔄 Storing in Pinecone...`);
        const result = await storeEmbeddingsInPinecone(messages, embeddings);

        totalStored += result.stored;
        totalFailed += result.failed;

        if (result.errors.length > 0) {
          allErrors.push(...result.errors);
        }

        console.log(`  ✅ Stored ${result.stored} embeddings in Pinecone`);

        // Update database
        const successfulMessageIds = messages
          .slice(0, result.stored)
          .map(m => m.id);

        if (successfulMessageIds.length > 0) {
          await updateMessageEmbeddingStatus(successfulMessageIds, {
            isPineconeStored: true,
            pineconeId: null, // Will use message ID
            embeddingGenerated: true
          });
          console.log(`  ✅ Updated ${successfulMessageIds.length} message records`);
        }

        // Mark failed messages as having generated embeddings but not stored
        const failedMessageIds = messages
          .slice(result.stored)
          .map(m => m.id);

        if (failedMessageIds.length > 0) {
          await updateMessageEmbeddingStatus(failedMessageIds, {
            isPineconeStored: false,
            pineconeId: null,
            embeddingGenerated: true
          });
        }

      } catch (error: any) {
        console.error(`  ❌ Error processing batch:`, error.message);
        allErrors.push(`Batch error: ${error.message}`);
        totalFailed += messages.length;
      }

      processed += messages.length;

      // Progress update
      const percentComplete = Math.round((processed / totalMessages) * 100);
      console.log(`\n📈 Progress: ${processed}/${totalMessages} (${percentComplete}%)`);

      // Rate limiting between batches
      await delay(DELAY_MS);
    }

    // Summary
    console.log('\n' + '━'.repeat(60));
    console.log('\n✅ EMBEDDING GENERATION COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`  • Total Processed: ${processed}`);
    console.log(`  • Successfully Stored: ${totalStored}`);
    console.log(`  • Failed: ${totalFailed}`);

    if (allErrors.length > 0) {
      console.log(`\n⚠️  Errors (${allErrors.length}):`);
      allErrors.slice(0, 10).forEach(err => console.log(`  • ${err}`));
      if (allErrors.length > 10) {
        console.log(`  • ... and ${allErrors.length - 10} more`);
      }
    }

    // Get final counts
    const embeddedCount = await sql`
      SELECT COUNT(*) as count
      FROM imported_message im
      JOIN imported_conversation ic ON im."conversationId" = ic.id
      WHERE ic."userId" = ${USER_ID}
      AND im."embeddingGenerated" = true
    `;

    const storedCount = await sql`
      SELECT COUNT(*) as count
      FROM imported_message im
      JOIN imported_conversation ic ON im."conversationId" = ic.id
      WHERE ic."userId" = ${USER_ID}
      AND im."isPineconeStored" = true
    `;

    console.log('\n📊 Database Summary:');
    console.log(`  • Messages with Embeddings: ${embeddedCount[0].count}`);
    console.log(`  • Messages in Pinecone: ${storedCount[0].count}`);

    console.log('\n🎯 Next Steps:');
    console.log('  1. Test semantic search on imported conversations');
    console.log('  2. Integrate into AI chat for context-aware responses');
    console.log('  3. Build UI to browse and search conversations\n');

  } catch (error: any) {
    console.error('\n❌ Embedding generation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the script
generateEmbeddingsForImportedMessages();

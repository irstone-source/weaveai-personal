#!/usr/bin/env tsx

import postgres from 'postgres';
import { config } from 'dotenv';
import { tagConversationsBatch } from '../src/lib/server/ai/conversation-tagging';

// Load environment variables
config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL!;
const USER_ID = '8230779e-3473-42b8-8b26-62ddfe6a6ba7';

// Batch settings
const BATCH_SIZE = 50; // Tag 50 conversations at a time
const CONCURRENCY = 5; // 5 concurrent AI requests
const DELAY_MS = 200; // 200ms delay between batches

// ============================================================================
// DATABASE CLIENT
// ============================================================================

const sql = postgres(DATABASE_URL);

// ============================================================================
// MAIN TAGGING FUNCTION
// ============================================================================

async function tagAllConversations(): Promise<void> {
  console.log('\n🏷️  Conversation Tagging Starting...\n');
  console.log('━'.repeat(60));

  try {
    // Verify API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('\n❌ ERROR: OPENAI_API_KEY not set in .env file!');
      process.exit(1);
    }

    // Get total conversation count
    const totalResult = await sql`
      SELECT COUNT(*) as count
      FROM imported_conversation
      WHERE "userId" = ${USER_ID}
      AND ("tagsGenerated" = false OR "tagsGenerated" IS NULL)
    `;

    const totalConversations = Number(totalResult[0].count);
    console.log(`\n📊 Found ${totalConversations} conversations without tags`);

    if (totalConversations === 0) {
      console.log('\n✅ All conversations already have tags!');
      process.exit(0);
    }

    // Estimate cost and time
    const estimatedCost = (totalConversations * 0.0001).toFixed(2); // ~$0.0001 per tag with gpt-4o-mini
    const estimatedMinutes = Math.ceil((totalConversations / CONCURRENCY) * 0.5); // ~0.5s per request

    console.log(`\n💰 Estimated cost: $${estimatedCost}`);
    console.log(`⏱️  Estimated time: ~${estimatedMinutes} minutes`);
    console.log(`⚙️  Settings: ${CONCURRENCY} concurrent, ${DELAY_MS}ms delay\n`);

    let processed = 0;
    let totalTagged = 0;
    let totalFailed = 0;

    // Process conversations in batches
    while (processed < totalConversations) {
      console.log(`\n📥 Processing batch ${Math.floor(processed / BATCH_SIZE) + 1}...`);

      // Fetch batch of conversations without tags
      const conversations = await sql`
        SELECT id, name
        FROM imported_conversation
        WHERE "userId" = ${USER_ID}
        AND ("tagsGenerated" = false OR "tagsGenerated" IS NULL)
        ORDER BY "chatgptCreatedAt" DESC
        LIMIT ${BATCH_SIZE}
      `;

      if (conversations.length === 0) break;

      console.log(`  ✅ Fetched ${conversations.length} conversations`);

      // Tag conversations
      console.log(`  🔄 Generating tags with GPT-4o-mini...`);

      const conversationIds = conversations.map(c => c.id);

      const results = await tagConversationsBatch(conversationIds, {
        concurrency: CONCURRENCY,
        delayMs: DELAY_MS,
        onProgress: (completed, total, currentId) => {
          const conv = conversations.find(c => c.id === currentId);
          if (conv) {
            console.log(`  ⏳ [${completed}/${total}] Tagged: "${conv.name.substring(0, 50)}${conv.name.length > 50 ? '...' : ''}"`);
          }
        }
      });

      // Count successes and failures
      const successful = results.filter(r => r.tags.length > 0).length;
      const failed = results.filter(r => r.tags.length === 0).length;

      totalTagged += successful;
      totalFailed += failed;

      console.log(`  ✅ Tagged ${successful} conversations`);
      if (failed > 0) {
        console.log(`  ⚠️  Failed ${failed} conversations`);
      }

      // Show sample tags
      const sample = results.find(r => r.tags.length > 0);
      if (sample) {
        const conv = conversations.find(c => c.id === sample.conversationId);
        if (conv) {
          console.log(`  📋 Sample: "${conv.name}" → ${sample.tags.join(', ')}`);
        }
      }

      processed += conversations.length;

      // Progress update
      const percentComplete = Math.round((processed / totalConversations) * 100);
      console.log(`\n📈 Progress: ${processed}/${totalConversations} (${percentComplete}%)`);

      // Rate limiting between batches
      if (processed < totalConversations) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS * 2));
      }
    }

    // Summary
    console.log('\n' + '━'.repeat(60));
    console.log('\n✅ TAGGING COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`  • Total Processed: ${processed}`);
    console.log(`  • Successfully Tagged: ${totalTagged}`);
    console.log(`  • Failed: ${totalFailed}`);

    // Get tag statistics
    const tagStats = await sql`
      SELECT
        COUNT(DISTINCT id) as conversations_with_tags,
        COUNT(DISTINCT jsonb_array_elements_text(tags::jsonb)) as unique_tags
      FROM imported_conversation
      WHERE "userId" = ${USER_ID}
      AND "tagsGenerated" = true
      AND tags IS NOT NULL
      AND jsonb_array_length(tags::jsonb) > 0
    `;

    console.log(`\n📊 Tag Statistics:`);
    console.log(`  • Conversations with Tags: ${tagStats[0].conversations_with_tags}`);
    console.log(`  • Unique Tags: ${tagStats[0].unique_tags}`);

    // Show top tags
    const topTags = await sql`
      SELECT
        tag,
        COUNT(*) as count
      FROM imported_conversation,
      jsonb_array_elements_text(tags::jsonb) as tag
      WHERE "userId" = ${USER_ID}
      AND "tagsGenerated" = true
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 15
    `;

    console.log(`\n🏆 Top Tags:`);
    topTags.forEach(({ tag, count }) => {
      console.log(`  • ${tag}: ${count} conversations`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('  1. Use tags to filter context retrieval');
    console.log('  2. Build tag-based search UI');
    console.log('  3. Analyze conversation patterns by tag');
    console.log('  4. Create project/topic dashboards\n');

  } catch (error: any) {
    console.error('\n❌ Tagging failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the script
tagAllConversations();

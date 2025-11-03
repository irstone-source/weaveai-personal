#!/usr/bin/env tsx

import postgres from 'postgres';
import { config } from 'dotenv';
import { OpenAI } from 'openai';

// Load environment variables
config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const USER_ID = '8230779e-3473-42b8-8b26-62ddfe6a6ba7';

// Batch settings
const BATCH_SIZE = 50; // Tag 50 conversations at a time
const CONCURRENCY = 5; // 5 concurrent AI requests
const DELAY_MS = 200; // 200ms delay between batches
const TAGGING_MODEL = 'gpt-4o-mini';
const MAX_MESSAGES_FOR_ANALYSIS = 10;

// ============================================================================
// DATABASE CLIENT
// ============================================================================

const sql = postgres(DATABASE_URL);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ============================================================================
// TAGGING FUNCTIONS
// ============================================================================

async function generateTags(
  conversationTitle: string,
  messageSample: Array<{ role: string; content: string }>
): Promise<string[]> {
  try {
    const messagesContext = messageSample
      .map(m => `${m.role === 'human' ? 'User' : 'Assistant'}: ${m.content.substring(0, 500)}`)
      .join('\n\n');

    const prompt = `Analyze this conversation and generate relevant tags.

Title: "${conversationTitle}"

Sample messages:
${messagesContext}

Generate 5-10 highly relevant tags that describe:
1. Type (technical, creative, planning, research, personal, business, etc.)
2. Domain (web-dev, AI, design, marketing, data, etc.)
3. Intent (problem-solving, brainstorming, learning, debugging, etc.)
4. Specific topics (react, nextjs, python, seo, etc.)
5. Project references (if any project names are mentioned)

Return ONLY a JSON array of lowercase, hyphenated tags. No explanations.
Example: ["technical", "web-dev", "react", "problem-solving", "debugging"]`;

    const response = await openai.chat.completions.create({
      model: TAGGING_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a conversation analysis expert. Generate accurate, relevant tags for conversations. Always respond with valid JSON array only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    const content = response.choices[0].message.content || '[]';
    const tags = JSON.parse(content);

    if (!Array.isArray(tags)) {
      return [];
    }

    return tags
      .filter(tag => typeof tag === 'string' && tag.length > 0)
      .map(tag => tag.toLowerCase().trim())
      .slice(0, 10);

  } catch (error: any) {
    console.error('Error generating tags:', error.message);
    return [];
  }
}

async function tagConversation(conversationId: string): Promise<string[]> {
  try {
    // Get conversation
    const conversations = await sql`
      SELECT id, name
      FROM imported_conversation
      WHERE id = ${conversationId}
      LIMIT 1
    `;

    if (conversations.length === 0) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const conversation = conversations[0];

    // Get sample messages
    const messages = await sql`
      SELECT sender, text
      FROM imported_message
      WHERE "conversationId" = ${conversationId}
      ORDER BY "createdAt" ASC
      LIMIT ${MAX_MESSAGES_FOR_ANALYSIS}
    `;

    // Build message sample
    const messageSample = messages.map(m => ({
      role: m.sender,
      content: m.text
    }));

    // Generate tags
    const tags = await generateTags(conversation.name, messageSample);

    // Update conversation in database
    await sql`
      UPDATE imported_conversation
      SET
        tags = ${JSON.stringify(tags)}::json,
        "tagsGenerated" = true,
        "updatedAt" = NOW()
      WHERE id = ${conversationId}
    `;

    return tags;

  } catch (error: any) {
    console.error('Error tagging conversation:', error.message);
    return [];
  }
}

// ============================================================================
// MAIN TAGGING FUNCTION
// ============================================================================

async function tagAllConversations(): Promise<void> {
  console.log('\n🏷️  Conversation Tagging Starting...\n');
  console.log('━'.repeat(60));

  try {
    // Verify API key
    if (!OPENAI_API_KEY) {
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
    const estimatedCost = (totalConversations * 0.0001).toFixed(2);
    const estimatedMinutes = Math.ceil((totalConversations / CONCURRENCY) * 0.5);

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
      console.log(`  🔄 Generating tags with GPT-4o-mini...`);

      const conversationIds = conversations.map(c => c.id);

      // Process in concurrency batches
      const results = [];
      for (let i = 0; i < conversationIds.length; i += CONCURRENCY) {
        const batch = conversationIds.slice(i, i + CONCURRENCY);

        const batchResults = await Promise.allSettled(
          batch.map(async (convId) => {
            const tags = await tagConversation(convId);
            const conv = conversations.find(c => c.id === convId);
            if (conv) {
              console.log(`  ⏳ [${processed + results.length + batch.indexOf(convId) + 1}/${totalConversations}] Tagged: "${conv.name.substring(0, 50)}${conv.name.length > 50 ? '...' : ''}"`);
            }
            return {
              conversationId: convId,
              tags,
              confidence: tags.length > 0 ? 1 : 0
            };
          })
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          }
        }

        // Rate limiting between concurrent batches
        if (i + CONCURRENCY < conversationIds.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

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
        COUNT(DISTINCT id) as conversations_with_tags
      FROM imported_conversation
      WHERE "userId" = ${USER_ID}
      AND "tagsGenerated" = true
      AND tags IS NOT NULL
      AND jsonb_array_length(tags::jsonb) > 0
    `;

    const uniqueTagsResult = await sql`
      SELECT COUNT(DISTINCT tag) as unique_tags
      FROM (
        SELECT jsonb_array_elements_text(tags::jsonb) as tag
        FROM imported_conversation
        WHERE "userId" = ${USER_ID}
        AND "tagsGenerated" = true
        AND tags IS NOT NULL
      ) as tags_list
    `;

    console.log(`\n📊 Tag Statistics:`)
    console.log(`  • Conversations with Tags: ${tagStats[0].conversations_with_tags}`);
    console.log(`  • Unique Tags: ${uniqueTagsResult[0].unique_tags}`);

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

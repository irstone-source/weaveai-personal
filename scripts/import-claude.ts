#!/usr/bin/env ts-node

import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATA_DIR = join(process.cwd(), 'data-imports', 'claude');
const CONVERSATIONS_FILE = join(DATA_DIR, 'conversations.json');

const DATABASE_URL = process.env.DATABASE_URL!;

// User ID from database
const USER_ID = '8230779e-3473-42b8-8b26-62ddfe6a6ba7';

// Import limits (set to null for full import)
const MAX_CONVERSATIONS = null; // Import ALL conversations
const MAX_MESSAGES_PER_CONVERSATION = null; // Import ALL messages

// ============================================================================
// DATABASE CLIENT
// ============================================================================

const sql = postgres(DATABASE_URL);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MappingNode {
  id: string;
  message: {
    id: string;
    author: {
      role: string;
      name?: string;
      metadata?: any;
    };
    create_time: number | null;
    update_time: number | null;
    content: {
      content_type: string;
      parts: string[];
    };
    status: string;
    end_turn: boolean;
    weight: number;
    metadata: any;
    recipient: string;
  } | null;
  parent: string | null;
  children: string[];
}

interface ClaudeConversation {
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, MappingNode>;
  moderation_results?: any[];
  current_node?: string;
  plugin_ids?: string[] | null;
  conversation_id?: string;
  conversation_template_id?: string | null;
  id?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractTextFromContent(content: any): string {
  if (!content) return '';

  if (typeof content === 'string') return content;

  if (content.content_type === 'text' && content.parts) {
    return content.parts.join(' ').trim();
  }

  return '';
}

function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item));
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    return cleaned;
  }

  return obj;
}

function buildMessageList(mapping: Record<string, MappingNode>): Array<{
  id: string;
  role: string;
  text: string;
  createTime: number | null;
  metadata: any;
}> {
  const messages: Array<{
    id: string;
    role: string;
    text: string;
    createTime: number | null;
    metadata: any;
  }> = [];

  // Find root node (node with no parent)
  const rootNode = Object.values(mapping).find(node => node.parent === null);
  if (!rootNode) return messages;

  // Traverse the tree from root
  const traverse = (nodeId: string) => {
    const node = mapping[nodeId];
    if (!node) return;

    // Add message if it exists and isn't a system message
    if (node.message && node.message.author.role !== 'system') {
      const text = extractTextFromContent(node.message.content);
      if (text) {
        messages.push({
          id: node.message.id,
          role: node.message.author.role,
          text,
          createTime: node.message.create_time,
          metadata: node.message.metadata || {}
        });
      }
    }

    // Traverse children
    for (const childId of node.children) {
      traverse(childId);
    }
  };

  traverse(rootNode.id);
  return messages;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

async function importConversations(conversations: ClaudeConversation[]): Promise<void> {
  console.log(`\n📥 Importing ${conversations.length} conversations...\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const conv of conversations) {
    try {
      // Generate a UUID for this conversation (use conversation_id or id if available)
      const convUuid = conv.conversation_id || conv.id || randomUUID();

      // Check if conversation already exists
      const existing = await sql`
        SELECT id FROM imported_conversation WHERE "chatgptUuid" = ${convUuid}
      `;

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Validate and convert timestamps
      const createdAt = conv.create_time ? new Date(conv.create_time * 1000) : new Date();
      const updatedAt = conv.update_time ? new Date(conv.update_time * 1000) : new Date();

      // Skip if timestamps are invalid
      if (isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
        console.log(`  ⏭️  Skipping ${conv.title} (invalid timestamps)`);
        skipped++;
        continue;
      }

      // Build message list from mapping
      const messages = buildMessageList(conv.mapping);

      // Apply message limit if set
      const messagesToImport = MAX_MESSAGES_PER_CONVERSATION
        ? messages.slice(0, MAX_MESSAGES_PER_CONVERSATION)
        : messages;

      // Generate UUID for conversation
      const conversationId = randomUUID();

      // Import conversation
      await sql`
        INSERT INTO imported_conversation (
          id, "userId", "chatgptUuid", name, summary, "messageCount",
          "chatgptCreatedAt", "chatgptUpdatedAt"
        ) VALUES (
          ${conversationId},
          ${USER_ID},
          ${convUuid},
          ${conv.title || 'Untitled'},
          ${null},
          ${messagesToImport.length},
          ${createdAt},
          ${updatedAt}
        )
      `;

      // Import messages
      for (const msg of messagesToImport) {
        const messageId = randomUUID();
        const cleanedMetadata = removeUndefined(msg.metadata);

        await sql`
          INSERT INTO imported_message (
            id, "conversationId", "chatgptUuid", sender, text, content,
            attachments, files, metadata
          ) VALUES (
            ${messageId},
            ${conversationId},
            ${msg.id},
            ${msg.role === 'user' ? 'human' : 'assistant'},
            ${msg.text},
            ${JSON.stringify([])},
            ${JSON.stringify([])},
            ${JSON.stringify([])},
            ${JSON.stringify(cleanedMetadata)}
          )
        `;
      }

      imported++;
      if (imported % 10 === 0) {
        console.log(`  ✅ Imported ${imported} conversations...`);
      }

      // Rate limiting
      await delay(50); // Faster than ChatGPT import since these are simpler

    } catch (error: any) {
      console.error(`  ❌ Error importing ${conv.title}:`, error.message);
      errors++;
    }
  }

  console.log(`\n✨ Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors\n`);
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

async function main() {
  console.log('\n🚀 Claude/ChatGPT Mapping Format Import Starting...\n');
  console.log('━'.repeat(60));

  try {
    // Verify user ID
    if (USER_ID === 'your-user-id-here') {
      console.error('\n❌ ERROR: Please update USER_ID in the script first!');
      process.exit(1);
    }

    // Load conversations
    console.log('\n📖 Loading conversations.json...');
    const conversationsData = JSON.parse(readFileSync(CONVERSATIONS_FILE, 'utf-8'));
    const conversations: ClaudeConversation[] = MAX_CONVERSATIONS
      ? conversationsData.slice(0, MAX_CONVERSATIONS)
      : conversationsData;
    console.log(`  ✅ Loaded ${conversations.length} conversations`);

    // Import data
    await importConversations(conversations);

    // Summary
    console.log('\n' + '━'.repeat(60));
    console.log('\n✅ IMPORT COMPLETE!\n');

    // Get counts
    const convCount = await sql`SELECT COUNT(*) as count FROM imported_conversation WHERE "userId" = ${USER_ID}`;
    const msgCount = await sql`
      SELECT COUNT(*) as count FROM imported_message im
      JOIN imported_conversation ic ON im."conversationId" = ic.id
      WHERE ic."userId" = ${USER_ID}
    `;

    console.log('📊 Database Summary:');
    console.log(`  • Total Conversations: ${convCount[0].count}`);
    console.log(`  • Total Messages: ${msgCount[0].count}`);

    console.log('\n🎯 Next Steps:');
    console.log('  1. Generate embeddings: npm run import:embeddings');
    console.log('  2. View imported data in your WeaveAI dashboard');
    console.log('  3. Test search and retrieval\n');

  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the import
main();

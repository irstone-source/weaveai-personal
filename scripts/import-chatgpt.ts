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

const DATA_DIR = join(process.cwd(), 'data-imports', 'chatgpt');
const CONVERSATIONS_FILE = join(DATA_DIR, 'conversations.json');
const MEMORIES_FILE = join(DATA_DIR, 'memories.json');
const PROJECTS_FILE = join(DATA_DIR, 'projects.json');

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

interface ChatGPTMessage {
  uuid: string;
  text: string;
  sender: 'human' | 'assistant';
  create_time?: number;
  content?: any[];
  attachments?: any[];
  files?: any[];
  metadata?: any;
}

interface ChatGPTConversation {
  uuid: string;
  name: string;
  summary?: string;
  create_time: number;
  update_time: number;
  chat_messages: ChatGPTMessage[];
}

interface ChatGPTMemories {
  conversations_memory?: string;
  project_memories?: Record<string, string>;
}

interface ChatGPTProject {
  uuid?: string;
  id?: string;
  name: string;
  description?: string;
  conversation_id?: string;
  create_time?: number;
  update_time?: number;
  [key: string]: any;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractTextFromMessage(message: ChatGPTMessage): string {
  let text = message.text || '';

  // Extract text from content blocks if available
  if (message.content && Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block.type === 'text' && block.text) {
        text += ' ' + block.text;
      }
    }
  }

  return text.trim();
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

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

async function importConversations(conversations: ChatGPTConversation[]): Promise<void> {
  console.log(`\n📥 Importing ${conversations.length} conversations...`);

  let imported = 0;
  let skipped = 0;

  for (const conv of conversations) {
    try {
      // Check if conversation already exists
      const existing = await sql`
        SELECT id FROM imported_conversation WHERE "chatgptUuid" = ${conv.uuid}
      `;

      if (existing.length > 0) {
        console.log(`  ⏭️  Skipping ${conv.name} (already imported)`);
        skipped++;
        continue;
      }

      // Validate and convert timestamps
      const createdAt = conv.create_time ? new Date(conv.create_time * 1000) : new Date();
      const updatedAt = conv.update_time ? new Date(conv.update_time * 1000) : new Date();

      // Skip if timestamps are invalid
      if (isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
        console.log(`  ⏭️  Skipping ${conv.name} (invalid timestamps)`);
        skipped++;
        continue;
      }

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
          ${conv.uuid},
          ${conv.name || 'Untitled'},
          ${conv.summary || null},
          ${conv.chat_messages?.length || 0},
          ${createdAt},
          ${updatedAt}
        )
      `;

      // Import messages
      if (conv.chat_messages && conv.chat_messages.length > 0) {
        const messagesToImport = conv.chat_messages.slice(0, MAX_MESSAGES_PER_CONVERSATION);

        for (const msg of messagesToImport) {
          const text = extractTextFromMessage(msg);
          const messageId = randomUUID();

          await sql`
            INSERT INTO imported_message (
              id, "conversationId", "chatgptUuid", sender, text, content,
              attachments, files, metadata
            ) VALUES (
              ${messageId},
              ${conversationId},
              ${msg.uuid},
              ${msg.sender},
              ${text},
              ${JSON.stringify(msg.content || [])},
              ${JSON.stringify(msg.attachments || [])},
              ${JSON.stringify(msg.files || [])},
              ${JSON.stringify(msg.metadata || {})}
            )
          `;
        }
      }

      imported++;
      console.log(`  ✅ Imported: ${conv.name} (${conv.chat_messages?.length || 0} messages)`);

      // Rate limiting
      await delay(100);

    } catch (error: any) {
      console.error(`  ❌ Error importing ${conv.name}:`, error.message);
    }
  }

  console.log(`\n✨ Import complete: ${imported} imported, ${skipped} skipped\n`);
}

async function importMemories(memories: ChatGPTMemories): Promise<void> {
  console.log('\n📥 Importing memories...');

  let imported = 0;

  try {
    // Import conversation-wide memory
    if (memories.conversations_memory) {
      const memoryId = randomUUID();
      await sql`
        INSERT INTO imported_memory (
          id, "userId", "memoryType", content, category
        ) VALUES (
          ${memoryId},
          ${USER_ID},
          'conversation',
          ${memories.conversations_memory},
          'general'
        )
      `;
      imported++;
      console.log('  ✅ Imported conversation memory');
    }

    // Import project-specific memories
    if (memories.project_memories) {
      for (const [projectUuid, content] of Object.entries(memories.project_memories)) {
        const memoryId = randomUUID();
        await sql`
          INSERT INTO imported_memory (
            id, "userId", "memoryType", "projectUuid", content, category
          ) VALUES (
            ${memoryId},
            ${USER_ID},
            'project',
            ${projectUuid},
            ${content},
            'project'
          )
        `;
        imported++;
      }
      console.log(`  ✅ Imported ${Object.keys(memories.project_memories).length} project memories`);
    }

  } catch (error: any) {
    console.error('  ❌ Error importing memories:', error.message);
  }

  console.log(`\n✨ Memory import complete: ${imported} memories imported\n`);
}

async function importProjects(projects: ChatGPTProject[]): Promise<void> {
  console.log(`\n📥 Importing ${projects.length} projects...`);

  let imported = 0;
  let skipped = 0;

  for (const project of projects) {
    try {
      // Get project ID (could be uuid or id depending on export format)
      const chatgptProjectId = project.uuid || project.id;

      // Skip if project has no ID
      if (!chatgptProjectId) {
        console.log(`  ⏭️  Skipping ${project.name || 'Unnamed'} (no ID)`);
        skipped++;
        continue;
      }

      // Check if project already exists
      const existing = await sql`
        SELECT id FROM imported_project WHERE "chatgptProjectId" = ${chatgptProjectId}
      `;

      if (existing.length > 0) {
        console.log(`  ⏭️  Skipping ${project.name} (already imported)`);
        skipped++;
        continue;
      }

      // Clean project data of undefined values
      const cleanedProject = removeUndefined(project);

      // Extract project content
      const content = JSON.stringify(cleanedProject);
      const metadata = JSON.stringify(cleanedProject);

      const projectId = randomUUID();

      await sql`
        INSERT INTO imported_project (
          id, "userId", "chatgptProjectId", name, description,
          "conversationUuid", content, metadata
        ) VALUES (
          ${projectId},
          ${USER_ID},
          ${chatgptProjectId},
          ${project.name || 'Untitled Project'},
          ${project.description || null},
          ${project.conversation_id || null},
          ${content},
          ${metadata}
        )
      `;

      imported++;
      console.log(`  ✅ Imported: ${project.name}`);

    } catch (error: any) {
      console.error(`  ❌ Error importing ${project.name}:`, error.message);
    }
  }

  console.log(`\n✨ Project import complete: ${imported} imported, ${skipped} skipped\n`);
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

async function main() {
  console.log('\n🚀 ChatGPT Data Import Starting...\n');
  console.log('━'.repeat(60));

  try {
    // Verify user ID
    if (USER_ID === 'your-user-id-here') {
      console.error('\n❌ ERROR: Please update USER_ID in the script first!');
      console.log('\nTo get your user ID, run:');
      console.log('  DATABASE_URL="..." npx tsx -e "import postgres from \'postgres\'; const sql = postgres(process.env.DATABASE_URL!); sql`SELECT id, email FROM user`.then(console.log); setTimeout(() => process.exit(), 1000)"');
      process.exit(1);
    }

    // Load conversations
    console.log('\n📖 Loading conversations.json...');
    const conversationsData = JSON.parse(readFileSync(CONVERSATIONS_FILE, 'utf-8'));
    const conversations: ChatGPTConversation[] = MAX_CONVERSATIONS
      ? conversationsData.slice(0, MAX_CONVERSATIONS)
      : conversationsData;
    console.log(`  ✅ Loaded ${conversations.length} conversations`);

    // Load memories
    console.log('\n📖 Loading memories.json...');
    const memories: ChatGPTMemories = JSON.parse(readFileSync(MEMORIES_FILE, 'utf-8'));
    console.log(`  ✅ Loaded memories`);

    // Load projects
    console.log('\n📖 Loading projects.json...');
    const projectsData = JSON.parse(readFileSync(PROJECTS_FILE, 'utf-8'));
    const projects: ChatGPTProject[] = Array.isArray(projectsData) ? projectsData : [];
    console.log(`  ✅ Loaded ${projects.length} projects`);

    // Import data
    await importConversations(conversations);
    await importMemories(memories);
    await importProjects(projects);

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
    const memCount = await sql`SELECT COUNT(*) as count FROM imported_memory WHERE "userId" = ${USER_ID}`;
    const projCount = await sql`SELECT COUNT(*) as count FROM imported_project WHERE "userId" = ${USER_ID}`;

    console.log('📊 Database Summary:');
    console.log(`  • Conversations: ${convCount[0].count}`);
    console.log(`  • Messages: ${msgCount[0].count}`);
    console.log(`  • Memories: ${memCount[0].count}`);
    console.log(`  • Projects: ${projCount[0].count}`);

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

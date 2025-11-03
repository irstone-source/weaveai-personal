#!/usr/bin/env ts-node

import postgres from 'postgres';
import { config } from 'dotenv';

config();

const sql = postgres(process.env.DATABASE_URL!);
const USER_ID = '8230779e-3473-42b8-8b26-62ddfe6a6ba7';

async function checkStatus() {
  console.log('\n📊 Import Status Report\n');
  console.log('━'.repeat(60));

  // Conversations
  const convs = await sql`
    SELECT COUNT(*) as count
    FROM imported_conversation
    WHERE "userId" = ${USER_ID}
  `;
  console.log(`\n✅ Total Conversations: ${convs[0].count}`);

  // Messages
  const msgs = await sql`
    SELECT COUNT(*) as count
    FROM imported_message im
    JOIN imported_conversation ic ON im."conversationId" = ic.id
    WHERE ic."userId" = ${USER_ID}
  `;
  console.log(`✅ Total Messages: ${msgs[0].count}`);

  // Embeddings status
  const embedded = await sql`
    SELECT COUNT(*) as count
    FROM imported_message im
    JOIN imported_conversation ic ON im."conversationId" = ic.id
    WHERE ic."userId" = ${USER_ID}
    AND im."embeddingGenerated" = true
  `;
  console.log(`\n🔹 Messages with Embeddings: ${embedded[0].count}`);

  const pending = await sql`
    SELECT COUNT(*) as count
    FROM imported_message im
    JOIN imported_conversation ic ON im."conversationId" = ic.id
    WHERE ic."userId" = ${USER_ID}
    AND im."embeddingGenerated" = false
  `;
  console.log(`🔹 Messages Pending Embeddings: ${pending[0].count}`);

  // Projects and Memories
  const projects = await sql`
    SELECT COUNT(*) as count
    FROM imported_project
    WHERE "userId" = ${USER_ID}
  `;
  console.log(`\n✅ Projects: ${projects[0].count}`);

  const memories = await sql`
    SELECT COUNT(*) as count
    FROM imported_memory
    WHERE "userId" = ${USER_ID}
  `;
  console.log(`✅ Memories: ${memories[0].count}`);

  console.log('\n' + '━'.repeat(60) + '\n');

  await sql.end();
  process.exit(0);
}

checkStatus();

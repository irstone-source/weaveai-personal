#!/usr/bin/env tsx

import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL!;

async function addTagsColumns() {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('\n🔧 Adding tags columns to imported_conversation table...\n');

    // Add tags column
    await sql`
      ALTER TABLE "imported_conversation"
      ADD COLUMN IF NOT EXISTS "tags" json DEFAULT '[]'::json
    `;
    console.log('✅ Added "tags" column');

    // Add tagsGenerated column
    await sql`
      ALTER TABLE "imported_conversation"
      ADD COLUMN IF NOT EXISTS "tagsGenerated" boolean DEFAULT false NOT NULL
    `;
    console.log('✅ Added "tagsGenerated" column');

    console.log('\n✅ Schema update complete!\n');
    console.log('You can now run: npm run import:tags\n');

  } catch (error: any) {
    console.error('\n❌ Error adding columns:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

addTagsColumns();

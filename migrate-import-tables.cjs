#!/usr/bin/env node

// Run database migration for ChatGPT import tables
const { execSync } = require('child_process');

console.log('\n📋 Migrating ChatGPT import tables to database...\n');

try {
  // Load environment variables
  require('dotenv').config();

  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  console.log('✓ Database URL loaded from .env');
  console.log('\n🔄 Running drizzle-kit push...\n');

  // Run the migration with the DATABASE_URL
  execSync('npx drizzle-kit push', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL }
  });

  console.log('\n✅ Migration completed successfully!');
  console.log('\nNew tables created:');
  console.log('  - imported_conversation');
  console.log('  - imported_message');
  console.log('  - imported_memory');
  console.log('  - imported_project');

  process.exit(0);
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}

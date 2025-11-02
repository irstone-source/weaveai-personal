import postgres from 'postgres';
import fs from 'fs';

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

const sql = fs.readFileSync('apply-memory-schema.sql', 'utf-8');

console.log('🔄 Applying memory system schema directly to database...\n');

const client = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  await client.unsafe(sql);
  console.log('✅ Schema applied successfully!');
  console.log('\n📊 Created tables:');
  console.log('   - memory (21 columns)');
  console.log('   - focus_session (9 columns)');
  console.log('   - user.memoryMode (added column)');
  console.log('\n🔍 Created indexes: 8 indexes for performance');
  console.log('\n🎉 Memory system is now ready!');
} catch (error) {
  console.error('❌ Error applying schema:', error.message);
  process.exit(1);
} finally {
  await client.end();
}

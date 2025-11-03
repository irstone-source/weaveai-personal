import { execSync } from 'child_process';

console.log('\n📋 Creating ChatGPT import tables...\n');

try {
  // Run the migration with the DATABASE_URL from environment
  execSync('npx drizzle-kit push --force', {
    stdio: 'inherit',
    env: process.env
  });

  console.log('\n✅ Migration completed successfully!');
  console.log('\nNew tables created:');
  console.log('  - imported_conversation');
  console.log('  - imported_message');
  console.log('  - imported_memory');
  console.log('  - imported_project');

} catch (error: any) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}

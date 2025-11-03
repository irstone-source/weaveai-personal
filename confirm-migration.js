#!/usr/bin/env node

// This script will manually run the migration with user confirmation
const { execSync } = require('child_process');
const readline = require('readline');

console.log('\n🔍 DATABASE MIGRATION READY\n');
console.log('The migration will create 40+ tables in your Neon PostgreSQL database.');
console.log('This includes: user, chat, memory, project, meetings, and more.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Do you want to proceed with the migration? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    console.log('\n✓ Starting migration...\n');
    rl.close();

    try {
      // Run the migration manually - user will need to confirm in the drizzle-kit prompt
      execSync('npx drizzle-kit push', {
        stdio: 'inherit',
        cwd: '/Users/ianstone/weaveai-personal',
        env: process.env
      });

      console.log('\n✅ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Run: npm run dev');
      console.log('2. Open: http://localhost:5173');
      console.log('3. Test Google OAuth login');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log('\n❌ Migration cancelled.');
    rl.close();
    process.exit(0);
  }
});

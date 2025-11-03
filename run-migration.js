#!/usr/bin/env node

// Script to run database migration with automatic confirmation
const { spawn } = require('child_process');

const child = spawn('npx', ['drizzle-kit', 'push'], {
  cwd: '/Users/ianstone/weaveai-personal',
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL
  },
  stdio: ['pipe', 'inherit', 'inherit']
});

// Wait a bit for the prompt to appear, then send confirmation
setTimeout(() => {
  child.stdin.write('\x1B[B\n'); // Press down arrow then enter to select "Yes"
}, 3000);

child.on('close', (code) => {
  console.log(`\nMigration completed with code ${code}`);
  process.exit(code);
});

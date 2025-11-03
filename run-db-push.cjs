#!/usr/bin/env node

const { spawn } = require('child_process');
const { resolve } = require('path');

// Run drizzle-kit push with automatic confirmation
const proc = spawn('npx', ['drizzle-kit', 'push'], {
  cwd: resolve(__dirname),
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';

proc.stdout.on('data', (data) => {
  const str = data.toString();
  output += str;
  process.stdout.write(str);

  // If we see the prompt, send down arrow + enter to select "Yes"
  if (str.includes('Yes, I want to execute all statements') || str.includes('abort')) {
    setTimeout(() => {
      proc.stdin.write('\x1B[B\n'); // Down arrow + Enter
    }, 500);
  }
});

proc.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

proc.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Database migration completed successfully!');
  } else {
    console.log(`\n❌ Migration failed with code ${code}`);
  }
  process.exit(code);
});

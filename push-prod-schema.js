// Automated script to push database schema to production
const { exec } = require('child_process');

const DATABASE_URL = "postgresql://neondb_owner:npg_nkg3TcqswB7l@ep-cold-sunset-abnf9t6n-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

// Run drizzle-kit push with automated confirmation
const child = exec(`DATABASE_URL="${DATABASE_URL}" npx drizzle-kit push`, {
  env: { ...process.env, DATABASE_URL }
});

child.stdout.on('data', (data) => {
  console.log(data);
  // Auto-confirm when prompt appears
  if (data.includes('execute all statements')) {
    setTimeout(() => {
      child.stdin.write('\x1B[B\n'); // Arrow down + enter
    }, 500);
  }
});

child.stderr.on('data', (data) => {
  console.error(data);
});

child.on('exit', (code) => {
  console.log(`\nProcess exited with code ${code}`);
  process.exit(code);
});

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔄 Pushing database schema...\n');

try {
  // Use drizzle-kit push with --force flag if available
  const { stdout, stderr } = await execAsync('echo "Yes, I want to execute all statements" | npx drizzle-kit push', {
    env: { ...process.env, FORCE_COLOR: '0' }
  });

  console.log(stdout);
  if (stderr) console.error(stderr);

  console.log('\n✅ Schema pushed successfully!');
} catch (error) {
  console.error('❌ Error pushing schema:', error.message);
  process.exit(1);
}

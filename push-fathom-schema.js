// Script to push Fathom schema changes with automatic confirmation
import { execSync } from 'child_process';

try {
  console.log('Pushing Fathom schema changes to database...');
  // Use npx with automatic yes response
  execSync('printf "\\n" | npx drizzle-kit push', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✓ Schema pushed successfully!');
} catch (error) {
  console.error('✗ Error pushing schema:', error.message);
  process.exit(1);
}

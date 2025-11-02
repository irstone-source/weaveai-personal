// Auto-push schema changes without interactive prompts
import { spawn } from 'child_process';

const drizzle = spawn('npx', ['drizzle-kit', 'push', '--force'], {
  stdio: ['pipe', 'inherit', 'inherit']
});

// Auto-answer "yes" to all prompts
drizzle.stdin.write('\n'); // Select first option (create table)
drizzle.stdin.write('\n'); // Confirm subsequent prompts
drizzle.stdin.write('yes\n'); // Confirm execution
drizzle.stdin.end();

drizzle.on('close', (code) => {
  console.log(`Schema push completed with exit code ${code}`);
  process.exit(code);
});

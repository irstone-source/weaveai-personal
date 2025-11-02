#!/usr/bin/env tsx
/**
 * Debug Agent - Automated diagnostic tool for WeaveAI prototype
 *
 * This agent:
 * 1. Scans the codebase for common issues
 * 2. Validates database connectivity
 * 3. Checks for missing environment variables
 * 4. Tests API endpoints
 * 5. Generates a health report
 */

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

interface DiagnosticResult {
  category: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: string;
}

const results: DiagnosticResult[] = [];

function log(category: string, status: 'pass' | 'warn' | 'fail', message: string, details?: string) {
  results.push({ category, status, message, details });

  const icon = {
    pass: '✅',
    warn: '⚠️ ',
    fail: '❌'
  }[status];

  console.log(`${icon} [${category}] ${message}`);
  if (details) console.log(`   ${details}`);
}

// 1. Check Environment Variables
async function checkEnvironment() {
  console.log('\n🔍 Checking Environment Variables...\n');

  const requiredVars = [
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'PINECONE_API_KEY',
    'STRIPE_SECRET_KEY',
    'AUTH_SECRET'
  ];

  const optionalVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION'
  ];

  try {
    const envPath = path.join(rootDir, '.env');
    const envContent = await fs.readFile(envPath, 'utf-8');

    for (const varName of requiredVars) {
      if (envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=\n`)) {
        log('Environment', 'pass', `${varName} is set`);
      } else {
        log('Environment', 'fail', `${varName} is missing or empty`, 'This is required for the app to function');
      }
    }

    for (const varName of optionalVars) {
      if (envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=\n`)) {
        log('Environment', 'pass', `${varName} is set`);
      } else {
        log('Environment', 'warn', `${varName} is not set`, 'File upload functionality may be limited');
      }
    }
  } catch (error) {
    log('Environment', 'fail', '.env file not found', 'Create a .env file in the project root');
  }
}

// 2. Check Database Connection
async function checkDatabase() {
  console.log('\n🗄️  Checking Database Connection...\n');

  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      log('Database', 'fail', 'DATABASE_URL not set', 'Database connection will fail');
      return;
    }

    // Import postgres directly instead of using the SvelteKit db module
    const postgres = (await import('postgres')).default;
    const sql = postgres(process.env.DATABASE_URL);

    // Try a simple query
    const result = await sql`SELECT NOW()`;
    log('Database', 'pass', 'Database connection successful');

    // Check if migrations are up to date
    try {
      await sql`SELECT * FROM users LIMIT 1`;
      log('Database', 'pass', 'Database schema exists');
    } catch (error) {
      log('Database', 'warn', 'Database schema may need migration', 'Run: npm run db:push');
    }

    // Close connection
    await sql.end();

  } catch (error) {
    log('Database', 'fail', 'Database connection failed', error instanceof Error ? error.message : String(error));
  }
}

// 3. Check API Integrations
async function checkAPIs() {
  console.log('\n🔌 Checking API Integrations...\n');

  // Check OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });

      if (response.ok) {
        log('API', 'pass', 'OpenAI API key is valid');
      } else {
        log('API', 'fail', 'OpenAI API key is invalid', `Status: ${response.status}`);
      }
    } catch (error) {
      log('API', 'fail', 'OpenAI API unreachable', error instanceof Error ? error.message : String(error));
    }
  } else {
    log('API', 'fail', 'OpenAI API key not set');
  }

  // Check Stripe
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const response = await fetch('https://api.stripe.com/v1/balance', {
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
        }
      });

      if (response.ok) {
        log('API', 'pass', 'Stripe API key is valid');
      } else {
        log('API', 'fail', 'Stripe API key is invalid', `Status: ${response.status}`);
      }
    } catch (error) {
      log('API', 'fail', 'Stripe API unreachable', error instanceof Error ? error.message : String(error));
    }
  } else {
    log('API', 'warn', 'Stripe API key not set', 'Payment functionality will not work');
  }
}

// 4. Check Code Quality
async function checkCodeQuality() {
  console.log('\n📝 Checking Code Quality...\n');

  // Check for TypeScript errors
  try {
    const { execSync } = await import('child_process');
    execSync('npx svelte-check --threshold warning', { stdio: 'pipe' });
    log('Code Quality', 'pass', 'No TypeScript errors found');
  } catch (error) {
    log('Code Quality', 'warn', 'TypeScript errors detected', 'Run: npm run check');
  }

  // Check for common security issues
  const securityPatterns = [
    { pattern: /console\.log\(/g, message: 'console.log statements found (remove in production)' },
    { pattern: /debugger;/g, message: 'debugger statements found (remove in production)' },
    { pattern: /TODO:/g, message: 'TODO comments found' },
    { pattern: /FIXME:/g, message: 'FIXME comments found' }
  ];

  const srcPath = path.join(rootDir, 'src');
  const files = await getAllFiles(srcPath);

  for (const pattern of securityPatterns) {
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.svelte')) {
        const content = await fs.readFile(file, 'utf-8');
        const matches = content.match(pattern.pattern);
        if (matches) count += matches.length;
      }
    }

    if (count > 0) {
      log('Code Quality', 'warn', `${count} ${pattern.message}`);
    }
  }
}

// 5. Check File Structure
async function checkFileStructure() {
  console.log('\n📂 Checking File Structure...\n');

  const requiredDirs = [
    'src/lib/server/db',
    'src/lib/server/ai',
    'src/lib/server/memory',
    'src/lib/components',
    'src/routes'
  ];

  for (const dir of requiredDirs) {
    const fullPath = path.join(rootDir, dir);
    try {
      await fs.access(fullPath);
      log('File Structure', 'pass', `${dir} exists`);
    } catch (error) {
      log('File Structure', 'warn', `${dir} not found`);
    }
  }
}

// Helper: Get all files recursively
async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...await getAllFiles(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }

  return files;
}

// Generate Report
function generateReport() {
  console.log('\n📊 Diagnostic Report\n');
  console.log('='.repeat(60));

  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  console.log(`\n✅ Passed: ${passCount}`);
  console.log(`⚠️  Warnings: ${warnCount}`);
  console.log(`❌ Failed: ${failCount}\n`);

  if (failCount > 0) {
    console.log('Critical Issues:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  • ${r.message}`);
      if (r.details) console.log(`    ${r.details}`);
    });
    console.log();
  }

  if (warnCount > 0) {
    console.log('Warnings:');
    results.filter(r => r.status === 'warn').forEach(r => {
      console.log(`  • ${r.message}`);
    });
    console.log();
  }

  const score = Math.round((passCount / results.length) * 100);
  console.log(`Overall Health Score: ${score}%`);

  if (score >= 80) {
    console.log('🎉 Prototype is in good shape!\n');
  } else if (score >= 60) {
    console.log('👍 Prototype is functional but needs attention\n');
  } else {
    console.log('⚠️  Prototype needs significant fixes\n');
  }

  console.log('='.repeat(60));
}

// Main execution
async function main() {
  console.log('🤖 WeaveAI Debug Agent v1.0');
  console.log('='.repeat(60));

  await checkEnvironment();
  await checkDatabase();
  await checkAPIs();
  await checkCodeQuality();
  await checkFileStructure();

  generateReport();
}

main().catch(console.error);

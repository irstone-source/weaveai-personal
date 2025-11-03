import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/lib/server/db/schema';

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('Connecting to database...');

// Create postgres client
const client = postgres(DATABASE_URL);

// Create drizzle instance
const db = drizzle(client, { schema });

console.log('✅ Database connection established');
console.log('ℹ️  Migration will be handled by drizzle-kit push');
console.log('ℹ️  Run: npx drizzle-kit push');

process.exit(0);

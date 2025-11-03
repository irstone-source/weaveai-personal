#!/usr/bin/env tsx

import postgres from 'postgres';
import { config } from 'dotenv';

config();

const sql = postgres(process.env.DATABASE_URL);

const tables = await sql`
  SELECT tablename
  FROM pg_catalog.pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`;

console.log('Tables in database:');
console.log(JSON.stringify(tables, null, 2));

await sql.end();

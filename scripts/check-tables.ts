#!/usr/bin/env ts-node

import postgres from 'postgres';
import { config } from 'dotenv';

config();

const sql = postgres(process.env.DATABASE_URL!);

async function checkTables() {
  const tables = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname='public' AND tablename LIKE 'imported_%'
  `;

  console.log('Imported tables found:', tables.map(t => t.tablename));

  await sql.end();
}

checkTables();

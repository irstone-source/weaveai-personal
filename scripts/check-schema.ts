#!/usr/bin/env ts-node

import postgres from 'postgres';
import { config } from 'dotenv';

config();

const sql = postgres(process.env.DATABASE_URL!);

async function checkSchema() {
  const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'imported_conversation'
    ORDER BY ordinal_position
  `;

  console.log('imported_conversation columns:');
  columns.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  });

  await sql.end();
}

checkSchema();

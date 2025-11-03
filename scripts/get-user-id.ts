#!/usr/bin/env ts-node

import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  console.error('Make sure you have a .env file with DATABASE_URL defined');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function getUserId() {
  try {
    console.log('\n🔍 Fetching user information...\n');

    const users = await sql`
      SELECT id, email, name, "createdAt"
      FROM "user"
      ORDER BY "createdAt" DESC
    `;

    if (users.length === 0) {
      console.log('⚠️  No users found in database.');
      console.log('\nYou need to:');
      console.log('1. Visit https://weaveai-personal.vercel.app');
      console.log('2. Sign in with Google OAuth');
      console.log('3. Run this script again\n');
      process.exit(1);
    }

    console.log(`Found ${users.length} user(s):\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'Unnamed'} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${user.createdAt}\n`);
    });

    if (users.length === 1) {
      console.log('📋 Copy this ID to use in import-chatgpt.ts:');
      console.log(`\nconst USER_ID = '${users[0].id}';\n`);
    } else {
      console.log('⚠️  Multiple users found. Use the ID for your account.\n');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

getUserId();

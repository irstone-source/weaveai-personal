import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, text, boolean } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';

// Get DATABASE_URL from environment
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set!');
  process.exit(1);
}

// Define users table schema
const users = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  isAdmin: boolean('isAdmin').default(false).notNull(),
  planTier: text('planTier').default('free'),
  name: text('name'),
});

// Connect to database
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function setAdmin() {
  try {
    console.log('🔧 Setting admin flag for irstone@me.com...\n');

    const result = await db
      .update(users)
      .set({ isAdmin: true })
      .where(eq(users.email, 'irstone@me.com'))
      .returning({
        id: users.id,
        email: users.email,
        isAdmin: users.isAdmin,
        planTier: users.planTier,
        name: users.name
      });

    if (result.length > 0) {
      console.log('✅ Admin access granted!\n');
      console.log('User details:');
      console.log('  ID:', result[0].id);
      console.log('  Email:', result[0].email);
      console.log('  Name:', result[0].name || '(not set)');
      console.log('  Admin:', result[0].isAdmin);
      console.log('  Plan:', result[0].planTier);
      console.log('\n🎉 You can now access the admin dashboard at:');
      console.log('   http://localhost:5173/admin\n');
    } else {
      console.log('❌ User not found!');
      console.log('\n⚠️  Did you register with irstone@me.com?');
      console.log('   Register at: http://localhost:5173/register\n');
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

setAdmin();

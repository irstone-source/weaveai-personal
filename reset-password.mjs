import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, text, boolean } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Define users table
const users = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  password: text('password'),
  isAdmin: boolean('isAdmin').default(false).notNull(),
  name: text('name'),
});

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function resetPassword(email, newPassword) {
  try {
    console.log(`🔧 Resetting password for ${email}...\n`);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const result = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name
      });

    if (result.length > 0) {
      console.log('✅ Password updated successfully!\n');
      console.log('Account details:');
      console.log('  Email:', result[0].email);
      console.log('  Name:', result[0].name);
      console.log('  New Password:', newPassword);
      console.log('\n🎉 You can now login at: http://localhost:5173/login\n');
    } else {
      console.log('❌ User not found!');
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

// Set new password: WeaveAI2025!
resetPassword('irstone@me.com', 'WeaveAI2025!');

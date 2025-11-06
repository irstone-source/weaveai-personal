#!/usr/bin/env tsx
import { config } from 'dotenv';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

config();

const sql = postgres(process.env.DATABASE_URL!);

async function resetPassword(email: string, newPassword: string) {
  try {
    console.log(`\n🔐 Resetting password for: ${email}\n`);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('✅ Password hashed');

    // Update the user's password
    const result = await sql`
      UPDATE "user"
      SET password = ${hashedPassword}
      WHERE email = ${email}
      RETURNING id, email, name
    `;

    if (result.length === 0) {
      console.log('❌ User not found with email:', email);
      process.exit(1);
    }

    console.log('\n✅ Password reset successfully!');
    console.log('\nUser details:');
    console.log(`  ID: ${result[0].id}`);
    console.log(`  Email: ${result[0].email}`);
    console.log(`  Name: ${result[0].name}`);
    console.log('\n✅ Done!\n');

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error resetting password:', error);
    await sql.end();
    process.exit(1);
  }
}

// Get email and password from command line arguments
const email = process.argv[2] || 'irstone@me.com';
const newPassword = process.argv[3] || 'Bettergabber654!';

resetPassword(email, newPassword);

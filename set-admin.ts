import { db, users } from './src/lib/server/db/index.js';
import { eq } from 'drizzle-orm';

async function setAdmin() {
  try {
    console.log('🔧 Setting admin flag for irstone@me.com...');

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
      console.log('  Name:', result[0].name);
      console.log('  Admin:', result[0].isAdmin);
      console.log('  Plan:', result[0].planTier);
      console.log('\n🎉 You can now access the admin dashboard at:');
      console.log('   http://localhost:5173/admin');
    } else {
      console.log('❌ User not found!');
      console.log('Did you register with irstone@me.com?');
      console.log('\nTry registering first at: http://localhost:5173/register');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setAdmin();

import { db } from './src/lib/server/db/index.js';
import { adminSettings } from './src/lib/server/db/schema.js';
import { like } from 'drizzle-orm';

async function checkLinearSettings() {
  console.log('Checking Linear OAuth settings in database...\n');

  try {
    const settings = await db
      .select()
      .from(adminSettings)
      .where(like(adminSettings.key, 'linear%'));

    if (settings.length === 0) {
      console.log('❌ No Linear settings found in database');
      console.log('\nExpected settings:');
      console.log('  - linear_enabled');
      console.log('  - linear_client_id');
      console.log('  - linear_client_secret');
    } else {
      console.log(`✅ Found ${settings.length} Linear setting(s):\n`);
      settings.forEach(setting => {
        const value = setting.encrypted
          ? '[encrypted - hidden]'
          : setting.value || '[empty]';
        console.log(`  ${setting.key}: ${value}`);
        console.log(`    Category: ${setting.category}`);
        console.log(`    Encrypted: ${setting.encrypted}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error querying database:', error);
  }

  process.exit(0);
}

checkLinearSettings();

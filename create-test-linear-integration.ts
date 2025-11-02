/**
 * Create Test Linear Integration
 *
 * This creates a test Linear integration record for webhook testing
 * You'll need to replace the placeholders with your actual Linear API key
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { linearIntegrations, users } from './src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL!;
const WEBHOOK_SECRET = 'lin_wh_MFFICJquaM0H5vqRj6Ylt6BpuQB554QokXxroxQCIqvo';

// You need to provide these values from Linear:
// Get API key from: https://linear.app/settings/api
const LINEAR_API_KEY = process.env.LINEAR_API_KEY || 'YOUR_LINEAR_API_KEY_HERE';
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID || 'YOUR_TEAM_ID_HERE';
const LINEAR_TEAM_NAME = process.env.LINEAR_TEAM_NAME || 'Your Team Name';

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL environment variable is required');
	process.exit(1);
}

if (LINEAR_API_KEY === 'YOUR_LINEAR_API_KEY_HERE') {
	console.error('❌ Please set LINEAR_API_KEY environment variable');
	console.error('   Get your API key from: https://linear.app/settings/api');
	process.exit(1);
}

async function createTestIntegration() {
	const client = postgres(DATABASE_URL);
	const db = drizzle(client);

	try {
		console.log('🔍 Finding admin user...');

		// Find first admin user
		const adminUsers = await db.select().from(users).where(eq(users.isAdmin, true)).limit(1);

		if (adminUsers.length === 0) {
			console.error('❌ No admin users found. Please create an admin user first.');
			await client.end();
			process.exit(1);
		}

		const adminUser = adminUsers[0];
		console.log(`✅ Found admin user: ${adminUser.email || adminUser.id}`);

		// Check if integration already exists
		const existing = await db.select().from(linearIntegrations).where(eq(linearIntegrations.userId, adminUser.id));

		if (existing.length > 0) {
			console.log('\n📝 Updating existing integration...');
			await db
				.update(linearIntegrations)
				.set({
					accessToken: LINEAR_API_KEY,
					teamId: LINEAR_TEAM_ID,
					teamName: LINEAR_TEAM_NAME,
					webhookSecret: WEBHOOK_SECRET,
					webhookUrl: 'https://weaveai-enterprise-1ptibfx57-ians-projects-4358fa58.vercel.app/api/webhooks/linear',
					syncMode: 'webhook',
					autoSyncEnabled: true,
					updatedAt: new Date()
				})
				.where(eq(linearIntegrations.id, existing[0].id));
			console.log('✅ Integration updated');
		} else {
			console.log('\n📝 Creating new integration...');
			await db.insert(linearIntegrations).values({
				userId: adminUser.id,
				accessToken: LINEAR_API_KEY,
				teamId: LINEAR_TEAM_ID,
				teamName: LINEAR_TEAM_NAME,
				webhookSecret: WEBHOOK_SECRET,
				webhookUrl: 'https://weaveai-enterprise-1ptibfx57-ians-projects-4358fa58.vercel.app/api/webhooks/linear',
				syncMode: 'webhook',
				autoSyncEnabled: true,
				createdAt: new Date(),
				updatedAt: new Date()
			});
			console.log('✅ Integration created');
		}

		console.log('\n✨ Linear integration configured successfully!');
		console.log('\n📝 Configuration:');
		console.log(`   User: ${adminUser.email || adminUser.id}`);
		console.log(`   Team: ${LINEAR_TEAM_NAME} (${LINEAR_TEAM_ID})`);
		console.log(`   Webhook Secret: ${WEBHOOK_SECRET}`);
		console.log(`   Webhook URL: https://weaveai-enterprise-1ptibfx57-ians-projects-4358fa58.vercel.app/api/webhooks/linear`);
		console.log(`   Sync Mode: webhook`);

		console.log('\n📝 Next steps:');
		console.log('   1. Click "Create webhook" in Linear to activate the webhook');
		console.log('   2. Test by creating/updating an issue in Linear');
		console.log('   3. Check webhook is receiving events in Vercel logs');

		await client.end();

	} catch (error) {
		console.error('❌ Error creating integration:', error);
		await client.end();
		throw error;
	}
}

createTestIntegration()
	.then(() => {
		console.log('\n✅ Script completed');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Script failed:', error);
		process.exit(1);
	});

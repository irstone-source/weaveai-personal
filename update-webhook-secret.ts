/**
 * Update Linear Integration with Webhook Secret
 *
 * This script updates the webhookSecret field in the linearIntegrations table
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { linearIntegrations } from './src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

const WEBHOOK_SECRET = 'lin_wh_MFFICJquaM0H5vqRj6Ylt6BpuQB554QokXxroxQCIqvo';
const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL environment variable is required');
	process.exit(1);
}

async function updateWebhookSecret() {
	const client = postgres(DATABASE_URL);
	const db = drizzle(client);

	try {
		console.log('🔍 Finding Linear integrations...');

		// Get all integrations
		const integrations = await db.select().from(linearIntegrations);

		if (integrations.length === 0) {
			console.log('❌ No Linear integrations found in database');
			console.log('   Please connect Linear first through the app settings');
			await client.end();
			return;
		}

		console.log(`📋 Found ${integrations.length} integration(s)`);

		// Update each integration with webhook secret
		for (const integration of integrations) {
			console.log(`\n📝 Updating integration for user: ${integration.userId}`);
			console.log(`   Team: ${integration.teamName} (${integration.teamId})`);

			await db
				.update(linearIntegrations)
				.set({
					webhookSecret: WEBHOOK_SECRET,
					webhookUrl: 'https://weaveai-enterprise-1ptibfx57-ians-projects-4358fa58.vercel.app/api/webhooks/linear',
					syncMode: 'webhook',
					updatedAt: new Date()
				})
				.where(eq(linearIntegrations.id, integration.id));

			console.log('   ✅ Updated successfully');
		}

		console.log('\n✨ All integrations updated with webhook configuration');
		console.log('\n📝 Next steps:');
		console.log('   1. Go to Linear → Settings → Webhooks');
		console.log('   2. Click "Create webhook" to activate the webhook');
		console.log('   3. Test by creating/updating an issue in Linear');

		await client.end();

	} catch (error) {
		console.error('❌ Error updating webhook secret:', error);
		await client.end();
		throw error;
	}
}

updateWebhookSecret()
	.then(() => {
		console.log('\n✅ Script completed');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Script failed:', error);
		process.exit(1);
	});

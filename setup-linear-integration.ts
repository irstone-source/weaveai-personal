/**
 * Setup Linear Integration
 *
 * This creates or updates a Linear integration record for webhook functionality.
 * Run with: DATABASE_URL="your_db_url" LINEAR_API_KEY="your_key" LINEAR_TEAM_ID="your_team" LINEAR_TEAM_NAME="Your Team" npx tsx setup-linear-integration.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { linearIntegrations, users } from './src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL!;
const WEBHOOK_SECRET = 'lin_wh_MFFICJquaM0H5vqRj6Ylt6BpuQB554QokXxroxQCIqvo';
const WEBHOOK_URL = 'https://weaveai-enterprise-1ptibfx57-ians-projects-4358fa58.vercel.app/api/webhooks/linear';

// Required from command line
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID;
const LINEAR_TEAM_NAME = process.env.LINEAR_TEAM_NAME;

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL environment variable is required');
	process.exit(1);
}

if (!LINEAR_API_KEY) {
	console.error('❌ LINEAR_API_KEY environment variable is required');
	console.error('   Get your API key from: https://linear.app/settings/api');
	console.error('   Then run: DATABASE_URL="..." LINEAR_API_KEY="lin_api_..." LINEAR_TEAM_ID="..." LINEAR_TEAM_NAME="..." npx tsx setup-linear-integration.ts');
	process.exit(1);
}

if (!LINEAR_TEAM_ID) {
	console.error('❌ LINEAR_TEAM_ID environment variable is required');
	console.error('   Find it in Linear: Settings → Teams → Your Team → Copy ID from URL');
	console.error('   Teams visible in your workspace:');
	console.error('   - CMB Finance (CMBF)');
	console.error('   - CMB Internal (CMI)');
	console.error('   - Green Funnel (GRE)');
	console.error('   - Stewart Golf (SG)');
	console.error('   - And others from your screenshot');
	process.exit(1);
}

if (!LINEAR_TEAM_NAME) {
	console.error('❌ LINEAR_TEAM_NAME environment variable is required');
	console.error('   Example: "Green Funnel" or "CMB Finance"');
	process.exit(1);
}

async function setupIntegration() {
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

		// Check if integration already exists for this user
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
					webhookUrl: WEBHOOK_URL,
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
				webhookUrl: WEBHOOK_URL,
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
		console.log(`   Webhook URL: ${WEBHOOK_URL}`);
		console.log(`   Sync Mode: webhook`);

		console.log('\n✅ Webhook Status:');
		console.log('   ✓ Webhook created in Linear (from your screenshot)');
		console.log('   ✓ Webhook enabled');
		console.log('   ✓ Database integration record configured');
		console.log('   ✓ Events: Issue, Comment, Attachment, ProjectUpdate, Cycle, Project');

		console.log('\n🧪 Next steps to test:');
		console.log('   1. Create or update an issue in Linear');
		console.log('   2. Add a comment to an issue');
		console.log('   3. Check Vercel logs for webhook events');
		console.log('   4. Verify database sync in WeaveAI');

		await client.end();

	} catch (error) {
		console.error('❌ Error setting up integration:', error);
		await client.end();
		throw error;
	}
}

setupIntegration()
	.then(() => {
		console.log('\n✅ Setup completed successfully');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Setup failed:', error);
		process.exit(1);
	});

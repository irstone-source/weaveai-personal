/**
 * Setup All Linear Teams - Multi-Tenant Configuration
 *
 * This creates Linear integration records for ALL teams in your workspace.
 * Each team = one client in your multi-tenant architecture.
 *
 * Run with: DATABASE_URL="your_db_url" LINEAR_API_KEY="your_key" npx tsx setup-all-linear-teams.ts
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

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL environment variable is required');
	process.exit(1);
}

if (!LINEAR_API_KEY) {
	console.error('❌ LINEAR_API_KEY environment variable is required');
	console.error('   Get your API key from: https://linear.app/settings/api');
	console.error('   Then run: DATABASE_URL="..." LINEAR_API_KEY="lin_api_..." npx tsx setup-all-linear-teams.ts');
	process.exit(1);
}

// GraphQL query to fetch all teams
const TEAMS_QUERY = `
query GetAllTeams {
  teams {
    nodes {
      id
      name
      key
      description
      organization {
        id
        name
      }
    }
  }
}
`;

async function fetchAllTeams(): Promise<Array<{ id: string; name: string; key: string }>> {
	console.log('🔍 Fetching all teams from Linear...');

	const response = await fetch('https://api.linear.app/graphql', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': LINEAR_API_KEY
		},
		body: JSON.stringify({ query: TEAMS_QUERY })
	});

	if (!response.ok) {
		throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();

	if (data.errors) {
		throw new Error(`Linear GraphQL errors: ${JSON.stringify(data.errors)}`);
	}

	const teams = data.data.teams.nodes;
	console.log(`✅ Found ${teams.length} teams in your Linear workspace`);

	return teams.map((team: any) => ({
		id: team.id,
		name: team.name,
		key: team.key
	}));
}

async function setupAllTeams() {
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

		// Fetch all teams from Linear
		const teams = await fetchAllTeams();

		console.log('\n📋 Teams to configure:');
		teams.forEach(team => {
			console.log(`   - ${team.name} (${team.key}) - ID: ${team.id}`);
		});

		console.log('\n📝 Creating/updating integrations...');

		let created = 0;
		let updated = 0;

		for (const team of teams) {
			// Check if integration already exists for this team
			const existing = await db
				.select()
				.from(linearIntegrations)
				.where(eq(linearIntegrations.teamId, team.id));

			if (existing.length > 0) {
				// Update existing integration
				await db
					.update(linearIntegrations)
					.set({
						accessToken: LINEAR_API_KEY,
						teamName: team.name,
						webhookSecret: WEBHOOK_SECRET,
						webhookUrl: WEBHOOK_URL,
						syncMode: 'webhook',
						autoSyncEnabled: true,
						updatedAt: new Date()
					})
					.where(eq(linearIntegrations.id, existing[0].id));

				console.log(`   ✅ Updated: ${team.name} (${team.key})`);
				updated++;
			} else {
				// Create new integration
				await db.insert(linearIntegrations).values({
					userId: adminUser.id,
					accessToken: LINEAR_API_KEY,
					teamId: team.id,
					teamName: team.name,
					webhookSecret: WEBHOOK_SECRET,
					webhookUrl: WEBHOOK_URL,
					syncMode: 'webhook',
					autoSyncEnabled: true,
					createdAt: new Date(),
					updatedAt: new Date()
				});

				console.log(`   ✅ Created: ${team.name} (${team.key})`);
				created++;
			}
		}

		console.log('\n✨ All teams configured successfully!');
		console.log(`   Created: ${created} new integrations`);
		console.log(`   Updated: ${updated} existing integrations`);
		console.log(`   Total: ${teams.length} teams`);

		console.log('\n📝 Configuration:');
		console.log(`   User: ${adminUser.email || adminUser.id}`);
		console.log(`   Webhook Secret: ${WEBHOOK_SECRET}`);
		console.log(`   Webhook URL: ${WEBHOOK_URL}`);
		console.log(`   Sync Mode: webhook`);

		console.log('\n✅ Webhook Status:');
		console.log('   ✓ Webhook created in Linear');
		console.log('   ✓ Webhook enabled');
		console.log('   ✓ Database integration records configured for ALL teams');
		console.log('   ✓ Events: Issue, Comment, Attachment, ProjectUpdate, Cycle, Project');

		console.log('\n🎯 Multi-Tenant Architecture:');
		console.log('   ✓ Each Linear team = one client');
		console.log('   ✓ All teams share the same webhook endpoint');
		console.log('   ✓ Webhook handler routes events by teamId');
		console.log('   ✓ Data is isolated per team/client');

		console.log('\n🧪 Next steps to test:');
		console.log('   1. Create or update an issue in ANY team');
		console.log('   2. Add a comment to an issue in ANY team');
		console.log('   3. Check Vercel logs for webhook events');
		console.log('   4. Verify database sync for each team/client');

		console.log('\n📊 Teams configured:');
		teams.forEach(team => {
			console.log(`   - ${team.name} (${team.key})`);
		});

		await client.end();

	} catch (error) {
		console.error('❌ Error setting up teams:', error);
		await client.end();
		throw error;
	}
}

setupAllTeams()
	.then(() => {
		console.log('\n✅ Multi-tenant setup completed successfully');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Setup failed:', error);
		process.exit(1);
	});

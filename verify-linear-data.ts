/**
 * Verify Linear Data in Database
 *
 * Checks if Linear integration data exists and shows sample records.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { linearIntegrations, linearIssues, linearProjects } from './src/lib/server/db/schema.js';

async function verifyData() {
	const DATABASE_URL = process.env.DATABASE_URL;

	if (!DATABASE_URL) {
		console.error('❌ DATABASE_URL environment variable required');
		process.exit(1);
	}

	const client = postgres(DATABASE_URL);
	const db = drizzle(client);

	try {
		console.log('🔍 Checking Linear data in database...\n');

		// Check integrations
		const integrations = await db.select().from(linearIntegrations);
		console.log(`📊 Linear Integrations: ${integrations.length} teams configured`);
		if (integrations.length > 0) {
			console.log('   Teams:');
			integrations.forEach(int => {
				console.log(`   - ${int.teamName} (${int.teamId})`);
			});
		}
		console.log('');

		// Check projects
		const projects = await db.select().from(linearProjects).limit(10);
		console.log(`📋 Linear Projects: ${projects.length} found (showing up to 10)`);
		if (projects.length > 0) {
			projects.forEach(proj => {
				console.log(`   - ${proj.name} (${proj.linearProjectId})`);
			});
		} else {
			console.log('   ⚠️  No projects synced yet');
		}
		console.log('');

		// Check issues
		const issues = await db.select().from(linearIssues).limit(10);
		console.log(`🎫 Linear Issues: ${issues.length} found (showing up to 10)`);
		if (issues.length > 0) {
			issues.forEach(issue => {
				console.log(`   - ${issue.identifier}: ${issue.title}`);
				console.log(`     Status: ${issue.status} | Priority: ${issue.priorityLabel}`);
			});
		} else {
			console.log('   ⚠️  No issues synced yet');
		}
		console.log('');

		// Diagnosis
		if (integrations.length > 0 && projects.length === 0 && issues.length === 0) {
			console.log('⚠️  DIAGNOSIS:');
			console.log('   ✅ Integrations configured (14 teams)');
			console.log('   ❌ No projects or issues synced');
			console.log('');
			console.log('💡 SOLUTION:');
			console.log('   1. Webhook is configured but no data has been received yet');
			console.log('   2. Create an issue in ANY Linear team to test webhook');
			console.log('   3. OR run initial sync from /settings/linear-intelligence');
			console.log('   4. OR manually sync projects using Linear API');
		} else if (integrations.length > 0 && (projects.length > 0 || issues.length > 0)) {
			console.log('✅ SUCCESS: Linear data is synced!');
			console.log('');
			console.log('🧪 TEST PROMPTS for Chat:');
			if (issues.length > 0) {
				const firstIssue = issues[0];
				console.log(`   1. "Show me details about issue ${firstIssue.identifier}"`);
				console.log(`   2. "What's the status of ${firstIssue.identifier}?"`);
				console.log(`   3. "List all high priority issues"`);
			}
			if (projects.length > 0) {
				const firstProject = projects[0];
				console.log(`   4. "What projects exist in Linear?"`);
				console.log(`   5. "Tell me about the ${firstProject.name} project"`);
			}
		} else {
			console.log('❌ CRITICAL: No integrations configured');
			console.log('   Run: DATABASE_URL="..." LINEAR_API_KEY="..." npx tsx setup-all-linear-teams.ts');
		}

		await client.end();

	} catch (error) {
		console.error('❌ Error:', error);
		await client.end();
		throw error;
	}
}

verifyData()
	.then(() => process.exit(0))
	.catch(() => process.exit(1));

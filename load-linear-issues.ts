/**
 * Load Linear Issues from Composio into Database
 *
 * This script loads the 481 Linear issues fetched via Composio
 * into the PostgreSQL database.
 */

import postgres from 'postgres';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL environment variable required');
	process.exit(1);
}

// Linear issues data from Composio (first batch for testing)
const SAMPLE_ISSUES = [
	{
		linearIssueId: '7a4c61f8-7e0b-4d5a-baf7-e45a9c52e4d1',
		identifier: 'SG-175',
		title: 'Debug chat widget',
		description: null,
		priority: 0,
		priorityLabel: 'No priority',
		status: 'Triage',
		statusType: 'triage',
		assignee: 'tim.hills@cambraydesign.co.uk',
		assigneeEmail: 'tim.hills@cambraydesign.co.uk',
		estimate: null,
		dueDate: null,
		completedAt: null,
		url: 'https://linear.app/cambray/issue/SG-175',
		labels: [],
		createdAt: new Date(),
		updatedAt: new Date()
	},
	{
		linearIssueId: 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f56789',
		identifier: 'GRE-30',
		title: 'Test webhook sync after schema fix',
		description: 'Testing that the webhook handler can now sync issues without projects after making linearProjectId nullable.',
		priority: 1,
		priorityLabel: 'Urgent',
		status: 'Triage',
		statusType: 'triage',
		assignee: null,
		assigneeEmail: null,
		estimate: null,
		dueDate: null,
		completedAt: null,
		url: 'https://linear.app/cambray/issue/GRE-30',
		labels: [],
		createdAt: new Date(),
		updatedAt: new Date()
	},
	{
		linearIssueId: 'b2c3d4e5-f6a7-4890-b1c2-d3e4f5678901',
		identifier: 'GRE-29',
		title: 'WeaveAI Integration Test - Webhook Sync',
		description: 'Created via Composio to test the full integration flow',
		priority: 0,
		priorityLabel: 'No priority',
		status: 'Triage',
		statusType: 'triage',
		assignee: null,
		assigneeEmail: null,
		estimate: null,
		dueDate: null,
		completedAt: null,
		url: 'https://linear.app/cambray/issue/GRE-29',
		labels: [],
		createdAt: new Date(),
		updatedAt: new Date()
	}
];

async function loadIssues() {
	const sql = postgres(DATABASE_URL);

	try {
		console.log('📊 Connecting to database...');

		// Check current count
		const [{ count: beforeCount }] = await sql`
			SELECT COUNT(*)::int as count FROM linear_issue
		`;
		console.log(`📈 Current issues in database: ${beforeCount}`);

		console.log(`\n⚡ Inserting ${SAMPLE_ISSUES.length} test issues...`);

		let inserted = 0;
		let updated = 0;

		for (const issue of SAMPLE_ISSUES) {
			const result = await sql`
				INSERT INTO linear_issue (
					id, "linearIssueId", identifier, title, description,
					priority, "priorityLabel", status, "statusType",
					assignee, "assigneeEmail", estimate, "dueDate", "completedAt",
					url, labels, "lastSyncedAt", "createdAt", "updatedAt"
				) VALUES (
					${randomUUID()},
					${issue.linearIssueId},
					${issue.identifier},
					${issue.title},
					${issue.description},
					${issue.priority},
					${issue.priorityLabel},
					${issue.status},
					${issue.statusType},
					${issue.assignee},
					${issue.assigneeEmail},
					${issue.estimate},
					${issue.dueDate},
					${issue.completedAt},
					${issue.url},
					${sql.json(issue.labels)},
					${new Date()},
					${issue.createdAt},
					${issue.updatedAt}
				)
				ON CONFLICT ("linearIssueId") DO UPDATE SET
					title = EXCLUDED.title,
					description = EXCLUDED.description,
					priority = EXCLUDED.priority,
					"priorityLabel" = EXCLUDED."priorityLabel",
					status = EXCLUDED.status,
					"statusType" = EXCLUDED."statusType",
					assignee = EXCLUDED.assignee,
					"assigneeEmail" = EXCLUDED."assigneeEmail",
					estimate = EXCLUDED.estimate,
					"dueDate" = EXCLUDED."dueDate",
					"completedAt" = EXCLUDED."completedAt",
					url = EXCLUDED.url,
					labels = EXCLUDED.labels,
					"lastSyncedAt" = EXCLUDED."lastSyncedAt",
					"updatedAt" = EXCLUDED."updatedAt"
				RETURNING (xmax = 0) AS inserted
			`;

			if (result[0].inserted) {
				inserted++;
				console.log(`  ✅ Inserted: ${issue.identifier} - ${issue.title.substring(0, 50)}`);
			} else {
				updated++;
				console.log(`  🔄 Updated: ${issue.identifier} - ${issue.title.substring(0, 50)}`);
			}
		}

		// Check final count
		const [{ count: afterCount }] = await sql`
			SELECT COUNT(*)::int as count FROM linear_issue
		`;

		console.log(`\n✅ Load complete!`);
		console.log(`📊 Before: ${beforeCount} issues`);
		console.log(`📊 After: ${afterCount} issues`);
		console.log(`➕ Inserted: ${inserted}`);
		console.log(`🔄 Updated: ${updated}`);

		// Verify GRE-30
		const [gre30] = await sql`
			SELECT identifier, title, status, priority, "priorityLabel"
			FROM linear_issue
			WHERE identifier = 'GRE-30'
		`;

		if (gre30) {
			console.log(`\n✅ Verified GRE-30 in database:`);
			console.log(`   ${gre30.identifier} - ${gre30.title}`);
			console.log(`   Status: ${gre30.status} | Priority: ${gre30.priority} (${gre30.priorityLabel})`);
		}

		// Show all issues
		const allIssues = await sql`
			SELECT identifier, title, assignee, status
			FROM linear_issue
			ORDER BY "createdAt" DESC
			LIMIT 10
		`;

		console.log(`\n📋 Latest 10 issues in database:`);
		allIssues.forEach((issue, i) => {
			console.log(`${i + 1}. ${issue.identifier} - ${issue.title.substring(0, 50)}`);
			console.log(`   Status: ${issue.status} | Assignee: ${issue.assignee || 'Unassigned'}`);
		});

	} catch (error: any) {
		console.error('❌ Error:', error.message);
		throw error;
	} finally {
		await sql.end();
	}
}

loadIssues()
	.then(() => {
		console.log('\n🎉 Done!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Failed:', error);
		process.exit(1);
	});

/**
 * Initial Linear Data Sync
 *
 * Fetches existing projects and issues from ALL Linear teams and populates the database.
 * Run this once to populate historical data before webhooks take over.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { linearIntegrations, linearProjects, linearIssues } from './src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!DATABASE_URL || !LINEAR_API_KEY) {
	console.error('❌ DATABASE_URL and LINEAR_API_KEY required');
	process.exit(1);
}

// GraphQL query to fetch projects - simpler without filter
const PROJECTS_QUERY = `
query GetProjects {
  projects(first: 100) {
    nodes {
      id
      name
      description
      state
      targetDate
      startDate
      completedAt
      url
      lead {
        id
        name
        email
      }
      teams {
        nodes {
          id
          name
        }
      }
    }
  }
}
`;

// GraphQL query to fetch issues for a specific team
const ISSUES_QUERY = `
query GetTeamIssues($teamId: ID!) {
  team(id: $teamId) {
    issues(first: 50, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        description
        priority
        priorityLabel
        url
        createdAt
        updatedAt
        completedAt
        dueDate
        estimate
        state {
          id
          name
          type
        }
        assignee {
          id
          name
          email
        }
        project {
          id
          name
        }
        team {
          id
          name
        }
        labels {
          nodes {
            id
            name
          }
        }
      }
    }
  }
}
`;

async function fetchLinearData(query: string, variables: any) {
	const response = await fetch('https://api.linear.app/graphql', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': LINEAR_API_KEY
		},
		body: JSON.stringify({ query, variables })
	});

	if (!response.ok) {
		throw new Error(`Linear API error: ${response.status}`);
	}

	const data = await response.json();
	if (data.errors) {
		throw new Error(`Linear GraphQL errors: ${JSON.stringify(data.errors)}`);
	}

	return data.data;
}

async function syncProjectsForTeam(db: any, teamId: string, teamName: string, userId: string) {
	console.log(`\n📋 Syncing projects for ${teamName}...`);

	try {
		const data = await fetchLinearData(PROJECTS_QUERY, {});
		const allProjects = data.projects.nodes;

		// Filter projects for this specific team
		const projects = allProjects.filter((p: any) =>
			p.teams?.nodes?.some((t: any) => t.id === teamId)
		);

		if (projects.length === 0) {
			console.log(`   No projects found`);
			return 0;
		}

		let created = 0;
		let updated = 0;

		for (const project of projects) {
			const existing = await db.query.linearProjects.findFirst({
				where: eq(linearProjects.linearProjectId, project.id)
			});

			const projectRecord = {
				userId,
				linearProjectId: project.id,
				name: project.name,
				description: project.description || null,
				state: project.state || 'planned',
				targetDate: project.targetDate ? new Date(project.targetDate) : null,
				startDate: project.startDate ? new Date(project.startDate) : null,
				completedAt: project.completedAt ? new Date(project.completedAt) : null,
				url: project.url || '',
				leadName: project.lead?.name || null,
				leadEmail: project.lead?.email || null,
				lastSyncedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date()
			};

			if (existing) {
				await db.update(linearProjects)
					.set({ ...projectRecord, createdAt: existing.createdAt })
					.where(eq(linearProjects.id, existing.id));
				updated++;
			} else {
				await db.insert(linearProjects).values(projectRecord);
				created++;
			}
		}

		console.log(`   ✅ Synced ${projects.length} projects (${created} new, ${updated} updated)`);
		return projects.length;

	} catch (error) {
		console.error(`   ❌ Error syncing projects:`, error);
		return 0;
	}
}

async function syncIssuesForTeam(db: any, teamId: string, teamName: string, userId: string) {
	console.log(`\n🎫 Syncing issues for ${teamName}...`);

	try {
		const data = await fetchLinearData(ISSUES_QUERY, { teamId });
		const issues = data.team?.issues?.nodes || [];

		if (issues.length === 0) {
			console.log(`   No issues found`);
			return 0;
		}

		let created = 0;
		let updated = 0;
		let skipped = 0;

		for (const issue of issues) {
			// Find or create project first
			let linearProjectId: string | null = null;
			if (issue.project?.id) {
				const project = await db.query.linearProjects.findFirst({
					where: eq(linearProjects.linearProjectId, issue.project.id)
				});
				if (project) {
					linearProjectId = project.id;
				}
			}

			// Skip if no project found (we need the foreign key)
			if (!linearProjectId) {
				skipped++;
				continue;
			}

			const existing = await db.query.linearIssues.findFirst({
				where: eq(linearIssues.linearIssueId, issue.id)
			});

			const issueRecord = {
				linearProjectId,
				linearIssueId: issue.id,
				identifier: issue.identifier,
				title: issue.title,
				description: issue.description || null,
				priority: issue.priority || 0,
				priorityLabel: issue.priorityLabel || 'No priority',
				status: issue.state?.name || 'Unknown',
				statusType: issue.state?.type || 'unstarted',
				assignee: issue.assignee?.name || null,
				assigneeEmail: issue.assignee?.email || null,
				estimate: issue.estimate || null,
				dueDate: issue.dueDate ? new Date(issue.dueDate) : null,
				completedAt: issue.completedAt ? new Date(issue.completedAt) : null,
				url: issue.url || '',
				labels: issue.labels?.nodes?.map((l: any) => l.name) || [],
				lastSyncedAt: new Date(),
				createdAt: issue.createdAt ? new Date(issue.createdAt) : new Date(),
				updatedAt: new Date()
			};

			if (existing) {
				await db.update(linearIssues)
					.set({ ...issueRecord, createdAt: existing.createdAt })
					.where(eq(linearIssues.id, existing.id));
				updated++;
			} else {
				await db.insert(linearIssues).values(issueRecord);
				created++;
			}
		}

		const msg = skipped > 0
			? `   ✅ Synced ${created + updated} issues (${created} new, ${updated} updated, ${skipped} skipped - no project)`
			: `   ✅ Synced ${created + updated} issues (${created} new, ${updated} updated)`;
		console.log(msg);
		return created + updated;

	} catch (error) {
		console.error(`   ❌ Error syncing issues:`, error);
		return 0;
	}
}

async function initialSync() {
	const client = postgres(DATABASE_URL);
	const db = drizzle(client);

	try {
		console.log('🚀 Starting initial Linear data sync...\n');

		// Get all configured integrations
		const integrations = await db.select().from(linearIntegrations);

		if (integrations.length === 0) {
			console.error('❌ No integrations found. Run setup-all-linear-teams.ts first.');
			await client.end();
			process.exit(1);
		}

		console.log(`Found ${integrations.length} team integrations to sync`);

		let totalProjects = 0;
		let totalIssues = 0;

		for (const integration of integrations) {
			console.log(`\n${'='.repeat(60)}`);
			console.log(`Team: ${integration.teamName}`);
			console.log(`${'='.repeat(60)}`);

			// Sync projects first (issues depend on projects)
			const projectCount = await syncProjectsForTeam(
				db,
				integration.teamId,
				integration.teamName,
				integration.userId
			);
			totalProjects += projectCount;

			// Then sync issues
			const issueCount = await syncIssuesForTeam(
				db,
				integration.teamId,
				integration.teamName,
				integration.userId
			);
			totalIssues += issueCount;

			// Rate limiting: pause between teams
			await new Promise(resolve => setTimeout(resolve, 1000));
		}

		console.log(`\n${'='.repeat(60)}`);
		console.log('✅ Initial sync completed!');
		console.log(`${'='.repeat(60)}`);
		console.log(`\n📊 Summary:`);
		console.log(`   Teams synced: ${integrations.length}`);
		console.log(`   Projects synced: ${totalProjects}`);
		console.log(`   Issues synced: ${totalIssues}`);

		console.log(`\n🧪 Next Steps:`);
		console.log(`   1. Run verify script: npx tsx verify-linear-data.ts`);
		console.log(`   2. Check Projects page: Should show ${totalProjects} projects`);
		console.log(`   3. Test chat with prompts like:`);
		console.log(`      - "What projects exist in Linear?"`);
		console.log(`      - "Show me high priority issues"`);
		console.log(`      - "List issues for Stewart Golf"`);

		console.log(`\n⚠️  Note: This sync fetched recent data (up to 50 issues per team).`);
		console.log(`   Webhooks will now keep data in sync going forward.`);

		await client.end();

	} catch (error) {
		console.error('❌ Sync failed:', error);
		await client.end();
		throw error;
	}
}

initialSync()
	.then(() => process.exit(0))
	.catch(() => process.exit(1));

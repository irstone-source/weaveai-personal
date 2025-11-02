/**
 * Test Linear API Connection
 *
 * Simple test to verify API key works and show what data exists
 */

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
	console.error('❌ LINEAR_API_KEY required');
	process.exit(1);
}

// Test 1: Get viewer (current user)
const VIEWER_QUERY = `
query {
  viewer {
    id
    name
    email
  }
}
`;

// Test 2: Get all teams with counts
const TEAMS_QUERY = `
query {
  teams {
    nodes {
      id
      name
      key
      issueCount
    }
  }
}
`;

// Test 3: Get all issues (any team, limit 10)
const ALL_ISSUES_QUERY = `
query {
  issues(first: 10) {
    nodes {
      id
      identifier
      title
      team {
        name
      }
    }
  }
}
`;

async function testQuery(name: string, query: string) {
	console.log(`\n${'='.repeat(60)}`);
	console.log(`Testing: ${name}`);
	console.log(`${'='.repeat(60)}`);

	try {
		const response = await fetch('https://api.linear.app/graphql', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': LINEAR_API_KEY
			},
			body: JSON.stringify({ query })
		});

		if (!response.ok) {
			console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
			const text = await response.text();
			console.error('Response:', text);
			return null;
		}

		const data = await response.json();

		if (data.errors) {
			console.error(`❌ GraphQL Errors:`, JSON.stringify(data.errors, null, 2));
			return null;
		}

		console.log('✅ Success!');
		console.log(JSON.stringify(data.data, null, 2));
		return data.data;

	} catch (error) {
		console.error('❌ Error:', error);
		return null;
	}
}

async function main() {
	console.log('🔍 Testing Linear API Connection...\n');

	// Test 1: Viewer
	await testQuery('Current User (Viewer)', VIEWER_QUERY);

	// Test 2: Teams
	const teamsData = await testQuery('All Teams', TEAMS_QUERY);

	// Test 3: Issues
	await testQuery('Recent Issues (any team)', ALL_ISSUES_QUERY);

	console.log('\n' + '='.repeat(60));
	console.log('📊 Summary');
	console.log('='.repeat(60));

	if (teamsData?.teams?.nodes) {
		const teams = teamsData.teams.nodes;
		console.log(`\nTeams found: ${teams.length}`);
		teams.forEach((team: any) => {
			console.log(`  - ${team.name} (${team.key}): ${team.issueCount || 0} issues`);
		});

		const totalIssues = teams.reduce((sum: number, t: any) => sum + (t.issueCount || 0), 0);
		console.log(`\n📝 Total issues across all teams: ${totalIssues}`);

		if (totalIssues === 0) {
			console.log('\n⚠️  Your Linear workspace appears to be empty or newly created.');
			console.log('   To test the integration:');
			console.log('   1. Go to Linear (https://linear.app)');
			console.log('   2. Create a test issue in any team');
			console.log('   3. The webhook will sync it automatically');
			console.log('   4. Or re-run this sync script');
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('\n❌ Fatal error:', error);
		process.exit(1);
	});

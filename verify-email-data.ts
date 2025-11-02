/**
 * Verify Email Data in Database
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL environment variable required');
	process.exit(1);
}

async function verify() {
	const sql = postgres(DATABASE_URL);

	try {
		// Get total count
		const [total] = await sql`
			SELECT COUNT(*) as count FROM interaction WHERE "interactionType" = 'email'
		`;
		console.log('📊 Total emails in database:', total.count);

		// Get breakdown by client
		console.log('\nBreakdown by client:');
		const breakdown = await sql`
			SELECT cp.client_name, COUNT(*)::int as count
			FROM interaction i
			JOIN client_profiles cp ON i."clientProfileId" = cp.id
			WHERE i."interactionType" = 'email'
			GROUP BY cp.client_name
			ORDER BY count DESC
		`;
		breakdown.forEach(row => {
			console.log(`  ${row.client_name}: ${row.count} emails`);
		});

		// Sample some emails
		console.log('\n📧 Sample emails:');
		const samples = await sql`
			SELECT i.title, cp.client_name, i."interactionDate"
			FROM interaction i
			JOIN client_profiles cp ON i."clientProfileId" = cp.id
			WHERE i."interactionType" = 'email'
			ORDER BY i."interactionDate" DESC
			LIMIT 5
		`;
		samples.forEach((email, idx) => {
			console.log(`${idx + 1}. [${email.client_name}] ${email.title.substring(0, 60)}`);
			console.log(`   Date: ${email.interactionDate}`);
		});

	} catch (error: any) {
		console.error('❌ Error:', error.message);
		throw error;
	} finally {
		await sql.end();
	}
}

verify()
	.then(() => {
		console.log('\n✅ Verification complete!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Failed:', error);
		process.exit(1);
	});

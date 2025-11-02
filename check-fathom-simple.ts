import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = "postgresql://neondb_owner:npg_nkg3TcqswB7l@ep-cold-sunset-abnf9t6n-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function checkFathomData() {
	const pool = new Pool({ connectionString: DATABASE_URL });
	const db = drizzle(pool);

	console.log('=== Checking Fathom Configuration ===\n');

	// Check settings
	const settingsResult = await pool.query(
		"SELECT key, value FROM admin_settings WHERE category = 'integrations' AND key LIKE '%fathom%' ORDER BY key"
	);

	console.log('Fathom Settings:');
	settingsResult.rows.forEach(row => {
		console.log(`  ${row.key}: ${row.key.includes('api_key') ? '***hidden***' : row.value}`);
	});

	// Check Linear settings too
	const linearResult = await pool.query(
		"SELECT key, value FROM admin_settings WHERE category = 'oauth' AND key LIKE '%linear%' ORDER BY key"
	);

	console.log('\nLinear Settings:');
	linearResult.rows.forEach(row => {
		console.log(`  ${row.key}: ${row.key.includes('secret') ? '***hidden***' : row.value}`);
	});

	// Check if Fathom tables exist
	console.log('\n=== Checking Fathom Tables ===\n');

	const tablesResult = await pool.query(`
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public'
		AND table_name IN ('meetings', 'meeting_transcripts', 'meeting_insights', 'client_profiles', 'client_interactions')
		ORDER BY table_name
	`);

	console.log('Fathom Tables:');
	tablesResult.rows.forEach(row => {
		console.log(`  ✓ ${row.table_name}`);
	});

	// Get counts
	console.log('\n=== Data Counts ===\n');

	const meetingsCount = await pool.query('SELECT COUNT(*) FROM meetings');
	const transcriptsCount = await pool.query('SELECT COUNT(*) FROM meeting_transcripts');
	const insightsCount = await pool.query('SELECT COUNT(*) FROM meeting_insights');

	console.log(`Meetings: ${meetingsCount.rows[0].count}`);
	console.log(`Transcripts: ${transcriptsCount.rows[0].count}`);
	console.log(`Insights: ${insightsCount.rows[0].count}`);

	// Get sample meetings
	const sampleMeetings = await pool.query('SELECT id, title, start_time, user_id FROM meetings ORDER BY start_time DESC LIMIT 5');

	if (sampleMeetings.rows.length > 0) {
		console.log('\n=== Recent Meetings ===\n');
		sampleMeetings.rows.forEach(meeting => {
			console.log(`  - ${meeting.title || 'Untitled'}`);
			console.log(`    ID: ${meeting.id}`);
			console.log(`    Date: ${meeting.start_time || 'N/A'}`);
			console.log(`    User: ${meeting.user_id || 'N/A'}`);
			console.log('');
		});
	}

	await pool.end();
}

checkFathomData().catch(console.error);

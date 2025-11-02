import { db } from './src/lib/server/db';
import { adminSettings, meetings, meetingTranscripts } from './src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

async function checkFathomData() {
	console.log('=== Checking Fathom Configuration ===\n');

	// Check settings
	const fathomSettings = await db
		.select()
		.from(adminSettings)
		.where(eq(adminSettings.category, 'integrations'));

	console.log('Integration Settings:');
	fathomSettings.forEach(setting => {
		if (setting.key.includes('fathom')) {
			console.log(`  ${setting.key}: ${setting.key.includes('api_key') ? '***hidden***' : setting.value}`);
		}
	});

	// Check if Fathom tables exist and have data
	console.log('\n=== Checking Fathom Tables ===\n');

	try {
		const meetingCount = await db.select().from(meetings).limit(1);
		console.log(`Meetings table: ${meetingCount.length > 0 ? 'EXISTS with data' : 'EXISTS but empty'}`);

		const transcriptCount = await db.select().from(meetingTranscripts).limit(1);
		console.log(`Meeting transcripts table: ${transcriptCount.length > 0 ? 'EXISTS with data' : 'EXISTS but empty'}`);

		// Get total counts
		const allMeetings = await db.select().from(meetings);
		const allTranscripts = await db.select().from(meetingTranscripts);

		console.log(`\nTotal meetings: ${allMeetings.length}`);
		console.log(`Total transcripts: ${allTranscripts.length}`);

		if (allMeetings.length > 0) {
			console.log('\nRecent meetings:');
			allMeetings.slice(0, 5).forEach(meeting => {
				console.log(`  - ${meeting.title} (${meeting.startTime?.toISOString()})`);
			});
		}

	} catch (error) {
		console.error('Error checking tables:', error);
	}

	process.exit(0);
}

checkFathomData().catch(console.error);

/**
 * Convert Fathom Meetings to Interactions
 *
 * Converts meetings from the meetings/meeting_transcripts tables
 * into the unified interactions table for chat querying.
 *
 * This allows meetings to be searched alongside emails and Linear issues.
 */

import postgres from 'postgres';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL environment variable required');
	process.exit(1);
}

async function convertMeetingsToInteractions() {
	const sql = postgres(DATABASE_URL);

	try {
		console.log('🔄 Starting meeting-to-interaction conversion...\n');

		// Step 1: Get user ID
		const [user] = await sql`
			SELECT id FROM "user" LIMIT 1
		`;

		if (!user) {
			console.error('❌ No user found in database. Please create a user first.');
			process.exit(1);
		}

		const userId = user.id;
		console.log(`✅ Using user ID: ${userId}\n`);

		// Step 2: Get all meetings with transcripts
		console.log('📊 Fetching meetings from database...');
		const meetings = await sql`
			SELECT
				m.id as meeting_id,
				m."fathomMeetingId",
				m.title,
				m."startTime",
				m."endTime",
				m.duration,
				m."recordedBy",
				m."meetingUrl",
				m."videoUrl",
				m.attendees,
				m.platform,
				m.metadata,
				mt.id as transcript_id,
				mt."fullTranscript",
				mt.segments,
				mt.summary,
				mt."actionItems",
				mt.keywords,
				mt."keyPoints"
			FROM meetings m
			LEFT JOIN meeting_transcripts mt ON mt."meetingId" = m.id
			WHERE m."userId" = ${userId}
			ORDER BY m."startTime" DESC
		`;

		console.log(`✅ Found ${meetings.length} meetings\n`);

		if (meetings.length === 0) {
			console.log('ℹ️  No meetings found. Please run load-fathom-meetings.ts first.');
			return;
		}

		// Step 3: Check for existing interactions
		console.log('🔍 Checking for existing interactions...');
		const existingInteractions = await sql`
			SELECT "sourceId" FROM interaction
			WHERE "interactionType" = 'meeting'
			AND "userId" = ${userId}
		`;
		const existingSourceIds = new Set(existingInteractions.map(i => i.sourceId));
		console.log(`  Found ${existingSourceIds.size} existing meeting interactions\n`);

		// Step 4: Process meetings
		const meetingsToConvert = meetings.filter(m =>
			!existingSourceIds.has(`meeting_${m.fathomMeetingId}`)
		);

		console.log(`📋 Meetings to convert: ${meetingsToConvert.length} (${existingSourceIds.size} already converted)\n`);

		if (meetingsToConvert.length === 0) {
			console.log('ℹ️  All meetings already converted to interactions.');
			return;
		}

		// Step 5: Get client profiles for matching
		const clientProfiles = await sql`
			SELECT id, client_name, client_email, company_name
			FROM client_profiles
			WHERE user_id = ${userId}
		`;
		console.log(`📇 Loaded ${clientProfiles.length} client profiles for matching\n`);

		// Create email-to-client map
		const emailToClientMap = new Map<string, string>();
		clientProfiles.forEach(cp => {
			if (cp.client_email) {
				emailToClientMap.set(cp.client_email.toLowerCase(), cp.id);
			}
		});

		// Step 6: Convert meetings to interactions
		console.log('⚡ Converting meetings to interactions...\n');

		let converted = 0;
		let errors = 0;

		for (const meeting of meetingsToConvert) {
			try {
				// Find matching client by attendee emails
				let clientProfileId: string | null = null;
				if (meeting.attendees && Array.isArray(meeting.attendees)) {
					for (const attendee of meeting.attendees) {
						if (attendee.email) {
							const email = attendee.email.toLowerCase();
							if (emailToClientMap.has(email)) {
								clientProfileId = emailToClientMap.get(email)!;
								break;
							}
						}
					}
				}

				// Build content from transcript or summary
				let content = '';
				if (meeting.fullTranscript) {
					content = meeting.fullTranscript;
				} else if (meeting.summary) {
					content = meeting.summary;
				} else {
					content = `Meeting: ${meeting.title}`;
				}

				// Build title
				const title = meeting.title || 'Untitled Meeting';

				// Build metadata
				const metadata: Record<string, any> = {
					fathomMeetingId: meeting.fathomMeetingId,
					meetingUrl: meeting.meetingUrl,
					videoUrl: meeting.videoUrl,
					platform: meeting.platform,
					duration: meeting.duration,
					recordedBy: meeting.recordedBy,
					hasTranscript: !!meeting.fullTranscript,
					segmentCount: meeting.segments?.length || 0,
					...meeting.metadata
				};

				// Add action items to metadata
				if (meeting.actionItems && meeting.actionItems.length > 0) {
					metadata.actionItems = meeting.actionItems;
				}

				// Add keywords to metadata
				if (meeting.keywords && meeting.keywords.length > 0) {
					metadata.keywords = meeting.keywords;
				}

				// Add key points to metadata
				if (meeting.keyPoints && meeting.keyPoints.length > 0) {
					metadata.keyPoints = meeting.keyPoints;
				}

				// Insert interaction
				await sql`
					INSERT INTO interaction (
						id, "userId", "clientProfileId", "interactionType", "sourceId",
						title, content, participants, metadata, "interactionDate",
						"createdAt", "updatedAt"
					) VALUES (
						${randomUUID()},
						${userId},
						${clientProfileId},
						'meeting',
						${'meeting_' + meeting.fathomMeetingId},
						${title},
						${content},
						${sql.json(meeting.attendees || [])},
						${sql.json(metadata)},
						${meeting.startTime},
						${new Date()},
						${new Date()}
					)
				`;

				converted++;
				const clientMatch = clientProfileId ? '(matched client)' : '(no client match)';
				console.log(`  ✅ ${converted}/${meetingsToConvert.length} Converted: ${title.substring(0, 50)} ${clientMatch}`);

			} catch (error: any) {
				console.error(`  ❌ Error converting "${meeting.title}":`, error.message);
				errors++;
			}
		}

		// Step 7: Show summary
		const [totalInteractions] = await sql`
			SELECT COUNT(*) as count FROM interaction
			WHERE "interactionType" = 'meeting'
			AND "userId" = ${userId}
		`;

		console.log('\n' + '='.repeat(80));
		console.log('MEETING CONVERSION COMPLETE');
		console.log('='.repeat(80));
		console.log(`✅ Converted: ${converted} meetings`);
		if (errors > 0) {
			console.log(`⚠️  Errors: ${errors} meetings`);
		}
		console.log(`📊 Total meeting interactions in database: ${totalInteractions.count}`);

		// Show breakdown by client
		console.log('\nMeetings by client:');
		const byClient = await sql`
			SELECT
				COALESCE(cp.client_name, 'Unassigned') as client_name,
				COUNT(*)::int as count
			FROM interaction i
			LEFT JOIN client_profiles cp ON i."clientProfileId" = cp.id
			WHERE i."interactionType" = 'meeting'
			AND i."userId" = ${userId}
			GROUP BY cp.client_name
			ORDER BY count DESC
		`;

		byClient.forEach(row => {
			console.log(`  ${row.client_name}: ${row.count} meetings`);
		});

		// Show sample meetings
		console.log('\n📋 Recent meetings:');
		const recentMeetings = await sql`
			SELECT
				i.title,
				i."interactionDate",
				COALESCE(cp.client_name, 'Unassigned') as client_name
			FROM interaction i
			LEFT JOIN client_profiles cp ON i."clientProfileId" = cp.id
			WHERE i."interactionType" = 'meeting'
			AND i."userId" = ${userId}
			ORDER BY i."interactionDate" DESC
			LIMIT 5
		`;

		recentMeetings.forEach((m, idx) => {
			console.log(`${idx + 1}. [${m.client_name}] ${m.title}`);
			console.log(`   Date: ${m.interactionDate.toISOString()}`);
		});

		console.log('\n🎯 Next Steps:');
		console.log('  1. Generate Pinecone embeddings for meeting content');
		console.log('  2. Test chat with prompts like:');
		console.log('     - "Show me recent meetings with Stewart Golf"');
		console.log('     - "What action items came from last week\'s meetings?"');
		console.log('     - "Summarize the Q3 planning discussions"');

	} catch (error: any) {
		console.error('❌ Error:', error.message);
		throw error;
	} finally {
		await sql.end();
	}
}

convertMeetingsToInteractions()
	.then(() => {
		console.log('\n✅ Meeting conversion complete!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Failed:', error);
		process.exit(1);
	});

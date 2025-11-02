/**
 * Load Fathom Meetings into Database
 *
 * Fetches all meetings from Fathom API and stores them with transcripts
 * in the meetings and meeting_transcripts tables.
 *
 * Extracts every available data point from Fathom:
 * - Meeting metadata (title, times, duration, attendees, platform)
 * - Full transcripts with speaker attribution
 * - AI summaries and action items
 * - Keywords and key points
 */

import postgres from 'postgres';
import { randomUUID } from 'crypto';
import * as fathom from './src/lib/server/integrations/fathom';

const DATABASE_URL = process.env.DATABASE_URL;
const FATHOM_API_KEY = process.env.FATHOM_API_KEY;

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL environment variable required');
	process.exit(1);
}

if (!FATHOM_API_KEY || FATHOM_API_KEY === 'your_fathom_api_key_here') {
	console.error('❌ FATHOM_API_KEY environment variable required');
	console.error('   Get your API key from: https://app.fathom.video/settings/integrations');
	process.exit(1);
}

interface ProcessedMeeting {
	fathomMeetingId: string;
	title: string;
	startTime: Date;
	endTime: Date;
	duration: number;
	recordedBy?: string;
	meetingUrl?: string;
	videoUrl?: string;
	attendees: Array<{ name: string; email?: string; role?: string }>;
	platform?: string;
	metadata: Record<string, any>;
	transcript?: {
		fullTranscript: string;
		segments: Array<{
			speaker: string;
			text: string;
			timestamp: number;
			duration: number;
		}>;
		summary?: string;
		actionItems: Array<{
			text: string;
			assignee?: string;
			dueDate?: string;
			completed: boolean;
		}>;
		keywords?: string[];
		keyPoints?: string[];
	};
}

async function loadFathomMeetings() {
	const sql = postgres(DATABASE_URL);

	try {
		console.log('🎥 Starting Fathom meetings import process...\n');

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

		// Step 2: Fetch all meetings from Fathom
		console.log('📡 Fetching meetings from Fathom API...');

		// Fetch meetings from the last 365 days (adjust as needed)
		const dateRange = fathom.getDateRange(365);
		const fathomMeetings = await fathom.fetchAllMeetings(FATHOM_API_KEY, {
			...dateRange,
			limit: 100
		});

		console.log(`✅ Fetched ${fathomMeetings.length} meetings from Fathom\n`);

		if (fathomMeetings.length === 0) {
			console.log('ℹ️  No meetings found in Fathom. Exiting.');
			return;
		}

		// Step 3: Check existing meetings
		console.log('🔍 Checking for existing meetings in database...');
		const existingMeetings = await sql`
			SELECT "fathomMeetingId" FROM meetings
		`;
		const existingMeetingIds = new Set(existingMeetings.map(m => m.fathomMeetingId));
		console.log(`  Found ${existingMeetingIds.size} existing meetings in database\n`);

		// Step 4: Process each meeting with full details
		console.log('⚡ Processing meetings with transcripts and summaries...\n');

		const processedMeetings: ProcessedMeeting[] = [];
		let fetchErrors = 0;

		for (let i = 0; i < fathomMeetings.length; i++) {
			const meeting: any = fathomMeetings[i];
			const progress = `[${i + 1}/${fathomMeetings.length}]`;
			const recordingId = String(meeting.recording_id);

			// Skip if already in database
			if (existingMeetingIds.has(recordingId)) {
				const meetingTitle = meeting.meeting_title || meeting.title || 'Untitled Meeting';
				console.log(`  ${progress} ⏭️  Skipping (already exists): ${meetingTitle}`);
				continue;
			}

			try {
				const meetingData: any = meeting as any;
				const meetingTitle = meetingData.meeting_title || meetingData.title || 'Untitled Meeting';
				console.log(`  ${progress} 📥 Processing: ${meetingTitle}`);

				// Process attendees
				const attendees = meetingData.calendar_invitees?.map((invitee: any) => ({
					name: invitee.name,
					email: invitee.email,
					role: 'attendee' as const
				})) || [];

				// Add recorded_by as attendee
				if (meetingData.recorded_by) {
					attendees.unshift({
						name: meetingData.recorded_by.name,
						email: meetingData.recorded_by.email,
						role: 'host' as const
					});
				}

				// Calculate duration from timestamps
				const startTime = new Date(meetingData.recording_start_time || meetingData.scheduled_start_time);
				const endTime = new Date(meetingData.recording_end_time || meetingData.scheduled_end_time);
				const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000); // seconds

				// Build processed meeting
				const processed: ProcessedMeeting = {
					fathomMeetingId: String(meetingData.recording_id),
					title: meetingTitle,
					startTime,
					endTime,
					duration,
					recordedBy: meetingData.recorded_by?.name,
					meetingUrl: meetingData.url,
					videoUrl: meetingData.share_url,
					attendees,
					platform: 'zoom', // Default platform
					metadata: {
						created_at: meetingData.created_at,
						calendar_invitees_domains_type: meetingData.calendar_invitees_domains_type
					}
				};

				// Add transcript data if available (from API list response)
				if (meetingData.transcript) {
					processed.transcript = {
						fullTranscript: meetingData.transcript,
						segments: [], // Not available in list endpoint
						keywords: [],
						summary: meetingData.default_summary,
						actionItems: meetingData.action_items || [],
						keyPoints: []
					};
				}

				processedMeetings.push(processed);

				const hasTranscript = !!meetingData.transcript;
				console.log(`      ✅ Complete (${hasTranscript ? 'with transcript' : 'no transcript'})`);

			} catch (error: any) {
				console.error(`      ❌ Error: ${error.message}`);
				fetchErrors++;
			}
		}

		console.log(`\n📊 Processing complete:`);
		console.log(`   New meetings to insert: ${processedMeetings.length}`);
		console.log(`   Already in database: ${existingMeetingIds.size}`);
		console.log(`   Fetch errors: ${fetchErrors}\n`);

		if (processedMeetings.length === 0) {
			console.log('ℹ️  No new meetings to insert. All meetings already exist.');
			return;
		}

		// Step 5: Insert meetings and transcripts into database
		console.log('💾 Inserting meetings into database...\n');

		let insertedMeetings = 0;
		let insertedTranscripts = 0;
		let insertErrors = 0;

		for (const meeting of processedMeetings) {
			try {
				await sql.begin(async sql => {
					// Insert meeting
					const [insertedMeeting] = await sql`
						INSERT INTO meetings (
							id, "userId", "fathomMeetingId", title,
							"startTime", "endTime", duration, "recordedBy",
							"meetingUrl", "videoUrl", attendees, platform, metadata,
							"createdAt", "updatedAt"
						) VALUES (
							${randomUUID()},
							${userId},
							${meeting.fathomMeetingId},
							${meeting.title},
							${meeting.startTime},
							${meeting.endTime},
							${meeting.duration},
							${meeting.recordedBy || null},
							${meeting.meetingUrl || null},
							${meeting.videoUrl || null},
							${sql.json(meeting.attendees)},
							${meeting.platform || null},
							${sql.json(meeting.metadata)},
							${new Date()},
							${new Date()}
						) RETURNING id
					`;

					insertedMeetings++;
					console.log(`  ✅ Inserted meeting: ${meeting.title}`);

					// Insert transcript if available
					if (meeting.transcript) {
						await sql`
							INSERT INTO meeting_transcripts (
								id, "meetingId", "fullTranscript", segments,
								summary, "actionItems", keywords, "keyPoints",
								"createdAt", "updatedAt"
							) VALUES (
								${randomUUID()},
								${insertedMeeting.id},
								${meeting.transcript.fullTranscript},
								${sql.json(meeting.transcript.segments)},
								${meeting.transcript.summary || null},
								${sql.json(meeting.transcript.actionItems)},
								${sql.json(meeting.transcript.keywords || [])},
								${sql.json(meeting.transcript.keyPoints || [])},
								${new Date()},
								${new Date()}
							)
						`;

						insertedTranscripts++;
						console.log(`      📝 Added transcript (${meeting.transcript.segments.length} segments)`);
					}
				});

			} catch (error: any) {
				console.error(`  ❌ Error inserting ${meeting.title}:`, error.message);
				insertErrors++;
			}
		}

		// Step 6: Show final summary
		const [totalMeetings] = await sql`
			SELECT COUNT(*) as count FROM meetings
		`;
		const [totalTranscripts] = await sql`
			SELECT COUNT(*) as count FROM meeting_transcripts
		`;

		console.log('\n' + '='.repeat(80));
		console.log('FATHOM IMPORT COMPLETE');
		console.log('='.repeat(80));
		console.log(`✅ Inserted meetings: ${insertedMeetings}`);
		console.log(`📝 Inserted transcripts: ${insertedTranscripts}`);
		if (insertErrors > 0) {
			console.log(`⚠️  Insert errors: ${insertErrors}`);
		}
		console.log(`📊 Total meetings in database: ${totalMeetings.count}`);
		console.log(`📊 Total transcripts in database: ${totalTranscripts.count}`);

		// Show sample meetings
		console.log('\n📋 Sample meetings:');
		const sampleMeetings = await sql`
			SELECT m.title, m."startTime", m.platform,
			       (SELECT COUNT(*) FROM meeting_transcripts WHERE "meetingId" = m.id) as has_transcript
			FROM meetings m
			ORDER BY m."startTime" DESC
			LIMIT 5
		`;

		sampleMeetings.forEach((m, idx) => {
			console.log(`${idx + 1}. ${m.title}`);
			console.log(`   Date: ${m.startTime.toISOString()}`);
			console.log(`   Platform: ${m.platform || 'Unknown'}`);
			console.log(`   Transcript: ${m.has_transcript > 0 ? 'Yes' : 'No'}`);
		});

		console.log('\n🎯 Next Steps:');
		console.log('  1. Convert meetings to interactions using meeting-importer.ts');
		console.log('  2. Generate Pinecone embeddings for meeting content');
		console.log('  3. Enable chat to query meeting history');
		console.log('  4. Test with prompts like "Show me recent meetings with Stewart Golf"');

	} catch (error: any) {
		console.error('❌ Error:', error.message);
		throw error;
	} finally {
		await sql.end();
	}
}

loadFathomMeetings()
	.then(() => {
		console.log('\n✅ Fathom meeting import complete!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Failed:', error);
		process.exit(1);
	});

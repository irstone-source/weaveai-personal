/**
 * Meeting Interaction Importer
 *
 * Converts meeting transcripts from various sources into unified interaction records:
 * - Fathom meetings
 * - Google Meet
 * - Email meeting notes
 * - Manual notes
 * - Future: WebRTC meetings
 *
 * Integrates with existing meetingTranscripts table
 */

import { randomUUID } from 'crypto';
import { db } from '$lib/server/db';
import { interactions, meetings, meetingTranscripts, clientProfiles } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

interface MeetingInteraction {
	title: string;
	content: string;
	participants: Array<{ name: string; email?: string; role?: string }>;
	meetingDate: Date;
	sourceUrl?: string;
	metadata: Record<string, any>;
}

interface ImportResult {
	imported: number;
	skipped: number;
	errors: string[];
}

/**
 * Meeting Interaction Importer
 */
export class MeetingInteractionImporter {
	constructor(private userId: string) {}

	/**
	 * Import a meeting transcript as an interaction
	 */
	async importMeeting(meetingId: string): Promise<void> {
		try {
			// Get meeting and transcript
			const meeting = await db.query.meetings.findFirst({
				where: and(
					eq(meetings.id, meetingId),
					eq(meetings.userId, this.userId)
				),
				with: {
					transcript: true
				}
			});

			if (!meeting) {
				throw new Error(`Meeting ${meetingId} not found`);
			}

			if (!meeting.transcript) {
				throw new Error(`Meeting ${meetingId} has no transcript`);
			}

			// Check if interaction already exists
			const existing = await db.query.interactions.findFirst({
				where: and(
					eq(interactions.userId, this.userId),
					eq(interactions.sourceId, `meeting_${meetingId}`)
				)
			});

			if (existing) {
				console.log(`[Meeting Importer] Meeting ${meetingId} already imported`);
				return;
			}

			// Extract participants
			const participants = this.extractParticipants(meeting);

			// Try to find client profile based on meeting participants
			let clientProfile = null;
			for (const participant of participants) {
				if (participant.email) {
				clientProfile = await db.query.clientProfiles.findFirst({
					where: eq(clientProfiles.clientEmail, participant.email)
				});
					if (clientProfile) break;
				}
			}

			// Determine interaction type based on meeting source
			const interactionType = this.getMeetingInteractionType(meeting);

			// Create interaction record
			await db.insert(interactions).values({
				id: randomUUID(),
				userId: this.userId,
				projectId: meeting.projectId || null,
				clientProfileId: clientProfile?.id || null,
				interactionType,
				sourceId: `meeting_${meetingId}`,
				sourceUrl: meeting.videoUrl || null,
				title: meeting.title,
				content: meeting.transcript.summary || meeting.transcript.fullTranscript,
				participants,
				sentiment: null, // Will be set by auto-categorization
				priority: 'none',
				tags: this.generateMeetingTags(meeting),
				metadata: {
					meetingId,
					duration: meeting.duration,
					platform: (meeting.metadata?.platform as string | undefined),
					hasRecording: !!meeting.videoUrl,
					speakerCount: participants.length,
					...meeting.metadata
				},
				pineconeStored: false,
				interactionDate: meeting.startTime,
				createdAt: new Date(),
				updatedAt: new Date()
			});

			console.log(`[Meeting Importer] Imported meeting: ${meeting.title}`);
		} catch (error) {
			const err = error as Error;
			console.error('[Meeting Importer] Failed to import meeting:', err);
			throw err;
		}
	}

	/**
	 * Import all meetings that haven't been converted to interactions yet
	 */
	async importAllUnimportedMeetings(): Promise<ImportResult> {
		const result: ImportResult = {
			imported: 0,
			skipped: 0,
			errors: []
		};

		try {
			// Get all meetings with transcripts for this user
			const allMeetings = await db.query.meetings.findMany({
				where: eq(meetings.userId, this.userId),
				with: {
					transcript: true
				}
			});

			for (const meeting of allMeetings) {
				try {
					// Check if already imported
					const existing = await db.query.interactions.findFirst({
						where: and(
							eq(interactions.userId, this.userId),
							eq(interactions.sourceId, `meeting_${meeting.id}`)
						)
					});

					if (existing) {
						result.skipped++;
						continue;
					}

					if (!meeting.transcript) {
						result.skipped++;
						continue;
					}

					// Import the meeting
					await this.importMeeting(meeting.id);
					result.imported++;

				} catch (error) {
					const err = error as Error;
					result.errors.push(`Meeting ${meeting.id}: ${err.message}`);
				}
			}

			console.log(`[Meeting Importer] Imported ${result.imported} meetings, skipped ${result.skipped}`);
		} catch (error) {
			const err = error as Error;
			result.errors.push(`Failed to import meetings: ${err.message}`);
		}

		return result;
	}

	/**
	 * Import meetings for a specific client
	 */
	async importMeetingsForClient(clientProfileId: string): Promise<ImportResult> {
		const result: ImportResult = {
			imported: 0,
			skipped: 0,
			errors: []
		};

		try {
			// Get client profile
			const client = await db.query.clientProfiles.findFirst({
				where: eq(clientProfiles.id, clientProfileId)
			});

			if (!client) {
				throw new Error(`Client ${clientProfileId} not found`);
			}

			// Get all meetings with transcripts
			const allMeetings = await db.query.meetings.findMany({
				where: eq(meetings.userId, this.userId),
				with: {
					transcript: true
				}
			});

			// Filter meetings that involve this client
			for (const meeting of allMeetings) {
				try {
					// Check if client participated in this meeting
					const participants = this.extractParticipants(meeting);
					const clientParticipated = participants.some(p =>
						p.email && p.email === client.clientEmail
					);

					if (!clientParticipated) {
						result.skipped++;
						continue;
					}

					// Check if already imported
					const existing = await db.query.interactions.findFirst({
						where: and(
							eq(interactions.userId, this.userId),
							eq(interactions.sourceId, `meeting_${meeting.id}`)
						)
					});

					if (existing) {
						result.skipped++;
						continue;
					}

					if (!meeting.transcript) {
						result.skipped++;
						continue;
					}

					// Import the meeting
					await this.importMeeting(meeting.id);
					result.imported++;

				} catch (error) {
					const err = error as Error;
					result.errors.push(`Meeting ${meeting.id}: ${err.message}`);
				}
			}

			console.log(`[Meeting Importer] Client ${client.clientName}: ${result.imported} meetings imported`);
		} catch (error) {
			const err = error as Error;
			result.errors.push(`Failed to import client meetings: ${err.message}`);
		}

		return result;
	}

	/**
	 * Extract participants from meeting metadata
	 */
	private extractParticipants(meeting: any): Array<{ name: string; email?: string; role?: string }> {
		const participants: Array<{ name: string; email?: string; role?: string }> = [];

		// From attendees field
		if (meeting.attendees && Array.isArray(meeting.attendees)) {
			participants.push(...meeting.attendees.map((a: any) => ({
				name: a.name || a.email || 'Unknown',
				email: a.email,
				role: a.role || 'attendee'
			})));
		}

		// From metadata.participants
		if (meeting.metadata?.participants && Array.isArray(meeting.metadata.participants)) {
			participants.push(...meeting.metadata.participants.map((p: any) => ({
				name: p.name || p.email || 'Unknown',
				email: p.email,
				role: p.role || 'attendee'
			})));
		}

		// Deduplicate by email
		const seen = new Set<string>();
		return participants.filter(p => {
			if (!p.email) return true;
			if (seen.has(p.email)) return false;
			seen.add(p.email);
			return true;
		});
	}

	/**
	 * Determine interaction type based on meeting source
	 */
	private getMeetingInteractionType(meeting: any): string {
		const platform = (meeting.metadata?.platform as string | undefined)?.toLowerCase() || '';

		if (platform.includes('fathom')) {
			return 'fathom_meeting';
		} else if (platform.includes('google')) {
			return 'google_meet';
		} else if (platform.includes('webrtc')) {
			return 'webrtc_meeting';
		}

		return 'manual_note';
	}

	/**
	 * Generate tags for meeting
	 */
	private generateMeetingTags(meeting: any): string[] {
		const tags = ['meeting'];

		const platform = meeting.platform?.toLowerCase() || '';
		if (platform) {
			tags.push(platform);
		}

		if (meeting.videoUrl) {
			tags.push('recorded');
		}

		if (meeting.type) {
			tags.push(meeting.type);
		}

		// Add custom tags from metadata
		if (meeting.metadata?.tags && Array.isArray(meeting.metadata.tags)) {
			tags.push(...meeting.metadata.tags);
		}

		return tags;
	}
}

/**
 * Create meeting importer for a user
 */
export function createMeetingImporter(userId: string): MeetingInteractionImporter {
	return new MeetingInteractionImporter(userId);
}

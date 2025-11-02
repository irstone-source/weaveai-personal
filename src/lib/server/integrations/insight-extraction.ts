/**
 * LLM-Based Insight Extraction for Meeting Transcripts
 *
 * Extracts structured insights from meeting transcripts:
 * - Decisions made
 * - Risks identified
 * - Opportunities discovered
 * - Client preferences and concerns
 * - Action items
 * - Key topics and themes
 */

import { db } from '$lib/server/db';
import {
	meetings,
	meetingTranscripts,
	meetingInsights,
	clientProfiles,
	clientInteractions
} from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '$lib/utils';

// ============================================================================
// Configuration
// ============================================================================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet'; // Fast and capable

// ============================================================================
// Types
// ============================================================================

export interface ExtractedInsights {
	decisions: Array<{
		content: string;
		speaker?: string;
		importance: number;
		category: string;
	}>;
	risks: Array<{
		content: string;
		severity: number;
		category: string;
	}>;
	opportunities: Array<{
		content: string;
		potential: number;
		category: string;
	}>;
	clientIntelligence: {
		priorities: string[];
		concerns: string[];
		preferences: Record<string, string>;
		communicationStyle?: string;
		sentimentScore: number;
	};
	keyTopics: string[];
	actionItems: Array<{
		content: string;
		assignee?: string;
		deadline?: string;
	}>;
}

// ============================================================================
// LLM Prompt Templates
// ============================================================================

const INSIGHT_EXTRACTION_PROMPT = `You are an expert at analyzing business meeting transcripts and extracting actionable insights.

Your task is to carefully analyze the provided meeting transcript and extract structured insights in the following categories:

1. **Decisions Made**: Key decisions that were agreed upon during the meeting
2. **Risks Identified**: Potential risks, blockers, or concerns raised
3. **Opportunities Discovered**: New opportunities, ideas, or potential wins mentioned
4. **Client Intelligence**: Client preferences, priorities, concerns, and communication style
5. **Key Topics**: Main themes and topics discussed
6. **Action Items**: Specific tasks that need to be completed

For each insight:
- Be specific and actionable
- Include who said what when relevant
- Rate importance/severity/potential on a scale of 1-10
- Categorize appropriately (technical, business, design, etc.)

Return your analysis as a JSON object matching this exact structure:
{
  "decisions": [
    {"content": "string", "speaker": "string", "importance": number, "category": "string"}
  ],
  "risks": [
    {"content": "string", "severity": number, "category": "string"}
  ],
  "opportunities": [
    {"content": "string", "potential": number, "category": "string"}
  ],
  "clientIntelligence": {
    "priorities": ["string"],
    "concerns": ["string"],
    "preferences": {"key": "value"},
    "communicationStyle": "string",
    "sentimentScore": number
  },
  "keyTopics": ["string"],
  "actionItems": [
    {"content": "string", "assignee": "string", "deadline": "string"}
  ]
}

Meeting Transcript:
{transcript}`;

// ============================================================================
// LLM Service
// ============================================================================

async function callLLM(prompt: string): Promise<string> {
	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': process.env.PUBLIC_ORIGIN || 'http://localhost:5173',
			'X-Title': 'WeaveAI Enterprise - Fathom Integration'
		},
		body: JSON.stringify({
			model: OPENROUTER_MODEL,
			messages: [
				{
					role: 'user',
					content: prompt
				}
			],
			temperature: 0.3, // Lower temperature for more consistent output
			max_tokens: 4000
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`LLM API error: ${error}`);
	}

	const data = await response.json();
	return data.choices[0].message.content;
}

// ============================================================================
// Insight Extraction
// ============================================================================

/**
 * Extract insights from meeting transcript using LLM
 */
export async function extractInsightsFromTranscript(
	transcript: string
): Promise<ExtractedInsights> {

	// Prepare prompt
	const prompt = INSIGHT_EXTRACTION_PROMPT.replace('{transcript}', transcript);

	// Call LLM
	console.log('[Insight Extraction] Calling LLM for insight extraction...');
	const response = await callLLM(prompt);

	// Parse JSON response
	try {
		// Extract JSON from response (handle markdown code blocks)
		let jsonStr = response.trim();
		if (jsonStr.startsWith('```json')) {
			jsonStr = jsonStr.slice(7);
		}
		if (jsonStr.startsWith('```')) {
			jsonStr = jsonStr.slice(3);
		}
		if (jsonStr.endsWith('```')) {
			jsonStr = jsonStr.slice(0, -3);
		}

		const insights: ExtractedInsights = JSON.parse(jsonStr.trim());
		console.log('[Insight Extraction] Successfully extracted insights');
		return insights;

	} catch (error) {
		console.error('[Insight Extraction] Failed to parse LLM response:', error);
		console.error('Raw response:', response);

		// Return empty structure if parsing fails
		return {
			decisions: [],
			risks: [],
			opportunities: [],
			clientIntelligence: {
				priorities: [],
				concerns: [],
				preferences: {},
				sentimentScore: 5
			},
			keyTopics: [],
			actionItems: []
		};
	}
}

// ============================================================================
// Store Insights in Database
// ============================================================================

/**
 * Store extracted insights in the database
 */
export async function storeInsights(
	meetingId: string,
	insights: ExtractedInsights
): Promise<void> {

	// Store decisions
	for (const decision of insights.decisions) {
		await db.insert(meetingInsights).values({
			meetingId,
			insightType: 'decision',
			content: decision.content,
			speaker: decision.speaker,
			importance: decision.importance,
			category: decision.category,
			metadata: {}
		});
	}

	// Store risks
	for (const risk of insights.risks) {
		await db.insert(meetingInsights).values({
			meetingId,
			insightType: 'risk',
			content: risk.content,
			importance: risk.severity,
			category: risk.category,
			metadata: { severity: risk.severity }
		});
	}

	// Store opportunities
	for (const opportunity of insights.opportunities) {
		await db.insert(meetingInsights).values({
			meetingId,
			insightType: 'opportunity',
			content: opportunity.content,
			importance: opportunity.potential,
			category: opportunity.category,
			metadata: { potential: opportunity.potential }
		});
	}

	// Store action items
	for (const actionItem of insights.actionItems) {
		await db.insert(meetingInsights).values({
			meetingId,
			insightType: 'action_item',
			content: actionItem.content,
			speaker: actionItem.assignee,
			importance: 9,
			category: 'action',
			metadata: {
				assignee: actionItem.assignee,
				deadline: actionItem.deadline
			}
		});
	}

	// Update meeting to mark insights as available
	await db
		.update(meetings)
		.set({
			hasInsights: true,
			updatedAt: new Date()
		})
		.where(eq(meetings.id, meetingId));

	console.log('[Insight Extraction] Stored all insights in database');
}

// ============================================================================
// Client Profile Building
// ============================================================================

/**
 * Update or create client profile from meeting insights
 */
export async function updateClientProfile(
	userId: string,
	meetingId: string,
	clientEmail: string,
	insights: ExtractedInsights
): Promise<void> {

	const meeting = await db
		.select()
		.from(meetings)
		.where(eq(meetings.id, meetingId))
		.limit(1)
		.then(rows => rows[0]);

	if (!meeting) {
		console.warn('[Client Profile] Meeting not found:', meetingId);
		return;
	}

	// Find or create client profile
	const [existingProfile] = await db
		.select()
		.from(clientProfiles)
		.where(
			and(
				eq(clientProfiles.userId, userId),
				eq(clientProfiles.clientEmail, clientEmail)
			)
		)
		.limit(1);

	const clientIntel = insights.clientIntelligence;

	if (existingProfile) {
		// Update existing profile
		const updatedPriorities = Array.from(new Set([
			...(existingProfile.priorities as string[]),
			...clientIntel.priorities
		]));

		const updatedConcerns = Array.from(new Set([
			...(existingProfile.concerns as string[]),
			...clientIntel.concerns
		]));

		const updatedPreferences = {
			...(existingProfile.preferences as Record<string, string>),
			...clientIntel.preferences
		};

		const updatedTopics = Array.from(new Set([
			...(existingProfile.keyTopics as string[]),
			...insights.keyTopics
		]));

		// Calculate average sentiment
		const newSentimentScore = Math.round(
			(existingProfile.sentimentScore + clientIntel.sentimentScore) / 2
		);

		await db
			.update(clientProfiles)
			.set({
				priorities: updatedPriorities,
				concerns: updatedConcerns,
				preferences: updatedPreferences,
				communicationStyle: clientIntel.communicationStyle || existingProfile.communicationStyle,
				totalMeetings: existingProfile.totalMeetings + 1,
				lastMeetingDate: meeting.startTime,
				sentimentScore: newSentimentScore,
				keyTopics: updatedTopics,
				updatedAt: new Date()
			})
			.where(eq(clientProfiles.id, existingProfile.id));

		console.log('[Client Profile] Updated existing profile:', existingProfile.id);

	} else {
		// Create new profile
		const attendee = (meeting.attendees as any[])?.find((a: any) =>
			a.email === clientEmail
		);

		await db.insert(clientProfiles).values({
			userId,
			projectId: meeting.projectId,
			clientName: attendee?.name || clientEmail.split('@')[0],
			clientEmail,
			companyName: clientEmail.split('@')[1],
			communicationStyle: clientIntel.communicationStyle,
			priorities: clientIntel.priorities,
			concerns: clientIntel.concerns,
			preferences: clientIntel.preferences,
			totalMeetings: 1,
			lastMeetingDate: meeting.startTime,
			sentimentScore: clientIntel.sentimentScore,
			keyTopics: insights.keyTopics,
			metadata: {}
		});

		console.log('[Client Profile] Created new profile for:', clientEmail);
	}

	// Create client interaction record
	await db.insert(clientInteractions).values({
		clientProfileId: existingProfile?.id || '',
		meetingId,
		projectId: meeting.projectId,
		interactionType: 'meeting',
		summary: `Meeting: ${meeting.title}`,
		sentiment: clientIntel.sentimentScore >= 7 ? 'positive' : clientIntel.sentimentScore >= 4 ? 'neutral' : 'negative',
		keyPoints: insights.keyTopics,
		actionItems: insights.actionItems.map(a => ({ text: a.content, assignee: a.assignee })),
		interactionDate: meeting.startTime,
		metadata: {}
	});
}

// ============================================================================
// High-Level: Process Meeting for Insights
// ============================================================================

/**
 * Complete pipeline: extract insights, store in DB, update client profiles
 */
export async function processMeetingForInsights(
	meetingId: string
): Promise<{
	success: boolean;
	insightsExtracted: number;
	clientProfilesUpdated: number;
	errors: string[];
}> {

	const errors: string[] = [];

	try {
		// Get meeting and transcript
		const [meeting] = await db
			.select()
			.from(meetings)
			.where(eq(meetings.id, meetingId))
			.limit(1);

		if (!meeting) {
			throw new Error(`Meeting ${meetingId} not found`);
		}

		const [transcript] = await db
			.select()
			.from(meetingTranscripts)
			.where(eq(meetingTranscripts.meetingId, meetingId))
			.limit(1);

		if (!transcript) {
			throw new Error(`Transcript for meeting ${meetingId} not found`);
		}

		// 1. Extract insights using LLM
		console.log(`[Insight Processing] Extracting insights for meeting ${meetingId}`);
		const insights = await extractInsightsFromTranscript(transcript.fullTranscript);

		// 2. Store insights in database
		console.log(`[Insight Processing] Storing insights...`);
		await storeInsights(meetingId, insights);

		const totalInsights =
			insights.decisions.length +
			insights.risks.length +
			insights.opportunities.length +
			insights.actionItems.length;

		// 3. Update client profiles
		console.log(`[Insight Processing] Updating client profiles...`);
		const attendees = (meeting.attendees as any[]) || [];
		const clientEmails = attendees
			.filter((a: any) => a.email && !a.email.includes(meeting.recordedBy || ''))
			.map((a: any) => a.email);

		for (const email of clientEmails) {
			try {
				await updateClientProfile(meeting.userId, meetingId, email, insights);
			} catch (error) {
				errors.push(`Failed to update profile for ${email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		// 4. Mark meeting as processed
		await db
			.update(meetings)
			.set({
				isProcessed: true,
				processingStatus: 'completed',
				updatedAt: new Date()
			})
			.where(eq(meetings.id, meetingId));

		console.log(`[Insight Processing] Complete: ${totalInsights} insights extracted, ${clientEmails.length} profiles updated`);

		return {
			success: true,
			insightsExtracted: totalInsights,
			clientProfilesUpdated: clientEmails.length,
			errors
		};

	} catch (error) {
		console.error('[Insight Processing] Error:', error);
		errors.push(error instanceof Error ? error.message : 'Unknown error');

		return {
			success: false,
			insightsExtracted: 0,
			clientProfilesUpdated: 0,
			errors
		};
	}
}

/**
 * Fathom Meeting Intelligence Integration
 *
 * Provides API integration with Fathom for:
 * - Meeting listing with filters
 * - Transcript retrieval
 * - Meeting summaries
 * - Team management
 *
 * API Documentation: https://docs.fathom.video/docs/api-reference
 */

const FATHOM_API_BASE = 'https://api.fathom.ai/external/v1';

// ============================================================================
// Types
// ============================================================================

export interface FathomMeeting {
	id: string;
	title: string;
	start_time: string; // ISO 8601
	end_time: string; // ISO 8601
	duration: number; // seconds
	recorded_by: {
		id: string;
		name: string;
		email?: string;
	};
	calendar_invitees?: Array<{
		name: string;
		email: string;
	}>;
	recording_url?: string;
	video_url?: string;
	team_ids?: string[];
	platform?: 'zoom' | 'google_meet' | 'teams' | 'other';
	metadata?: Record<string, any>;
}

export interface FathomTranscript {
	meeting_id: string;
	full_transcript: string;
	segments: Array<{
		speaker: string;
		text: string;
		timestamp: number; // seconds from start
		duration: number; // seconds
	}>;
	keywords?: string[];
}

export interface FathomSummary {
	meeting_id: string;
	summary: string;
	action_items: Array<{
		text: string;
		assignee?: string;
		due_date?: string;
	}>;
	key_points?: string[];
}

export interface FathomTeam {
	id: string;
	name: string;
	member_count: number;
}

export interface FathomTeamMember {
	id: string;
	name: string;
	email: string;
	role: 'admin' | 'member' | 'viewer';
}

export interface ListMeetingsOptions {
	start_date?: string; // ISO 8601
	end_date?: string; // ISO 8601
	calendar_invitees?: string[]; // email addresses
	domains?: string[]; // email domains
	recorded_by?: string; // user ID
	teams?: string[]; // team IDs
	limit?: number;
	cursor?: string; // pagination cursor
}

export interface FathomAPIResponse<T> {
	data: T;
	pagination?: {
		next_cursor?: string;
		has_more: boolean;
	};
}

// ============================================================================
// API Request Helper
// ============================================================================

async function fathomAPIRequest<T>(
	apiKey: string,
	endpoint: string,
	options: RequestInit = {}
): Promise<T> {
	const url = `${FATHOM_API_BASE}${endpoint}`;

	const response = await fetch(url, {
		...options,
		headers: {
			'X-Api-Key': apiKey,
			'Content-Type': 'application/json',
			...options.headers,
		},
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(
			`Fathom API error (${response.status}): ${errorBody}`
		);
	}

	return response.json();
}

// ============================================================================
// Meeting Operations
// ============================================================================

/**
 * List meetings with optional filters
 */
export async function listMeetings(
	apiKey: string,
	options: ListMeetingsOptions = {}
): Promise<FathomAPIResponse<FathomMeeting[]>> {
	const params = new URLSearchParams();

	if (options.start_date) params.append('start_date', options.start_date);
	if (options.end_date) params.append('end_date', options.end_date);
	if (options.calendar_invitees) {
		options.calendar_invitees.forEach(email =>
			params.append('calendar_invitees', email)
		);
	}
	if (options.domains) {
		options.domains.forEach(domain =>
			params.append('domains', domain)
		);
	}
	if (options.recorded_by) params.append('recorded_by', options.recorded_by);
	if (options.teams) {
		options.teams.forEach(team =>
			params.append('teams', team)
		);
	}
	if (options.limit) params.append('limit', options.limit.toString());
	if (options.cursor) params.append('cursor', options.cursor);

	const queryString = params.toString();
	const endpoint = queryString ? `/meetings?${queryString}` : '/meetings';

	return fathomAPIRequest<FathomAPIResponse<FathomMeeting[]>>(
		apiKey,
		endpoint
	);
}

/**
 * Get a single meeting by ID
 */
export async function getMeeting(
	apiKey: string,
	meetingId: string
): Promise<FathomMeeting> {
	return fathomAPIRequest<FathomMeeting>(
		apiKey,
		`/meetings/${meetingId}`
	);
}

// ============================================================================
// Transcript Operations
// ============================================================================

/**
 * Get meeting transcript with speaker attribution
 */
export async function getMeetingTranscript(
	apiKey: string,
	meetingId: string
): Promise<FathomTranscript> {
	return fathomAPIRequest<FathomTranscript>(
		apiKey,
		`/meetings/${meetingId}/transcript`
	);
}

// ============================================================================
// Summary Operations
// ============================================================================

/**
 * Get AI-generated meeting summary and action items
 */
export async function getMeetingSummary(
	apiKey: string,
	meetingId: string
): Promise<FathomSummary> {
	return fathomAPIRequest<FathomSummary>(
		apiKey,
		`/meetings/${meetingId}/summary`
	);
}

// ============================================================================
// Team Operations
// ============================================================================

/**
 * List all teams accessible with the API key
 */
export async function listTeams(
	apiKey: string
): Promise<FathomAPIResponse<FathomTeam[]>> {
	return fathomAPIRequest<FathomAPIResponse<FathomTeam[]>>(
		apiKey,
		'/teams'
	);
}

/**
 * Get team members
 */
export async function getTeamMembers(
	apiKey: string,
	teamId: string
): Promise<FathomAPIResponse<FathomTeamMember[]>> {
	return fathomAPIRequest<FathomAPIResponse<FathomTeamMember[]>>(
		apiKey,
		`/teams/${teamId}/members`
	);
}

// ============================================================================
// Batch Operations for Historical Import
// ============================================================================

/**
 * Fetch all meetings for a date range with pagination
 * Returns all meetings, handling pagination automatically
 */
export async function fetchAllMeetings(
	apiKey: string,
	options: ListMeetingsOptions = {}
): Promise<FathomMeeting[]> {
	const allMeetings: FathomMeeting[] = [];
	let cursor: string | undefined = options.cursor;
	let hasMore = true;

	while (hasMore) {
		const response = await listMeetings(apiKey, {
			...options,
			cursor,
			limit: options.limit || 100, // Max batch size
		});

		// API returns { items: [...], next_cursor: "...", limit: N }
		const responseData: any = response as any;
		const items = responseData.items || responseData.data || [];
		allMeetings.push(...items);

		hasMore = !!responseData.next_cursor;
		cursor = responseData.next_cursor;

		// Safety: prevent infinite loops
		if (allMeetings.length > 10000) {
			console.warn('Reached 10,000 meeting limit in fetchAllMeetings');
			break;
		}
	}

	return allMeetings;
}

/**
 * Fetch meeting with full details (meeting + transcript + summary)
 */
export async function fetchMeetingWithDetails(
	apiKey: string,
	meetingId: string
): Promise<{
	meeting: FathomMeeting;
	transcript?: FathomTranscript;
	summary?: FathomSummary;
	errors: string[];
}> {
	const errors: string[] = [];

	// Fetch meeting details
	const meeting = await getMeeting(apiKey, meetingId);

	// Try to fetch transcript (may not exist for all meetings)
	let transcript: FathomTranscript | undefined;
	try {
		transcript = await getMeetingTranscript(apiKey, meetingId);
	} catch (error) {
		errors.push(`Failed to fetch transcript: ${error instanceof Error ? error.message : String(error)}`);
	}

	// Try to fetch summary (may not exist for all meetings)
	let summary: FathomSummary | undefined;
	try {
		summary = await getMeetingSummary(apiKey, meetingId);
	} catch (error) {
		errors.push(`Failed to fetch summary: ${error instanceof Error ? error.message : String(error)}`);
	}

	return {
		meeting,
		transcript,
		summary,
		errors,
	};
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get date range for historical import (last N days)
 */
export function getDateRange(days: number): { start_date: string; end_date: string } {
	const end = new Date();
	const start = new Date();
	start.setDate(start.getDate() - days);

	return {
		start_date: start.toISOString(),
		end_date: end.toISOString(),
	};
}

/**
 * Get date range for specific period
 */
export function getCustomDateRange(
	startDate: Date,
	endDate: Date
): { start_date: string; end_date: string } {
	return {
		start_date: startDate.toISOString(),
		end_date: endDate.toISOString(),
	};
}

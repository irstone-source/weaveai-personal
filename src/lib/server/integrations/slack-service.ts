/**
 * Slack Integration Service
 *
 * Handles importing Slack thread conversations as client interactions
 */

import { WebClient } from '@slack/web-api';
import { db } from '$lib/server/db/index.js';
import { slackIntegrations, slackThreads, clientInteractions } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

interface SlackThread {
	threadTs: string;
	channelId: string;
	channelName: string;
	messages: any[];
	participants: string[];
}

export class SlackService {
	private client: WebClient;

	constructor(
		private userId: string,
		private accessToken: string
	) {
		this.client = new WebClient(accessToken);
	}

	/**
	 * Import threads from a specific channel
	 */
	async importThreadsFromChannel(
		channelId: string,
		options: {
			since?: Date;
			limit?: number;
		} = {}
	): Promise<{ success: boolean; imported: number; error?: string }> {
		try {
			const { since, limit = 50 } = options;

			// Get channel info
			const channelInfo = await this.client.conversations.info({
				channel: channelId
			});

			if (!channelInfo.ok || !channelInfo.channel) {
				return { success: false, imported: 0, error: 'Channel not found' };
			}

			const channelName = channelInfo.channel.name || 'unknown';

			// Get channel history
			const history = await this.client.conversations.history({
				channel: channelId,
				limit,
				oldest: since ? Math.floor(since.getTime() / 1000).toString() : undefined
			});

			if (!history.ok || !history.messages) {
				return { success: false, imported: 0, error: 'Failed to fetch messages' };
			}

			// Find thread roots (messages with replies)
			const threadRoots = history.messages.filter(msg =>
				msg.thread_ts && msg.thread_ts === msg.ts && (msg.reply_count || 0) > 0
			);

			let imported = 0;

			// Import each thread
			for (const root of threadRoots) {
				const threadTs = root.thread_ts || root.ts;
				if (!threadTs) continue;

				// Check if already imported
				const existing = await db.query.slackThreads.findFirst({
					where: eq(slackThreads.slackThreadTs, threadTs)
				});

				if (existing) continue;

				// Fetch full thread
				const thread = await this.client.conversations.replies({
					channel: channelId,
					ts: threadTs
				});

				if (!thread.ok || !thread.messages) continue;

				// Extract participants
				const participants = [...new Set(
					thread.messages
						.map(m => m.user)
						.filter(Boolean)
				)] as string[];

				// Create combined content
				const content = this.formatThreadContent(thread.messages, channelName);

				// Get first and last message timestamps
				const timestamps = thread.messages
					.map(m => m.ts)
					.filter(Boolean)
					.map(ts => new Date(parseFloat(ts!) * 1000));

				const firstMessageAt = timestamps[0];
				const lastMessageAt = timestamps[timestamps.length - 1];

				// Create client interaction
				const [interaction] = await db.insert(clientInteractions).values({
					userId: this.userId,
					interactionType: 'slack_thread',
					interactionDate: firstMessageAt || new Date(),
					notes: content,
					metadata: {
						source: 'slack',
						channelId,
						channelName,
						threadTs,
						participants,
						messageCount: thread.messages.length
					}
				}).returning();

				// Create slack thread record
				await db.insert(slackThreads).values({
					slackIntegrationId: await this.getIntegrationId(),
					clientInteractionId: interaction?.id,
					slackThreadTs: threadTs,
					channelId,
					channelName,
					messageCount: thread.messages.length,
					participantCount: participants.length,
					firstMessageAt,
					lastMessageAt,
					metadata: { participants }
				});

				imported++;
			}

			return { success: true, imported };
		} catch (error) {
			console.error('[Slack Service] Import error:', error);
			return {
				success: false,
				imported: 0,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * List accessible channels
	 */
	async listChannels(): Promise<Array<{ id: string; name: string; is_member: boolean }>> {
		try {
			const result = await this.client.conversations.list({
				types: 'public_channel,private_channel',
				exclude_archived: true,
				limit: 100
			});

			if (!result.ok || !result.channels) {
				return [];
			}

			return result.channels.map(ch => ({
				id: ch.id || '',
				name: ch.name || 'unknown',
				is_member: ch.is_member || false
			}));
		} catch (error) {
			console.error('[Slack Service] List channels error:', error);
			return [];
		}
	}

	/**
	 * Format thread messages into readable content
	 */
	private formatThreadContent(messages: any[], channelName: string): string {
		let content = `# Slack Thread from #${channelName}\n\n`;

		for (const msg of messages) {
			const user = msg.user || 'Unknown';
			const timestamp = msg.ts ? new Date(parseFloat(msg.ts) * 1000).toLocaleString() : '';
			const text = msg.text || '';

			content += `**${user}** (${timestamp}):\n${text}\n\n`;
		}

		return content;
	}

	/**
	 * Get integration ID for current user
	 */
	private async getIntegrationId(): Promise<string> {
		const integration = await db.query.slackIntegrations.findFirst({
			where: eq(slackIntegrations.userId, this.userId)
		});

		if (!integration) {
			throw new Error('Slack integration not found');
		}

		return integration.id;
	}
}

/**
 * Create Slack service instance for a user
 */
export async function createSlackService(userId: string): Promise<SlackService | null> {
	const integration = await db.query.slackIntegrations.findFirst({
		where: eq(slackIntegrations.userId, userId)
	});

	if (!integration) {
		return null;
	}

	return new SlackService(userId, integration.accessToken);
}

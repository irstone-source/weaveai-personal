# Implementation Guide: Options B-E

This guide provides detailed implementation instructions for the remaining Linear Intelligence Platform enhancements.

## Status Summary

- ✅ **Option A: Linear Mutation Tools** - COMPLETED
- 📋 **Option B: Slack Integration** - Ready to implement
- 📋 **Option C: Smart Filtering & Analytics** - Ready to implement
- 📋 **Option D: Multi-Client Comparison** - Ready to implement
- 📋 **Option E: Email Integration** - Ready to implement

---

## Option B: Slack Integration

**Goal:** Import Slack threads as interactions to enrich RAG context with team discussions.

### Step 1: Add Slack Integration Schema

Add to `/src/lib/server/db/schema.ts` (after `linearIntegrations`):

```typescript
export const slackIntegrations = pgTable("slack_integration", {
	id: text("id").primaryKey().$defaultFn(() => randomUUID()),
	userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
	workspaceName: text("workspaceName").notNull(),
	workspaceId: text("workspaceId").notNull().unique(),
	botToken: text("botToken").notNull(), // xoxb- token
	appId: text("appId"),
	teamId: text("teamId"),
	lastSyncAt: timestamp("lastSyncAt", { mode: "date" }),
	syncEnabled: boolean("syncEnabled").notNull().default(true),
	metadata: json("metadata").$type<{
		channelsToSync?: string[]; // Channel IDs to monitor
		autoSync?: boolean;
		syncFrequency?: string;
		[key: string]: any;
	}>().notNull().default({}),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
	userIdIdx: index('slack_integration_user_id_idx').on(table.userId),
	workspaceIdIdx: index('slack_workspace_id_idx').on(table.workspaceId),
}));

export const slackChannels = pgTable("slack_channel", {
	id: text("id").primaryKey().$defaultFn(() => randomUUID()),
	slackIntegrationId: text("slackIntegrationId").notNull()
		.references(() => slackIntegrations.id, { onDelete: "cascade" }),
	channelId: text("channelId").notNull(),
	channelName: text("channelName").notNull(),
	isPrivate: boolean("isPrivate").notNull().default(false),
	linkedTeamId: text("linkedTeamId") // Link to Linear team
		.references(() => linearTeamMappings.id, { onDelete: "set null" }),
	syncEnabled: boolean("syncEnabled").notNull().default(true),
	lastSyncedMessageTs: text("lastSyncedMessageTs"), // Last message timestamp synced
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
	integrationIdIdx: index('slack_channel_integration_id_idx').on(table.slackIntegrationId),
	channelIdIdx: index('slack_channel_id_idx').on(table.channelId),
}));
```

### Step 2: Install Slack SDK

```bash
npm install @slack/web-api
```

### Step 3: Create Slack Service

Create `/src/lib/server/integrations/slack-service.ts`:

```typescript
import { WebClient } from '@slack/web-api';
import { db } from '$lib/server/db';
import { slackIntegrations, slackChannels, interactions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export class SlackService {
	private client: WebClient;

	constructor(private userId: string, private botToken: string) {
		this.client = new WebClient(botToken);
	}

	/**
	 * Fetch conversations from a channel
	 */
	async fetchChannelMessages(channelId: string, options?: {
		limit?: number;
		oldest?: string; // Timestamp
		latest?: string;
	}) {
		try {
			const result = await this.client.conversations.history({
				channel: channelId,
				limit: options?.limit || 100,
				oldest: options?.oldest,
				latest: options?.latest,
			});

			return result.messages || [];
		} catch (error) {
			console.error('[Slack Service] Failed to fetch messages:', error);
			throw error;
		}
	}

	/**
	 * Fetch thread replies
	 */
	async fetchThreadReplies(channelId: string, threadTs: string) {
		try {
			const result = await this.client.conversations.replies({
				channel: channelId,
				ts: threadTs,
			});

			return result.messages || [];
		} catch (error) {
			console.error('[Slack Service] Failed to fetch thread:', error);
			throw error;
		}
	}

	/**
	 * Get channel info
	 */
	async getChannelInfo(channelId: string) {
		try {
			const result = await this.client.conversations.info({
				channel: channelId,
			});

			return result.channel;
		} catch (error) {
			console.error('[Slack Service] Failed to get channel info:', error);
			throw error;
		}
	}

	/**
	 * List channels in workspace
	 */
	async listChannels(types: string = 'public_channel,private_channel') {
		try {
			const result = await this.client.conversations.list({
				types,
				exclude_archived: true,
			});

			return result.channels || [];
		} catch (error) {
			console.error('[Slack Service] Failed to list channels:', error);
			throw error;
		}
	}

	/**
	 * Store thread as interaction
	 */
	async storeThreadAsInteraction(
		channelId: string,
		channelName: string,
		thread: any[],
		linkedTeamId?: string
	) {
		const firstMessage = thread[0];
		const allMessages = thread.map(m => `${m.user}: ${m.text}`).join('\n\n');

		// Find or create client profile based on linkedTeamId
		let clientProfileId: string | null = null;
		if (linkedTeamId) {
			// Logic to find/create client profile from Linear team mapping
		}

		const interaction = await db.insert(interactions).values({
			userId: this.userId,
			clientProfileId,
			interactionType: 'slack_thread',
			sourceId: firstMessage.ts,
			sourceUrl: `slack://channel?team=${channelId}&id=${channelId}&message=${firstMessage.ts}`,
			title: `Slack: ${channelName} - ${firstMessage.text?.substring(0, 100)}`,
			content: allMessages,
			participants: thread.map(m => ({ name: m.user })),
			metadata: {
				slackChannelId: channelId,
				slackChannelName: channelName,
				threadTs: firstMessage.ts,
				messageCount: thread.length,
			},
			interactionDate: new Date(parseFloat(firstMessage.ts) * 1000),
		}).returning();

		return interaction[0];
	}
}

/**
 * Create Slack service for a user
 */
export async function createSlackService(userId: string): Promise<SlackService | null> {
	try {
		const integration = await db.query.slackIntegrations.findFirst({
			where: eq(slackIntegrations.userId, userId)
		});

		if (!integration || !integration.botToken) {
			console.error('[Slack Service] No Slack integration found for user');
			return null;
		}

		return new SlackService(userId, integration.botToken);
	} catch (error) {
		console.error('[Slack Service] Failed to create service:', error);
		return null;
	}
}
```

### Step 4: Create Slack Import Job

Create `/src/lib/server/integrations/slack-import.ts`:

```typescript
import { db } from '$lib/server/db';
import { slackIntegrations, slackChannels } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createSlackService } from './slack-service';

export async function importSlackThreads(userId: string, options?: {
	channelId?: string;
	hoursBack?: number;
}) {
	const slackService = await createSlackService(userId);
	if (!slackService) {
		return { success: false, error: 'Slack not connected' };
	}

	const integration = await db.query.slackIntegrations.findFirst({
		where: eq(slackIntegrations.userId, userId)
	});

	if (!integration) {
		return { success: false, error: 'Integration not found' };
	}

	// Get channels to sync
	let channels = await db.query.slackChannels.findMany({
		where: eq(slackChannels.slackIntegrationId, integration.id)
	});

	if (options?.channelId) {
		channels = channels.filter(c => c.channelId === options.channelId);
	}

	let importedCount = 0;
	const errors: string[] = [];

	for (const channel of channels) {
		if (!channel.syncEnabled) continue;

		try {
			// Calculate oldest timestamp
			const hoursBack = options?.hoursBack || 24;
			const oldest = (Date.now() / 1000 - hoursBack * 3600).toString();

			// Fetch messages
			const messages = await slackService.fetchChannelMessages(channel.channelId, {
				oldest: channel.lastSyncedMessageTs || oldest,
				limit: 100
			});

			// Find threads
			const threads = messages.filter(m => m.thread_ts && m.thread_ts === m.ts);

			for (const threadStart of threads) {
				const threadMessages = await slackService.fetchThreadReplies(
					channel.channelId,
					threadStart.ts!
				);

				if (threadMessages.length > 1) { // Only store threads with replies
					await slackService.storeThreadAsInteraction(
						channel.channelId,
						channel.channelName,
						threadMessages,
						channel.linkedTeamId || undefined
					);
					importedCount++;
				}
			}

			// Update last synced timestamp
			if (messages.length > 0) {
				const latestTs = messages[0].ts;
				await db.update(slackChannels)
					.set({ lastSyncedMessageTs: latestTs })
					.where(eq(slackChannels.id, channel.id));
			}

		} catch (error) {
			console.error(`[Slack Import] Failed for channel ${channel.channelName}:`, error);
			errors.push(`${channel.channelName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	return {
		success: true,
		importedCount,
		channelsProcessed: channels.length,
		errors
	};
}
```

### Step 5: Add to Cron Jobs

Update `/src/lib/server/cron/linear-sync-jobs.ts` to include:

```typescript
export async function importSlackThreadsJob(): Promise<CronJobResult> {
	const startTime = Date.now();
	const results: any[] = [];
	const errors: string[] = [];

	try {
		// Get all users with Slack integrations
		const integrations = await db.query.slackIntegrations.findMany({
			where: eq(slackIntegrations.syncEnabled, true)
		});

		for (const integration of integrations) {
			try {
				const result = await importSlackThreads(integration.userId, {
					hoursBack: 24 // Last 24 hours
				});
				results.push(result);
			} catch (error) {
				const err = error as Error;
				errors.push(`User ${integration.userId}: ${err.message}`);
			}
		}

		return {
			success: true,
			usersProcessed: integrations.length,
			errors,
			duration: Date.now() - startTime
		};
	} catch (error) {
		const err = error as Error;
		return {
			success: false,
			usersProcessed: 0,
			errors: [err.message],
			duration: Date.now() - startTime
		};
	}
}
```

Update `vercel.json`:

```json
{
	"crons": [
		// ... existing crons
		{
			"path": "/api/cron/linear-sync?job=slack-import",
			"schedule": "0 */4 * * *"
		}
	]
}
```

### Step 6: OAuth Setup (Optional)

For production, implement Slack OAuth:

1. Create Slack app at https://api.slack.com/apps
2. Add bot scopes: `channels:history`, `channels:read`, `groups:history`, `groups:read`
3. Implement OAuth callback at `/api/integrations/slack/callback`
4. Store bot token in `slackIntegrations` table

---

## Option C: Smart Filtering & Analytics

**Goal:** Add intent detection, analytics dashboard, and query performance tracking.

### Implementation Steps:

1. **Intent Classification Service** (`/src/lib/server/ai/intent-classifier.ts`):
   - Classify user queries into intents: "status_update", "risk_analysis", "action_items", "decision_history"
   - Use lightweight LLM or keyword matching
   - Return intent + confidence score

2. **Analytics Tracking** (Modify `/src/routes/api/chat/+server.ts`):
   ```typescript
   // Track each RAG query
   await db.insert(ragAnalytics).values({
       userId,
       query: userMessage,
       intent: detectedIntent,
       contextsRetrieved: contexts.length,
       avgRelevanceScore: avgScore,
       responseTime: duration,
       clientProfileId: detectedClient?.id
   });
   ```

3. **Analytics Dashboard** (`/src/routes/(protected)/settings/linear-intelligence/analytics/+page.svelte`):
   - Display metrics: queries/day, avg relevance, sync health
   - Charts: query volume over time, intent distribution
   - Per-client breakdown

4. **Smart Filtering** (Enhance RAG retrieval):
   ```typescript
   const filters: any = {};

   if (intent === 'status_update') {
       filters.interactionType = ['linear_issue_update'];
       filters.dateRange = 'last_7_days';
   } else if (intent === 'risk_analysis') {
       filters.sentiment = 'negative';
       filters.priority = ['urgent', 'high'];
   }

   // Apply filters to Pinecone query
   ```

---

## Option D: Multi-Client Comparison

**Goal:** Query multiple Linear teams simultaneously and compare insights.

### Implementation:

1. **Update RAG Service** (`/src/lib/server/integrations/client-rag-service.ts`):
   ```typescript
   export async function queryMultipleClients(
       userId: string,
       query: string,
       teamIds: string[],
       options?: { topK?: number }
   ) {
       const results = await Promise.all(
           teamIds.map(async (teamId) => {
               const team = await getTeamMapping(teamId);
               if (!team?.pineconeIndexName) return null;

               const contexts = await queryPineconeIndex(
                   team.pineconeIndexName,
                   query,
                   options?.topK || 5
               );

               return {
                   teamId,
                   teamName: team.linearTeamName,
                   contexts
               };
           })
       );

       return results.filter(Boolean);
   }
   ```

2. **Comparison Formatter**:
   ```typescript
   function formatMultiClientComparison(results: MultiClientResult[]): string {
       let output = '# Multi-Client Analysis\n\n';

       for (const client of results) {
           output += `## ${client.teamName}\n\n`;
           output += `**Top Insights:**\n`;
           client.contexts.slice(0, 3).forEach((ctx, i) => {
               output += `${i + 1}. ${ctx.title} (${ctx.score}% relevant)\n`;
           });
           output += '\n';
       }

       output += '## Cross-Client Patterns\n';
       // Analyze common themes across clients

       return output;
   }
   ```

3. **UI Enhancement** (Chat interface):
   - Add multi-select dropdown for Linear teams
   - "Compare Across Clients" toggle
   - Side-by-side comparison view

---

## Option E: Email Integration

**Goal:** Import email threads as interactions (similar to Slack).

### Implementation (Mirror Slack Pattern):

1. **Schema**: Add `emailIntegrations`, `emailThreads` tables
2. **Gmail/Outlook OAuth**: Use respective APIs
3. **Email Parser**: Extract threads, participants, meeting notes
4. **Import Service**: Similar to `slack-import.ts`
5. **Cron Job**: Daily email sync

**Note:** This is lowest priority as meeting transcripts (Fathom) already capture most client communication context.

---

## Deployment Checklist

After implementing any option:

1. ✅ Run TypeScript check: `npx tsc --noEmit`
2. ✅ Test locally: `npm run dev`
3. ✅ Update `vercel.json` if adding cron jobs
4. ✅ Add environment variables to Vercel
5. ✅ Deploy: `npx vercel --prod`
6. ✅ Verify cron jobs in Vercel dashboard
7. ✅ Test integration via UI

---

## Estimated Implementation Time

- **Option B (Slack)**: 3-4 hours
- **Option C (Analytics)**: 2-3 hours
- **Option D (Multi-Client)**: 2 hours
- **Option E (Email)**: 3-4 hours

**Total**: ~10-13 hours for all remaining options

---

## Support & Troubleshooting

### Common Issues:

1. **Slack API Rate Limits**: Implement exponential backoff
2. **Token Expiry**: Refresh OAuth tokens automatically
3. **Large Thread Volumes**: Batch processing, pagination
4. **Embedding Costs**: Monitor OpenAI usage, implement caching

### Testing:

- Use Slack workspace test channels
- Mock API responses in development
- Test with small data volumes first
- Monitor Pinecone vector counts

---

## Next Steps

1. Choose priority: B (Slack) recommended for immediate value
2. Implement schema changes first (always)
3. Test service layer thoroughly before cron integration
4. Deploy incrementally (one option at a time)

For questions or issues, refer to:
- Option A implementation in `/src/lib/ai/tools/linear-tools.ts`
- Option C implementation in `OPTION_C_IMPLEMENTATION_SUMMARY.md`
- Existing integration patterns in `/src/lib/server/integrations/`

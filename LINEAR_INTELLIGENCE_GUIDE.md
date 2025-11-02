# Linear Intelligence Platform - Usage Guide

## Overview

This system provides a comprehensive Linear-to-Pinecone intelligence platform for agency client management. Each Linear team represents a client, and all their data (projects, issues, comments, meetings) is automatically synced, embedded, and stored in dedicated Pinecone indexes for semantic search.

## Architecture

```
Linear API (OAuth)
    ↓
Linear Sync Service (auto-discovers teams)
    ↓
PostgreSQL Cache (projects, issues, interactions)
    ↓
Pinecone Multi-Index Manager (one index per client)
    ↓
Client Intelligence Service (embeddings)
    ↓
Pinecone Indexes (client-acme-corp, client-startup-xyz, etc.)
    ↓
Chat API with RAG (context-aware responses)
```

## Quick Start

### 1. Initial Setup

```typescript
// User connects Linear via OAuth (already implemented)
// The integration is stored in linearIntegrations table
```

### 2. First Sync

```typescript
import { createLinearSyncService } from '$lib/server/integrations/linear-sync';

// Perform initial full sync
const syncService = await createLinearSyncService(userId);
const result = await syncService.fullSync({
  createPineconeIndexes: true  // Auto-create Pinecone indexes for each team
});

console.log('Sync completed:', result.stats);
// Output: { teamsCreated: 3, projectsCreated: 12, issuesCreated: 45, ... }
```

**What happens:**
- Fetches all Linear teams from the user's organization
- Auto-creates a `linearTeamMapping` for each team
- Creates a Pinecone index for each team: `client-{teamId}`
- Syncs all projects for each team
- Syncs all issues for each project
- Updates `lastSyncedAt` timestamps

### 3. Import Interactions

```typescript
import { createLinearImporter } from '$lib/server/integrations/interaction-importers/linear-importer';
import { createMeetingImporter } from '$lib/server/integrations/interaction-importers/meeting-importer';

// Get Linear integration
const integration = await db.query.linearIntegrations.findFirst({
  where: eq(linearIntegrations.userId, userId)
});

// Import Linear comments
const linearImporter = await createLinearImporter(userId, integration.accessToken);
const result = await linearImporter.importAllCommentsForTeam('linear-team-id-123');
console.log(`Imported ${result.imported} comments`);

// Import meetings
const meetingImporter = createMeetingImporter(userId);
const meetingResult = await meetingImporter.importAllUnimportedMeetings();
console.log(`Imported ${meetingResult.imported} meetings`);
```

### 4. Generate Embeddings & Store in Pinecone

```typescript
import { createClientIntelligenceService } from '$lib/server/integrations/client-intelligence-service';

const intelligence = createClientIntelligenceService(userId);

// Store all data for a specific team/client
const linearTeamId = 'team-abc-123';

// Store projects
await intelligence.storeAllProjectsForTeam(linearTeamId);

// Store issues for each project
const projects = await db.query.linearProjects.findMany({
  where: eq(linearProjects.linearTeamId, linearTeamId)
});

for (const project of projects) {
  await intelligence.storeAllIssuesForProject(project.id);
}

// Store interactions (comments, meetings)
await intelligence.storeAllInteractionsForTeam(linearTeamId);
```

### 5. Query Client Context (RAG)

```typescript
import { pineconeManager } from '$lib/server/integrations/pinecone-manager';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Get client's Pinecone index
const teamMapping = await db.query.linearTeamMappings.findFirst({
  where: eq(linearTeamMappings.linearTeamId, 'team-abc-123')
});

const index = await pineconeManager.getClientIndex(
  userId,
  teamMapping.linearTeamId,
  teamMapping.linearTeamName
);

// Generate query embedding
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'What are the high priority issues for the authentication feature?'
});

// Query Pinecone
const results = await index.query({
  vector: response.data[0].embedding,
  topK: 10,
  includeMetadata: true,
  filter: {
    type: { $eq: 'issue' },
    priority: { $gte: 3 }  // High priority
  }
});

// Use results as context for LLM
const context = results.matches
  .map(m => `${m.metadata.title}: ${m.metadata.description}`)
  .join('\n\n');

console.log('Relevant context:', context);
```

## Webhook Setup

### 1. Register Webhook in Linear

1. Go to Linear Settings > API > Webhooks
2. Create new webhook:
   - URL: `https://yourdomain.com/api/webhooks/linear`
   - Secret: Generate a random string
   - Events: Issue, Comment, Project

### 2. Store Webhook Secret

```typescript
await db.update(linearIntegrations)
  .set({
    webhookSecret: 'your-webhook-secret',
    webhookUrl: 'https://yourdomain.com/api/webhooks/linear',
    syncMode: 'webhook',
    autoSyncEnabled: true
  })
  .where(eq(linearIntegrations.userId, userId));
```

### 3. Webhook Endpoint

The endpoint at `/api/webhooks/linear` automatically:
- Verifies HMAC-SHA256 signature
- Routes events to appropriate handlers
- Triggers incremental sync for changed data

## API Endpoints

### Sync Endpoint (Manual)

Create `/src/routes/api/linear/sync/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import { createLinearSyncService } from '$lib/server/integrations/linear-sync';

export async function POST({ locals }) {
  const userId = locals.user.id;

  const syncService = await createLinearSyncService(userId);
  const result = await syncService.fullSync();

  return json(result);
}
```

### Team List Endpoint

```typescript
export async function GET({ locals }) {
  const userId = locals.user.id;

  const teams = await db.query.linearTeamMappings.findMany({
    where: eq(linearTeamMappings.userId, userId)
  });

  return json({ teams });
}
```

## Scheduled Jobs

### Daily Incremental Sync

```typescript
// cron job or scheduled task
import { createLinearSyncService } from '$lib/server/integrations/linear-sync';

async function dailySync() {
  const users = await db.query.users.findMany({
    where: isNotNull(users.linearIntegrationId)
  });

  for (const user of users) {
    const syncService = await createLinearSyncService(user.id);
    await syncService.incrementalSync();
  }
}
```

## Database Schema Reference

### linearTeamMappings
- `linearTeamId`: Linear's team ID
- `linearTeamName`: Team display name
- `pineconeIndexName`: e.g., "client-acme-corp"
- `syncEnabled`: Enable/disable sync for this team
- `autoCreated`: Was this mapping auto-created?
- `lastSyncAt`: Last sync timestamp

### linearProjects
- `linearProjectId`: Linear's project ID
- `linearTeamId`: Parent team
- `name`, `description`, `state`
- `lead`, `leadEmail`
- `pineconeId`: Pinecone vector ID
- `lastSyncedAt`: Last sync timestamp

### linearIssues
- `linearIssueId`: Linear's issue ID
- `linearProjectId`: Parent project (our internal ID)
- `identifier`: e.g., "ENG-123"
- `title`, `description`
- `status`, `statusType`, `priority`, `priorityLabel`
- `assignee`, `assigneeEmail`
- `labels`: JSON array of label objects
- `pineconeId`: Pinecone vector ID
- `url`: Linear issue URL

### interactions
- `interactionType`: linear_comment, linear_issue_update, fathom_meeting, google_meet, etc.
- `sourceId`: Original ID from source system
- `title`, `content`
- `participants`: JSON array of participant objects
- `sentiment`, `priority`, `tags`
- `metadata`: JSON with source-specific data (includes `linearTeamId`)
- `pineconeStored`: Has this been embedded?
- `pineconeId`: Pinecone vector ID
- `interactionDate`: When the interaction occurred

## Pinecone Index Structure

Each client index contains vectors with metadata:

### Project Vectors
```json
{
  "type": "project",
  "projectId": "uuid",
  "linearProjectId": "linear-id",
  "linearTeamId": "team-id",
  "name": "Authentication Redesign",
  "description": "Modernize auth system...",
  "state": "started",
  "lead": "John Doe",
  "leadEmail": "john@client.com"
}
```

### Issue Vectors
```json
{
  "type": "issue",
  "issueId": "uuid",
  "linearIssueId": "linear-id",
  "identifier": "ENG-123",
  "title": "Implement OAuth2 flow",
  "status": "In Progress",
  "priority": 2,
  "assignee": "Jane Smith",
  "url": "https://linear.app/..."
}
```

### Interaction Vectors
```json
{
  "type": "interaction",
  "interactionId": "uuid",
  "interactionType": "linear_comment",
  "title": "Comment on ENG-123",
  "content": "We should consider...",
  "sentiment": "positive",
  "tags": "linear,comment",
  "interactionDate": "2025-01-15T10:30:00Z"
}
```

## Filtering & Search Strategies

### Find High Priority Issues
```typescript
const results = await index.query({
  vector: queryEmbedding,
  topK: 5,
  filter: {
    type: { $eq: 'issue' },
    priority: { $gte: 2 },
    status: { $in: ['In Progress', 'Todo'] }
  }
});
```

### Find Recent Interactions
```typescript
const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const results = await index.query({
  vector: queryEmbedding,
  topK: 10,
  filter: {
    type: { $eq: 'interaction' },
    interactionDate: { $gte: oneWeekAgo.toISOString() }
  }
});
```

### Find Content by Assignee
```typescript
const results = await index.query({
  vector: queryEmbedding,
  topK: 10,
  filter: {
    assigneeEmail: { $eq: 'john@client.com' }
  }
});
```

## Best Practices

### 1. Sync Strategy
- **Initial setup**: Full sync with Pinecone index creation
- **Daily**: Incremental sync to catch any missed changes
- **Real-time**: Webhook-triggered syncs for immediate updates

### 2. Error Handling
All sync and import functions return structured results:
```typescript
{
  success: boolean,
  stats: { created: number, updated: number, skipped: number },
  errors: string[]
}
```

Always check `errors` array and log for debugging.

### 3. Rate Limiting
Linear API has rate limits. The sync service handles this gracefully but for large organizations:
- Sync teams sequentially, not in parallel
- Add delays between large batch operations
- Use incremental sync more frequently instead of full syncs

### 4. Pinecone Costs
Each client gets their own index. Monitor:
- Total number of vectors per index
- Query volume per client
- Consider index consolidation for small clients

### 5. Data Freshness
- Projects: Update when project state changes (webhook)
- Issues: Update on any change (webhook)
- Interactions: Immutable once created (no updates needed)

## Troubleshooting

### Issue: Team mappings not created
**Solution**: Run full sync with `createPineconeIndexes: true`

### Issue: Pinecone index doesn't exist
**Solution**:
```typescript
await pineconeManager.createClientIndex(userId, teamId, teamName);
```

### Issue: Embeddings not generated
**Solution**: Check OpenAI API key is set in environment variables

### Issue: Webhook signature verification fails
**Solution**: Verify webhook secret matches between Linear and database

### Issue: Interactions not appearing in Pinecone
**Solution**: Check that `metadata.linearTeamId` is set on interaction records

## Next Steps

1. **Implement RAG in Chat API**: Use context from client indexes
2. **Add Auto-Categorization**: LLM-based sentiment and tagging
3. **Build Linear Mutation Tools**: Create/update issues from chat
4. **Create Team Mapping UI**: Manage client relationships
5. **Add Slack Integration**: Import Slack threads as interactions

## Support

For issues or questions:
- Check logs for detailed error messages
- Verify database schema matches expected structure
- Ensure all environment variables are set
- Test Pinecone connectivity independently

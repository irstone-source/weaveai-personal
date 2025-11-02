# Linear Multi-Tenant Integration Setup Guide

## Architecture Overview

**Multi-Tenant Design**: Each Linear team = one client
- Your Linear workspace has multiple teams (CMB Finance, CMB Internal, Green Funnel, Stewart Golf, etc.)
- Each team gets its own integration record in the database
- Single webhook endpoint routes events to the correct team/client
- Data isolation per team/client maintained automatically

## Current Status

✅ **Webhook Created**: https://weaveai-enterprise-1ptibfx57-ians-projects-4358fa58.vercel.app/api/webhooks/linear
✅ **Webhook Enabled**: Active and receiving events
✅ **Webhook Secret**: `lin_wh_MFFICJquaM0H5vqRj6Ylt6BpuQB554QokXxroxQCIqvo`
✅ **Multi-Tenant Routing**: Webhook handler routes by teamId
✅ **Deployed**: Multi-tenant webhook handler live on Vercel

## Setup Instructions

### Step 1: Get Your Linear API Key

1. Go to https://linear.app/settings/api
2. Click "Create new personal API key"
3. Give it a descriptive name (e.g., "WeaveAI Multi-Tenant Integration")
4. Copy the API key (starts with `lin_api_`)

### Step 2: Run the Multi-Tenant Setup Script

This script will:
- Fetch ALL teams from your Linear workspace
- Create a database integration record for each team
- Configure webhook settings for each team
- Maintain data isolation per team/client

```bash
DATABASE_URL="postgresql://neondb_owner:npg_nkg3TcqswB7l@ep-cold-sunset-abnf9t6n-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" \
LINEAR_API_KEY="your_api_key_here" \
npx tsx setup-all-linear-teams.ts
```

### Expected Output

```
🔍 Fetching all teams from Linear...
✅ Found 15 teams in your Linear workspace

📋 Teams to configure:
   - CMB Finance (CMBF) - ID: team_abc123
   - CMB Internal (CMI) - ID: team_def456
   - Green Funnel (GRE) - ID: team_ghi789
   - Stewart Golf (SG) - ID: team_jkl012
   - ... and more

📝 Creating/updating integrations...
   ✅ Created: CMB Finance (CMBF)
   ✅ Created: CMB Internal (CMI)
   ✅ Created: Green Funnel (GRE)
   ✅ Created: Stewart Golf (SG)
   ...

✨ All teams configured successfully!
   Created: 15 new integrations
   Updated: 0 existing integrations
   Total: 15 teams

📝 Configuration:
   User: your-email@example.com
   Webhook Secret: lin_wh_MFFICJquaM0H5vqRj6Ylt6BpuQB554QokXxroxQCIqvo
   Webhook URL: https://weaveai-enterprise-1ptibfx57-ians-projects-4358fa58.vercel.app/api/webhooks/linear
   Sync Mode: webhook

✅ Webhook Status:
   ✓ Webhook created in Linear
   ✓ Webhook enabled
   ✓ Database integration records configured for ALL teams
   ✓ Events: Issue, Comment, Attachment, ProjectUpdate, Cycle, Project

🎯 Multi-Tenant Architecture:
   ✓ Each Linear team = one client
   ✓ All teams share the same webhook endpoint
   ✓ Webhook handler routes events by teamId
   ✓ Data is isolated per team/client
```

## How It Works

### 1. Webhook Receives Event
When Linear sends a webhook event (issue created, comment added, etc.):

### 2. Team ID Extraction
The webhook handler extracts the team ID from the event:
- Issues: `event.data.team.id`
- Comments: `event.data.issue.team.id`

### 3. Multi-Tenant Routing
The webhook finds the correct integration record by matching `teamId`:

```typescript
const integration = await db.query.linearIntegrations.findFirst({
  where: eq(linearIntegrations.teamId, teamId)
});
```

### 4. Data Isolation
Each team's data is stored separately:
- Issues tagged with correct team's `linearProjectId`
- Comments linked to correct user's `userId`
- All data scoped by team/client

### 5. Verification
Webhook signature verification ensures authenticity:
```typescript
verifyWebhookSignature(rawBody, signature, integration.webhookSecret)
```

## Testing

### Test Individual Team

Create or update an issue in any Linear team:

1. Go to Linear → Select any team (e.g., "Green Funnel")
2. Create a new issue or update an existing one
3. Check Vercel logs to see the webhook event
4. Verify database sync for that specific team

Expected log output:
```
[Linear Webhook] Received: Issue create
[Linear Webhook] Team ID: team_ghi789
[Linear Webhook] Routing to integration: Green Funnel (team_ghi789)
[Linear Webhook] Processing Issue: create GRE-123
[Linear Webhook] Created issue: GRE-123
```

### Test Multiple Teams

Create issues in different teams to verify isolation:

1. Create issue in "CMB Finance" → should sync to CMB Finance data
2. Create issue in "Green Funnel" → should sync to Green Funnel data
3. Create issue in "Stewart Golf" → should sync to Stewart Golf data

Each should be isolated and routed correctly.

## Database Schema

### linearIntegrations Table
Each team gets one record:

```sql
CREATE TABLE linear_integration (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL REFERENCES users(id),
  accessToken TEXT NOT NULL,  -- Your Linear API key
  teamId TEXT NOT NULL,       -- Linear team ID (for routing)
  teamName TEXT NOT NULL,     -- Human-readable team name
  webhookSecret TEXT,         -- Webhook verification secret
  webhookUrl TEXT,            -- Webhook endpoint URL
  syncMode TEXT DEFAULT 'webhook',
  autoSyncEnabled BOOLEAN DEFAULT true,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);
```

### Multi-Tenant Data Flow

```
Linear Team: CMB Finance (team_abc123)
  ↓
Webhook Event → Extract team_abc123
  ↓
Find integration WHERE teamId = 'team_abc123'
  ↓
Sync to CMB Finance's data
  ↓
linearIssues, linearProjects, interactions
```

## Webhook Events Supported

Your webhook is configured to receive:
- ✅ Issues (create, update, delete)
- ✅ Comments (create, update, delete)
- ✅ Projects (create, update)
- ✅ Cycles (create, update)
- ✅ Attachments (create, update)

## Monitoring

### Check Webhook Status
Visit: https://linear.app/settings/webhooks

### View Logs
```bash
npx vercel logs --follow
```

Filter by team:
```bash
npx vercel logs --follow | grep "Green Funnel"
npx vercel logs --follow | grep "CMB Finance"
```

### Debug Individual Team
Check which teams are configured:
```bash
DATABASE_URL="..." npx tsx -e "
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { linearIntegrations } from './src/lib/server/db/schema.js';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);
const teams = await db.select().from(linearIntegrations);
console.log('Configured teams:', teams.map(t => `${t.teamName} (${t.teamId})`));
await client.end();
"
```

## Troubleshooting

### Issue: Events not syncing for a specific team

**Check 1**: Verify integration exists
```sql
SELECT teamName, teamId, webhookSecret
FROM linear_integration
WHERE teamId = 'your_team_id';
```

**Check 2**: Check Vercel logs for the team
```bash
npx vercel logs | grep "Team ID: your_team_id"
```

**Check 3**: Verify webhook is receiving events
```bash
curl https://weaveai-enterprise-1ptibfx57-ians-projects-4358fa58.vercel.app/api/webhooks/linear
# Should return: {"status":"ok","service":"Linear Webhook Receiver","timestamp":"..."}
```

### Issue: Webhook signature verification failing

**Solution**: Re-run setup script to update webhook secret:
```bash
DATABASE_URL="..." LINEAR_API_KEY="..." npx tsx setup-all-linear-teams.ts
```

### Issue: New team not syncing

**Solution**: Run setup script again to add new team:
```bash
DATABASE_URL="..." LINEAR_API_KEY="..." npx tsx setup-all-linear-teams.ts
```

The script will detect existing teams and only create new ones.

## Security

### Webhook Secret
- Stored securely in database per team
- Used for HMAC-SHA256 signature verification
- Prevents unauthorized webhook calls

### API Key
- Stored encrypted in database
- Used only for Linear API mutations
- Scoped per team via integration record

### Multi-Tenant Isolation
- Team ID used as isolation boundary
- Cross-team data leakage prevented by WHERE clauses
- Each team's data strictly isolated

## Next Steps

1. **Run the setup script** to configure all teams
2. **Test with one team** by creating an issue
3. **Monitor logs** to verify routing
4. **Verify database sync** for each team
5. **Enable AI tools** to interact with Linear per client

## AI Integration

Once teams are configured, AI can interact with each client's Linear:

```typescript
// Create issue for specific client/team
await linear_create_issue({
  teamId: 'team_ghi789',  // Green Funnel
  title: 'New feature request',
  description: 'From AI conversation'
});

// Comment on client's issue
await linear_add_comment({
  issueId: 'GRE-123',
  body: 'AI-generated response based on client context'
});
```

The system automatically:
- Routes to correct team's integration
- Uses correct API key for that team
- Syncs back via webhook to correct database records

## Summary

**Before**: Single team, manual setup required
**After**: All teams auto-configured, full multi-tenant support

**Key Benefits**:
- ✅ One webhook endpoint for all clients
- ✅ Automatic routing by team ID
- ✅ Data isolation per client
- ✅ Scalable to unlimited teams
- ✅ Real-time sync via webhooks
- ✅ AI can interact with any client's Linear

**Ready to Go**:
1. Get Linear API key
2. Run `setup-all-linear-teams.ts`
3. Test with any team
4. Monitor and verify

That's it! Your multi-tenant Linear integration is ready to handle all your clients.

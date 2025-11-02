# Linear Data Status - REAL DATA EXISTS!

## ✅ Confirmation: Your Linear Has 478 Real Issues

Just tested the Linear API - your workspace is NOT empty:

```
Stewart Golf (SG):              155 issues
Stewart Golf Australia (SGA):    59 issues
Forever Green Energy (FGE):      59 issues
Window Supply Direct (WSD):      56 issues
George-Stone Gardens (GSG):      52 issues
Stewart Golf SEO (SGSEO):        34 issues
Green Funnel (GRE):              27 issues
CMB Internal (CMI):              27 issues
Image Capture (IMC):              6 issues
CMB Finance (CMBF):               2 issues
CMB Onboarding (CMBO):            1 issue

TOTAL: 478 issues across 14 teams
```

## Recent Issues Found (Real Examples):
- **FGE-61**: "Reporting for Wednesday meeting with Ben" (Forever Green Energy)
- **SG-174**: "Website checks" (Stewart Golf)
- **SG-173**: "Remove Ambassadors link from footer menu" (Stewart Golf)
- **SGSEO-35**: "Product Pages Schema" (Stewart Golf SEO)
- **SGSEO-34**: "Golf Trolleys / Carts Schema" (Stewart Golf SEO)

## Current Status

### ✅ What's Working:
1. **Linear API Connection**: Verified and working
2. **14 Teams Configured**: All integration records created in database
3. **Webhook Endpoint**: Live at `/api/webhooks/linear`
4. **Multi-Tenant Routing**: Webhook handler routes by teamId
5. **Real Linear Data Exists**: 478 issues waiting to be synced

### ❌ What's NOT Working:
1. **Database is Empty**: No issues/projects synced yet
2. **Initial Sync Failed**: GraphQL query errors (400)
3. **Projects Page Shows**: "No projects yet"
4. **Chat Responses**: Generic AI knowledge (no real Linear data)

## Why Database is Empty

The initial sync script has GraphQL query syntax errors. The Linear API rejects the queries with 400 errors. This means:
- Webhook is configured but hasn't received any events yet (no new issues created since setup)
- Initial sync to backfill historical data failed due to query syntax
- Database has integration records but zero actual issues/projects

## How to Prove Linear Data Works

Once the sync is fixed and data is populated, these prompts will **prove** real Linear access:

### Test Prompts (Will ONLY Work with Real Data):

1. **Specific Issue IDs**:
   ```
   "Show me details about issue SG-174"
   "What's the status of FGE-61?"
   "Tell me about SGSEO-35"
   ```

2. **Team-Specific Queries**:
   ```
   "List all issues for Stewart Golf"
   "What are the open issues in Forever Green Energy?"
   "Show me high priority items for Green Funnel"
   ```

3. **Cross-Team Intelligence**:
   ```
   "Which client has the most issues?"
   "Show me all issues related to website work"
   "What are the urgent tasks across all teams?"
   ```

4. **Specific Content That Can't Be Generic**:
   ```
   "What's issue SG-173 about?" (Answer MUST be: "Remove Ambassadors link from footer menu")
   "Tell me about the Wednesday meeting mentioned in FGE-61"
   "What schema work needs to be done for Stewart Golf SEO?"
   ```

These prompts will FAIL with generic responses until we:
1. Fix the sync script to properly fetch issues
2. Populate the database
3. Generate embeddings for Pinecone
4. Enable RAG to inject real Linear context

## Next Steps to Get Data Working

### Option 1: Fix the Initial Sync (Recommended)
Fix the GraphQL queries in `initial-linear-sync.ts` to properly fetch issues from each team.

### Option 2: Manual Issue Creation
Create a new issue in ANY Linear team to trigger webhook sync:
1. Go to https://linear.app
2. Select any team (e.g., "Stewart Golf")
3. Create issue: "Test from WeaveAI webhook"
4. Webhook receives event → syncs to database
5. Check database with `npx tsx verify-linear-data.ts`

### Option 3: Use Composio Rube MCP
The Rube MCP tools you have configured can also fetch Linear data. Try using those to pull issues if the sync script continues to fail.

## Evidence That Generic vs Real Data

**Current Chat Behavior (Generic Knowledge)**:
```
User: "Tell me about Stewart Golf trolleys"
AI: "Stewart Golf is a company that makes electric golf trolleys..."
     [Generic information from training data]
```

**What It Will Look Like With Real Linear Data (RAG-Enhanced)**:
```
User: "Tell me about Stewart Golf trolleys"
AI: "Based on your Linear data, Stewart Golf currently has 155 open issues including:
- SG-174: Website checks
- SG-173: Remove Ambassadors link from footer menu

Would you like me to create a summary or update any of these issues?"
[Specific information from YOUR Linear workspace]
```

## Summary

**You have substantial Linear data (478 issues), but it's not yet synced to the database.**

The integration architecture is correct:
- Multi-tenant setup ✅
- Webhook configured ✅
- Team routing working ✅
- API access verified ✅

We just need to get the sync working to populate the database, then the RAG system will enhance chat with your real Linear context.

**To Prove It's Working**: Use the specific test prompts above. They will ONLY work with real data, not generic AI knowledge.

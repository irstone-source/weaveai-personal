# Linear Multi-Tenant Integration - Quick Start

## Status: Ready to Configure

✅ **Webhook Endpoint Deployed**: https://weaveai-enterprise-jr614ymwd-ians-projects-4358fa58.vercel.app/api/webhooks/linear
✅ **Webhook Created in Linear**: Enabled and active
✅ **Multi-Tenant Support**: Routes events by team ID
✅ **Production URL**: https://weaveai-enterprise-jr614ymwd-ians-projects-4358fa58.vercel.app

## What You Need

1. **Linear API Key** - Get from https://linear.app/settings/api
2. **Database URL** - You already have this: `postgresql://neondb_owner:npg_nkg3TcqswB7l@ep-cold-sunset-abnf9t6n-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require`

## One Command Setup

Run this single command to configure ALL your Linear teams:

```bash
DATABASE_URL="postgresql://neondb_owner:npg_nkg3TcqswB7l@ep-cold-sunset-abnf9t6n-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" \
LINEAR_API_KEY="your_api_key_here" \
npx tsx setup-all-linear-teams.ts
```

Replace `your_api_key_here` with your Linear API key.

## What This Does

1. Fetches ALL teams from your Linear workspace (CMB Finance, Green Funnel, Stewart Golf, etc.)
2. Creates a database integration record for each team
3. Configures webhook authentication for each team
4. Sets up multi-tenant routing automatically

## Expected Result

```
✅ Found 15 teams in your Linear workspace
✅ Created: 15 new integrations
🎯 Multi-Tenant Architecture:
   ✓ Each Linear team = one client
   ✓ All teams share the same webhook endpoint
   ✓ Webhook handler routes events by teamId
   ✓ Data is isolated per team/client
```

## Test It

1. Create an issue in ANY Linear team
2. Watch it sync to your database automatically
3. Check Vercel logs: `npx vercel logs`

## Need Help?

See `LINEAR_MULTI_TENANT_SETUP.md` for detailed documentation.

## Architecture

```
Linear Workspace (Green Signals)
├── CMB Finance (Team) → Database Integration Record
├── CMB Internal (Team) → Database Integration Record
├── Green Funnel (Team) → Database Integration Record
├── Stewart Golf (Team) → Database Integration Record
└── ... more teams → ... more records

All teams → Single Webhook → Multi-tenant router → Correct team data
```

## Key Benefits

- **One webhook for all clients** - No need to create separate webhooks
- **Automatic routing** - Events automatically go to the right team
- **Data isolation** - Each client's data is completely separate
- **Scalable** - Add unlimited teams without code changes
- **Real-time sync** - Linear updates sync instantly via webhooks

## You're Ready!

Just run the setup command with your Linear API key, and you're done.

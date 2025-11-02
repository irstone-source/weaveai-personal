# Linear OAuth Setup Guide

## Current Production Deployment

**Production URL:** `https://weaveai-enterprise-d0z69g9bs-ians-projects-4358fa58.vercel.app`

## Problem

Linear OAuth is showing "Invalid redirect_uri parameter for the application" error because the redirect URI in the OAuth request doesn't match what's configured in Linear's OAuth application settings.

## Solution

### Step 1: Configure Linear OAuth Application

1. Go to [Linear OAuth Applications](https://linear.app/settings/api/applications)

2. Either create a new OAuth application or edit your existing one

3. Set the **Redirect URI** to exactly:
   ```
   https://weaveai-enterprise-d0z69g9bs-ians-projects-4358fa58.vercel.app/api/integrations/linear/auth
   ```

   **Important:** The URL must match exactly, including:
   - Protocol: `https://`
   - No trailing slash
   - Exact path: `/api/integrations/linear/auth`

4. Save the application and copy:
   - Client ID
   - Client Secret

### Step 2: Configure Client ID and Secret

You have two options:

#### Option A: Add to Vercel Environment Variables (Recommended)

```bash
npx vercel env add LINEAR_CLIENT_ID production
# Paste your Linear Client ID when prompted

npx vercel env add LINEAR_CLIENT_SECRET production
# Paste your Linear Client Secret when prompted

# Redeploy to apply changes
npx vercel redeploy https://weaveai-enterprise-d0z69g9bs-ians-projects-4358fa58.vercel.app
```

#### Option B: Configure in Admin Settings UI

1. Login to production: https://weaveai-enterprise-d0z69g9bs-ians-projects-4358fa58.vercel.app/login
2. Navigate to Admin Settings > OAuth Providers
3. Enter your Linear Client ID and Client Secret
4. Click Save

### Step 3: Test the OAuth Flow

1. Go to: https://weaveai-enterprise-d0z69g9bs-ians-projects-4358fa58.vercel.app/projects

2. Click "Connect Linear"

3. You should be redirected to Linear's authorization page

4. After authorizing, you'll be redirected back to `/projects?linear_connected=true`

5. Click "Sync Linear" to import your projects and issues

## Using a Custom Domain (Optional but Recommended)

The current Vercel deployment URL changes with each deployment. For a more stable setup:

### Assign greensignals.io subdomain

```bash
# Add subdomain to project
npx vercel domains add app.greensignals.io weaveai-enterprise

# Update Linear OAuth redirect URI to:
https://app.greensignals.io/api/integrations/linear/auth
```

This will provide a stable URL that doesn't change between deployments.

## Troubleshooting

### "Invalid redirect_uri parameter"
- Verify the exact URL in Linear matches the redirect URI
- Check for trailing slashes or protocol differences (http vs https)
- Ensure you're using the most recent production deployment URL

### "Linear integration not found"
- Make sure Linear Client ID and Secret are configured (see Step 2)
- Check Vercel logs: `npx vercel logs --follow`

### "Failed to sync Linear issues"
- Verify your Linear API token has read permissions
- Check that your Linear team ID is correct
- Review server logs for detailed error messages

## Technical Details

### OAuth Flow

1. User clicks "Connect Linear" on `/projects` page
2. Redirects to `/api/integrations/linear/auth`
3. Server generates authorization URL with redirect_uri
4. Redirects to Linear OAuth authorization page
5. User authorizes the application
6. Linear redirects back to redirect_uri with authorization code
7. Server exchanges code for access token
8. Stores token and team info in database
9. Redirects user back to `/projects?linear_connected=true`

### Sync Process

1. User clicks "Sync Linear"
2. POST request to `/api/integrations/linear/sync`
3. Fetches projects from Linear GraphQL API
4. Fetches issues for each project
5. Maps Linear data to internal schema:
   - States: backlog → backlog, unstarted → todo, started → in_progress, completed → done, canceled → canceled
   - Priorities: 0 → no_priority, 1 → urgent, 2 → high, 3 → medium, 4 → low
6. Upserts projects to database
7. Updates lastSyncAt timestamp
8. Returns sync count and any errors

### Files Modified

- `/src/routes/api/integrations/linear/auth/+server.ts` - OAuth callback handler
- `/src/routes/api/integrations/linear/sync/+server.ts` - Sync endpoint
- `/src/lib/server/integrations/linear.ts` - Linear API integration
- `/src/routes/projects/+page.svelte` - Projects page UI with sync functionality

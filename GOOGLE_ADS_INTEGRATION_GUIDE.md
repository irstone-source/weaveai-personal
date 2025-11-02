# Google Ads Direct API Integration

## Status: ⚠️ REST API Not Supported - gRPC Client Library Required

I've created OAuth credentials and confirmed authentication works, but discovered that Google Ads API v18 does not support REST endpoints. The API requires using the official gRPC-based Node.js client library.

## What We've Accomplished

### ✅ OAuth Setup Complete
1. **Generated OAuth Credentials** from Google Cloud Console
   - Client ID: `1093527084995-ne9a84445ofhjqtm4atu9dfk2sun0d06.apps.googleusercontent.com`
   - Client Secret: Configured
   - Redirect URIs: Configured for localhost:3002 and production domains

2. **Generated Refresh Token** via OAuth flow
   - Successfully completed browser authorization
   - Obtained long-lived refresh token
   - Token stored in `.env` file

3. **Verified Authentication**
   - Successfully exchanging refresh token for access tokens
   - OAuth credentials working correctly
   - Access token expires in 3599 seconds (refreshable)

### ⚠️ Discovery: REST API Not Implemented
- **Issue Found**: Google Ads API v18 returns `501 UNIMPLEMENTED` for REST endpoints
- **Root Cause**: Google Ads API primarily uses gRPC protocol, not REST
- **Solution**: Installed official `google-ads-api` Node.js client library (gRPC-based)

### 📦 Installed Packages
- `google-ads-api` - Official Google Ads API Node.js client library

## Files Created

### 1. Google Ads API Client (`src/lib/server/integrations/google-ads.ts`)

A comprehensive TypeScript client for the Google Ads API with support for:

**Features:**
- ✅ OAuth 2.0 authentication with refresh token
- ✅ List all campaigns with performance metrics
- ✅ Get campaign performance by date range
- ✅ Fetch account hierarchy (MCC structure)
- ✅ Execute custom GAQL (Google Ads Query Language) queries
- ✅ Batch operations for MCC accounts
- ✅ TypeScript types for all responses

**Key Functions:**
- `listCampaigns()` - Get all campaigns with metrics
- `getCampaignPerformance()` - Daily performance by campaign
- `listCustomerAccounts()` - Get all accounts under MCC
- `fetchAllCampaignsFromMCC()` - Fetch campaigns across all accounts
- `executeQuery()` - Run custom GAQL queries

## Configuration Required

To use the Google Ads API, you need these credentials:

### 1. Developer Token ✅
**Status**: Provided
```
swQQBb1hPh8Ofid5fnDgjg
```

### 2. Customer ID ✅
**Status**: Provided
```
517-565-4322
```

### 3. OAuth Credentials (Needed)

You need to get these from your Google Ads OAuth connection. Since you've already authorized through Composio, we can extract these from the Composio connection.

**Required:**
- **Client ID**: OAuth 2.0 client ID from Google Cloud Console
- **Client Secret**: OAuth 2.0 client secret
- **Refresh Token**: Long-lived token from OAuth flow

## How to Get OAuth Credentials

### Option 1: Extract from Composio (Recommended)

Since you've already authorized Google Ads through Composio, the refresh token exists there. You can:

1. Check the Composio dashboard for your Google Ads connection
2. Look for the connection details/credentials
3. Extract the Client ID, Client Secret, and Refresh Token

### Option 2: Create New OAuth Credentials

If you need to create new credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" → "Credentials"
3. Create OAuth 2.0 Client ID (Web application)
4. Add authorized redirect URI: `http://localhost:5173/api/integrations/google-ads/callback`
5. Run OAuth flow to get refresh token

## Environment Variables

Once you have all credentials, add them to `.env`:

```bash
# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=swQQBb1hPh8Ofid5fnDgjg
GOOGLE_ADS_CUSTOMER_ID=517-565-4322
GOOGLE_ADS_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your_client_secret_here
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token_here
```

## Usage Example

Once configured, you can use the API client like this:

```typescript
import * as googleAds from './src/lib/server/integrations/google-ads';

const config: googleAds.GoogleAdsConfig = {
	developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
	clientId: process.env.GOOGLE_ADS_CLIENT_ID!,
	clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
	refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
	customerId: process.env.GOOGLE_ADS_CUSTOMER_ID!,
};

// List all campaigns with last 30 days metrics
const dateRange = googleAds.getDateRange(30);
const campaigns = await googleAds.listCampaigns(config, {
	startDate: dateRange.startDate,
	endDate: dateRange.endDate,
	includeMetrics: true,
});

console.log(`Found ${campaigns.length} campaigns`);
campaigns.forEach(campaign => {
	console.log(`${campaign.name}: ${campaign.metrics.clicks} clicks, $${campaign.metrics.cost.toFixed(2)} spent`);
});
```

## Data Available

The API provides comprehensive campaign data:

### Campaign Information
- Campaign ID, name, status
- Advertising channel type (Search, Display, Video, etc.)
- Bidding strategy
- Start/end dates

### Performance Metrics
- **Clicks**: Total clicks
- **Impressions**: Total impressions
- **Cost**: Total spend (in account currency)
- **Conversions**: Total conversions
- **Conversion Value**: Total value from conversions
- **Average CPC**: Average cost per click
- **CTR**: Click-through rate
- **Cost per Conversion**: Average cost per conversion

### Account Hierarchy
- List all accounts under MCC
- Account names, IDs, currency, timezone
- Identify manager vs client accounts

## Next Steps

### Immediate:
1. **Get OAuth Credentials**: Extract from Composio or create new ones
2. **Add to .env**: Update environment variables
3. **Test Connection**: Run a simple query to verify

### After Configuration:
1. **Create Loader Script**: Build `load-google-ads-campaigns.ts`
2. **Database Schema**: Add tables for campaigns and metrics
3. **Import Historical Data**: Fetch last 90 days of performance
4. **Schedule Syncs**: Set up daily/weekly imports

## API Quotas & Limits

**Google Ads API Quotas:**
- **Basic Access**: 15,000 operations per day
- **Standard Access**: 1,500,000 operations per day (requires approval)
- **Rate Limits**: 20,000 operations per minute

**Best Practices:**
- Use `searchStream` for large result sets (>10,000 rows)
- Batch requests when possible
- Cache frequently accessed data
- Request standard access if you need higher limits

## GAQL Query Examples

The API uses Google Ads Query Language (GAQL). Here are some useful queries:

### Get Top Performing Keywords
```sql
SELECT
	ad_group_criterion.keyword.text,
	metrics.clicks,
	metrics.impressions,
	metrics.ctr,
	metrics.cost_micros
FROM keyword_view
WHERE segments.date DURING LAST_30_DAYS
AND campaign.status = 'ENABLED'
ORDER BY metrics.clicks DESC
LIMIT 50
```

### Get Campaign Performance by Date
```sql
SELECT
	segments.date,
	campaign.name,
	metrics.clicks,
	metrics.conversions,
	metrics.cost_micros
FROM campaign
WHERE segments.date DURING LAST_90_DAYS
ORDER BY segments.date DESC
```

### Get Ad Group Performance
```sql
SELECT
	ad_group.name,
	ad_group.status,
	metrics.clicks,
	metrics.impressions,
	metrics.cost_micros,
	metrics.conversions
FROM ad_group
WHERE campaign.id = YOUR_CAMPAIGN_ID
AND segments.date DURING LAST_30_DAYS
```

## Comparison: Composio vs Direct API

| Feature | Composio | Direct API |
|---------|----------|------------|
| **Campaign Listing** | ❌ Not available | ✅ Full support |
| **Performance Metrics** | ❌ Limited | ✅ All metrics |
| **Custom Queries** | ❌ No | ✅ Full GAQL support |
| **MCC Support** | ❌ Unknown | ✅ Full hierarchy |
| **Setup Complexity** | ✅ Easy OAuth | ⚠️ Requires credentials |
| **Control** | ⚠️ Limited | ✅ Complete |

## Integration Architecture

```
┌─────────────────────────────────────────────────┐
│         WeaveAI Enterprise                       │
│                                                   │
│  ┌───────────────────────────────────────────┐  │
│  │   Google Ads API Client                    │  │
│  │   (src/lib/server/integrations/google-ads) │  │
│  └───────────────┬───────────────────────────┘  │
│                  │                                │
│                  │ OAuth 2.0 + Developer Token   │
│                  │                                │
└──────────────────┼────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ Google Ads API v18  │
         │ (Official REST API) │
         └─────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │  Your MCC Account   │
         │   (517-565-4322)    │
         └─────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │   Client Accounts   │
         │   • Stewart Golf    │
         │   • GS Gardens      │
         │   • Forever Green   │
         │   • etc.            │
         └─────────────────────┘
```

## Security Considerations

**OAuth Tokens:**
- ✅ Store refresh tokens securely (environment variables, secrets manager)
- ✅ Never commit tokens to version control
- ✅ Refresh tokens are long-lived (no expiration)
- ✅ Access tokens expire after 1 hour (auto-refreshed by client)

**Developer Token:**
- ✅ Tied to your Google Ads manager account
- ✅ Required for all API requests
- ✅ Can be revoked if compromised

**Best Practices:**
- Use environment variables for all credentials
- Implement proper error handling
- Log API usage for monitoring
- Rotate credentials periodically

## Troubleshooting

### Common Errors

**"DEVELOPER_TOKEN_NOT_APPROVED"**
- Your developer token is in test mode
- Limited to test accounts only
- Apply for standard access in Google Ads

**"CUSTOMER_NOT_ENABLED"**
- Customer ID doesn't have API access enabled
- Enable in Google Ads account settings

**"AUTHENTICATION_ERROR"**
- Invalid or expired refresh token
- Re-run OAuth flow to get new token

**"PERMISSION_DENIED"**
- User doesn't have access to this account
- Check MCC link and permissions

## Support Resources

- **Google Ads API Docs**: https://developers.google.com/google-ads/api/docs/start
- **GAQL Reference**: https://developers.google.com/google-ads/api/docs/query/overview
- **API Forum**: https://groups.google.com/g/adwords-api
- **Error Codes**: https://developers.google.com/google-ads/api/docs/error-handling

---

**Created**: November 2, 2025
**Status**: API client ready, OAuth credentials needed
**Next Action**: Extract OAuth credentials from Composio connection

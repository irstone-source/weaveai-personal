# Google Ads API Standard Access Application
## Design Documentation for WeaveAI Enterprise

**Company Name:** WeaveAI / Green Signals
**Business Model:** Marketing Performance Analytics & Reporting Platform
**Application Date:** November 2, 2025
**Developer Token:** swQQBb1hPh8Ofid5fnDgjg
**MCC Customer ID:** 517-565-4322

---

## Executive Summary

WeaveAI Enterprise is an internal-use marketing analytics platform designed to aggregate and visualize campaign performance data across multiple marketing channels (Google Ads, Meta Ads, LinkedIn Ads) for our managed client accounts. The platform provides unified dashboards, automated reporting, and AI-powered insights to help our internal marketing team optimize campaign performance across multiple client accounts managed under our MCC structure.

**Tool Classification:** Internal-Only Reporting Tool with Management Capabilities

**Primary Use Cases:**
1. Aggregate campaign performance metrics across multiple client accounts under our MCC
2. Generate automated performance reports and dashboards for internal review
3. Sync campaign status with inventory availability (pause/enable ads based on stock)
4. Monitor budget pacing and ROI across campaigns
5. AI-powered chat interface for querying campaign data

---

## Business Model & Use Case

### Company Overview

**WeaveAI / Green Signals** operates as a marketing services company managing Google Ads campaigns for multiple landscape and outdoor living clients, including:
- Stewart Golf
- GS Gardens (Green Signals Gardens)
- Forever Green Landscapes
- Additional landscaping and outdoor service companies

We manage all advertising through our Google Ads MCC account (517-565-4322) and require API access to:
- Pull performance data into our internal analytics platform
- Automate reporting for internal marketing team review
- Synchronize campaign status with client inventory systems
- Provide unified cross-channel performance dashboards

### Tool Access & Users

**Internal Users Only:**
- Marketing team members (5-10 users)
- Account managers reviewing client performance
- Executive team viewing performance summaries

**No External Access:**
- Clients do NOT access the tool directly
- Reports are generated internally and shared via email/PDF
- All API access is strictly for internal data aggregation

### Data Flow Architecture

```
┌─────────────────────────────────────────────────┐
│         Google Ads MCC (517-565-4322)           │
│                                                  │
│  ├── Stewart Golf (Client Account)              │
│  ├── GS Gardens (Client Account)                │
│  ├── Forever Green (Client Account)             │
│  └── ... (Additional Client Accounts)           │
└───────────────┬─────────────────────────────────┘
                │
                │ Google Ads API v18 (gRPC)
                │ Hourly Sync
                ▼
┌─────────────────────────────────────────────────┐
│      WeaveAI Enterprise Platform                 │
│                                                   │
│  ┌───────────────────────────────────────────┐  │
│  │   PostgreSQL Database (Neon)              │  │
│  │   - Campaign metrics (clicks, cost, etc.) │  │
│  │   - Daily performance snapshots           │  │
│  │   - Account hierarchy data                │  │
│  └───────────────┬───────────────────────────┘  │
│                  │                                │
│  ┌───────────────▼───────────────────────────┐  │
│  │   SvelteKit Web Application               │  │
│  │   - Performance dashboards                │  │
│  │   - AI chat interface (Anthropic Claude)  │  │
│  │   - Automated report generation           │  │
│  └───────────────────────────────────────────┘  │
│                                                   │
│  Internal Users Only (5-10 team members)         │
└───────────────────────────────────────────────────┘
                │
                │ Email/PDF Reports
                ▼
         Client Communication
    (External, not API-connected)
```

---

## Tool Design & Implementation

### Architecture Overview

**Technology Stack:**
- **Frontend:** SvelteKit 5 (TypeScript)
- **Backend:** Node.js with SvelteKit server-side API routes
- **Database:** PostgreSQL (Neon cloud hosting)
- **Google Ads Integration:** Official `google-ads-api` Node.js client library (gRPC)
- **AI/ML:** Anthropic Claude API for natural language queries
- **Authentication:** OAuth 2.0 with refresh token

**Implementation Files:**
- `src/lib/server/integrations/google-ads-client.ts` - Google Ads API wrapper
- `src/lib/server/db/schema.ts` - Database schema for campaigns and metrics
- `src/routes/api/sync/google-ads/+server.ts` - Scheduled sync endpoint
- `src/routes/(app)/analytics/+page.svelte` - Dashboard UI
- Deployed at: `https://app.greensignals.io`

### Data Synchronization Process

**Automated Sync Schedule:**
1. **Hourly Sync** (via cron job):
   - Fetch campaign list from all accounts under MCC
   - Pull last 24 hours of performance metrics
   - Update database with new metrics (upsert by date + campaign ID)
   - Check campaign status changes

2. **Daily Deep Sync** (midnight UTC):
   - Historical performance data (last 90 days)
   - Account hierarchy updates
   - Conversion tracking metrics
   - Budget pacing calculations

3. **Real-time Queries**:
   - AI chat interface queries API directly for current data
   - Fallback to cached database data if API rate limits approached

### Database Schema

**Tables Created:**
```sql
-- Campaign master data
CREATE TABLE google_ads_campaigns (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  advertising_channel_type TEXT,
  bidding_strategy_type TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Daily performance metrics
CREATE TABLE google_ads_campaign_metrics (
  id SERIAL PRIMARY KEY,
  campaign_id TEXT REFERENCES google_ads_campaigns(id),
  date DATE NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  conversions DECIMAL(10,2) DEFAULT 0,
  conversions_value DECIMAL(10,2) DEFAULT 0,
  average_cpc DECIMAL(10,2) DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  cost_per_conversion DECIMAL(10,2) DEFAULT 0,
  synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

-- Account hierarchy
CREATE TABLE google_ads_accounts (
  customer_id TEXT PRIMARY KEY,
  descriptive_name TEXT NOT NULL,
  currency_code TEXT,
  time_zone TEXT,
  manager BOOLEAN DEFAULT FALSE,
  parent_customer_id TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Services & Endpoints Used

### Google Ads API Resources Called

**1. Campaign Reporting (Primary Use Case)**
- **Resource:** `campaign`
- **Query Language:** GAQL (Google Ads Query Language)
- **Metrics Retrieved:**
  - `metrics.clicks`
  - `metrics.impressions`
  - `metrics.cost_micros`
  - `metrics.conversions`
  - `metrics.conversions_value`
  - `metrics.average_cpc`
  - `metrics.ctr`
  - `metrics.cost_per_conversion`

**Example Query:**
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  campaign.bidding_strategy_type,
  metrics.clicks,
  metrics.impressions,
  metrics.cost_micros,
  metrics.conversions,
  metrics.ctr
FROM campaign
WHERE campaign.status != 'REMOVED'
AND segments.date BETWEEN '2025-10-01' AND '2025-11-01'
ORDER BY campaign.id
```

**2. Account Hierarchy (MCC Structure)**
- **Resource:** `customer_client`
- **Purpose:** List all client accounts under MCC for batch reporting
- **Fields:** `customer_client.id`, `customer_client.descriptive_name`, `customer_client.manager`

**3. Customer Information**
- **Resource:** `customer`
- **Purpose:** Verify account access and retrieve account settings
- **Fields:** `customer.id`, `customer.descriptive_name`, `customer.currency_code`, `customer.time_zone`

**4. Campaign Management (Limited)**
- **Operation:** Update campaign status (enable/pause)
- **Use Case:** Pause campaigns when inventory is out of stock (via external inventory API sync)
- **Service:** Campaign mutation operations via gRPC client

---

## Required Minimum Functionality (RMF) Implementation

### Tool Classification: Internal-Only Tool

**Our tool qualifies as Internal-Only because:**
1. Used exclusively by employees within our organization
2. No external clients or third parties access the tool
3. Reports generated are shared externally, but tool access is restricted
4. Managed accounts are clients of our agency, accessed via MCC

**RMF Requirements:** According to Google's policy, Internal-Only tools have **no RMF requirements**. However, we have implemented reporting functionality to demonstrate responsible API usage.

### Implemented Functionality

#### Reporting Functionality (Implemented)

**Account/Campaign Level Reports:**
- Clicks, cost, impressions, conversions, conversion value
- Campaign status and channel type
- Date range filtering (custom date ranges)
- Account-level aggregation across MCC

**Dashboard Views:**
1. **Campaign Performance Dashboard**
   - Top campaigns by clicks, cost, conversions
   - Trend charts for key metrics (7, 30, 90-day views)
   - Budget pacing indicators
   - ROI calculations

2. **Account Overview**
   - List all client accounts under MCC
   - Account-level performance summaries
   - Currency and timezone information

3. **AI Chat Interface**
   - Natural language queries: "What were the top 5 campaigns last month?"
   - Automated data retrieval and analysis via Claude API
   - Contextual responses with metric comparisons

#### Management Functionality (Limited Implementation)

**Campaign Status Management:**
- Pause campaigns when products go out of stock (inventory sync)
- Enable campaigns when inventory is restocked
- Status changes logged in database for audit trail

**No Creation Functionality:**
- We do NOT create campaigns via API
- Campaign setup is performed manually in Google Ads UI
- API is strictly for reporting and limited status management

---

## User Interface & Screenshots

### Dashboard Mockup

**Main Analytics Dashboard:**
```
┌─────────────────────────────────────────────────────────────────┐
│  WeaveAI Enterprise - Google Ads Performance                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Date Range: Last 30 Days ▼]  [Account: All Accounts ▼]        │
│                                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │   Total      │ │   Total      │ │  Total       │             │
│  │   Clicks     │ │   Cost       │ │  Conversions │             │
│  │   12,547     │ │   $8,432.50  │ │   156        │             │
│  │   ↑ 12.3%    │ │   ↓ 5.2%     │ │   ↑ 8.7%     │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                   │
│  Campaign Performance (Top 10)                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Campaign Name         Clicks   Cost      Conv   ROI       │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Stewart Golf - Brand  3,456    $2,150    45     285%      │  │
│  │ GS Gardens - Search   2,890    $1,890    38     210%      │  │
│  │ Forever Green - Local 1,234    $890      12     145%      │  │
│  │ ...                                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Performance Trend (Last 30 Days)                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         [Line Chart: Clicks, Cost, Conversions]            │  │
│  │    ╱╲                                                       │  │
│  │   ╱  ╲    ╱╲                                                │  │
│  │  ╱    ╲  ╱  ╲                                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  AI Assistant                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 💬 Ask about campaign performance...                       │  │
│  │    "Which campaigns had the best ROI last week?"           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** Actual screenshots will be taken once Standard Access is approved and we can access production data. Currently in test mode, we cannot retrieve real campaign data for screenshots.

### AI Chat Interface Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Chat - Campaign Analysis                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  You: What were our top performing campaigns last month?        │
│                                                                   │
│  🤖 Claude: Based on data from October 2025, here are your      │
│     top 3 campaigns by ROI:                                      │
│                                                                   │
│     1. Stewart Golf - Brand Campaign                             │
│        • 3,456 clicks                                            │
│        • $2,150 spend                                            │
│        • 45 conversions                                          │
│        • 285% ROI                                                │
│                                                                   │
│     2. GS Gardens - Search Campaign                              │
│        • 2,890 clicks                                            │
│        • $1,890 spend                                            │
│        • 38 conversions                                          │
│        • 210% ROI                                                │
│                                                                   │
│     [View Full Report] [Export to PDF]                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Type your question...                            [Send]  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Code Samples

### Google Ads API Client (TypeScript)

**File:** `src/lib/server/integrations/google-ads-client.ts`

```typescript
import { GoogleAdsApi, Customer } from 'google-ads-api';

export interface GoogleAdsConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
}

function getCustomer(config: GoogleAdsConfig): Customer {
  const client = new GoogleAdsApi({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    developer_token: config.developerToken,
  });

  const customerId = config.customerId.replace(/-/g, '');

  return client.Customer({
    customer_id: customerId,
    refresh_token: config.refreshToken,
    login_customer_id: customerId,
  });
}

export async function listCampaigns(
  config: GoogleAdsConfig,
  options: {
    startDate?: string;
    endDate?: string;
    includeMetrics?: boolean;
  } = {}
): Promise<GoogleAdsCampaign[]> {
  const { startDate, endDate, includeMetrics = true } = options;
  const customer = getCustomer(config);

  let query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr
    FROM campaign
    WHERE campaign.status != 'REMOVED'
  `;

  if (startDate && endDate) {
    query += ` AND segments.date BETWEEN '${startDate}' AND '${endDate}'`;
  }

  const results = await customer.query(query);

  // Transform and return results
  return Array.from(results).map(row => ({
    id: row.campaign.id?.toString() || '',
    name: row.campaign.name || '',
    status: row.campaign.status || 'UNKNOWN',
    metrics: {
      clicks: Number(row.metrics.clicks || 0),
      cost: Number(row.metrics.cost_micros || 0) / 1000000,
      conversions: Number(row.metrics.conversions || 0),
      // ... additional metrics
    }
  }));
}
```

### Automated Sync Script

**File:** `src/lib/server/sync/google-ads-sync.ts`

```typescript
import * as googleAds from '../integrations/google-ads-client';
import { db } from '../db';
import { google_ads_campaigns, google_ads_campaign_metrics } from '../db/schema';

export async function syncGoogleAdsData() {
  console.log('Starting Google Ads sync...');

  const config: googleAds.GoogleAdsConfig = {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    clientId: process.env.GOOGLE_ADS_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID!,
  };

  // Get date range for last 24 hours
  const dateRange = googleAds.getDateRange(1);

  // Fetch all accounts under MCC
  const accounts = await googleAds.listCustomerAccounts(config);

  // Sync each account
  for (const account of accounts) {
    if (account.manager) continue; // Skip manager accounts

    try {
      const accountConfig = { ...config, customerId: account.customerId };
      const campaigns = await googleAds.listCampaigns(accountConfig, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        includeMetrics: true,
      });

      // Upsert campaigns and metrics to database
      for (const campaign of campaigns) {
        await db.insert(google_ads_campaigns)
          .values({
            id: campaign.id,
            customer_id: account.customerId,
            name: campaign.name,
            status: campaign.status,
            // ... additional fields
          })
          .onConflictDoUpdate({
            target: google_ads_campaigns.id,
            set: { updated_at: new Date() }
          });

        await db.insert(google_ads_campaign_metrics)
          .values({
            campaign_id: campaign.id,
            date: dateRange.endDate,
            clicks: campaign.metrics.clicks,
            cost: campaign.metrics.cost,
            // ... additional metrics
          })
          .onConflictDoNothing(); // Prevent duplicate daily records
      }

      console.log(`Synced ${campaigns.length} campaigns for ${account.descriptiveName}`);
    } catch (error) {
      console.error(`Error syncing ${account.descriptiveName}:`, error);
    }
  }

  console.log('Google Ads sync complete');
}
```

---

## API Usage & Quota Management

### Estimated API Usage

**Daily Operations:**
- **Hourly Sync (24 times/day):**
  - 1 request to list accounts (MCC hierarchy)
  - ~5-10 requests to list campaigns per client account
  - Total: ~24 * 10 = 240 requests/day

- **Daily Deep Sync (1 time/day):**
  - Historical data fetches: ~50 requests

- **AI Chat Queries (on-demand):**
  - Estimated 20-50 ad-hoc queries per day

**Total Estimated Operations:** ~500-1,000 operations/day

**Standard Access Requirement:**
- Current Test Mode Limit: 15,000 operations/day
- Standard Access Limit: 1,500,000 operations/day
- **Reason for Standard Access:** Need access to production client accounts under MCC (test mode only allows test accounts)

### Quota Management Strategy

**Rate Limiting:**
- Implement exponential backoff for API errors
- Cache frequently accessed data in PostgreSQL
- Use database queries for dashboard rendering (not real-time API calls)
- Limit AI chat to 1 API call per query (use cached data when possible)

**Monitoring:**
- Log all API requests with timestamps
- Track daily operation count
- Alert if approaching quota limits
- Monthly usage reports for compliance

---

## Security & Compliance

### OAuth 2.0 Authentication

**Credentials Storage:**
- All OAuth credentials stored in environment variables
- Production credentials managed via Vercel secrets
- No credentials committed to version control
- Refresh token has no expiration (revocable if compromised)

**Environment Variables:**
```bash
GOOGLE_ADS_DEVELOPER_TOKEN=swQQBb1hPh8Ofid5fnDgjg
GOOGLE_ADS_CLIENT_ID=1093527084995-ne9a84445ofhjqtm4atu9dfk2sun0d06.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=[Securely stored in Vercel]
GOOGLE_ADS_REFRESH_TOKEN=[Securely stored in Vercel]
GOOGLE_ADS_CUSTOMER_ID=517-565-4322
```

### Access Control

**Application-Level Security:**
- User authentication via OAuth (Google/GitHub)
- Role-based access control (admin, viewer)
- Session management with secure cookies
- HTTPS only (enforced by Vercel)

**Database Security:**
- PostgreSQL hosted on Neon (SSL required)
- Database credentials rotated quarterly
- Read-only replicas for reporting queries
- Automated backups (daily)

### Data Retention & Privacy

**Data Storage:**
- Campaign performance data retained for 2 years (rolling window)
- Personal data: None (no user PII stored from Google Ads)
- Account names and IDs only (no customer personal information)

**Compliance:**
- GDPR compliant (no personal data processing)
- Data processing agreement with hosting providers
- API usage logs retained for 90 days

---

## Testing & Validation

### Development Testing

**Test Environment:**
- OAuth credentials: ✅ Working
- Refresh token generation: ✅ Working
- Access token exchange: ✅ Working (3599s expiry)
- API connectivity: ✅ Connected
- gRPC client library: ✅ Installed and configured

**Current Limitation:**
- Developer token in test mode
- Cannot access production account (517-565-4322) until Standard Access approved
- Test account not available for demonstration

**Test Script:**
```bash
# Connection test (after Standard Access approval)
npx tsx test-google-ads-grpc.ts

# Expected output:
# ✅ Customer Details: Stewart Golf Ads
# ✅ Found 25 campaigns
# ✅ Total clicks: 15,234
# ✅ Total cost: $12,456.78
```

### Post-Approval Testing Plan

**Phase 1: API Access Validation (Day 1)**
1. Run connection test script
2. Verify access to all client accounts under MCC
3. Test campaign listing for each account
4. Validate metrics retrieval

**Phase 2: Data Sync (Days 2-3)**
1. Run initial historical data import (90 days)
2. Verify data accuracy against Google Ads UI
3. Test hourly sync schedule
4. Monitor for API errors/rate limits

**Phase 3: Dashboard Validation (Days 4-5)**
1. Populate dashboards with real data
2. User acceptance testing with marketing team
3. AI chat interface validation
4. Performance testing (load time, query speed)

**Phase 4: Production Deployment (Day 6)**
1. Enable automated sync schedule
2. Monitor API usage
3. Set up alerts for errors
4. Final user training

---

## Maintenance & Support

### Ongoing Maintenance

**Automated Monitoring:**
- Daily sync success/failure alerts
- API quota usage tracking
- Error rate monitoring (Sentry integration)
- Uptime monitoring (99.9% SLA target)

**Manual Reviews:**
- Weekly: Review sync logs for errors
- Monthly: Audit API usage and optimize queries
- Quarterly: Review and update dashboard metrics
- Annually: Credential rotation and security audit

### Support Contact

**Primary Contact:**
- **Name:** Ian Stone
- **Email:** ian@greensignals.io
- **Role:** Lead Developer & Platform Owner

**Technical Team:**
- Development: Internal engineering team
- Marketing: Internal marketing operations team
- Support: support@greensignals.io

---

## Application Submission Checklist

- [x] Business model description
- [x] Tool classification (Internal-Only)
- [x] User access documentation (internal only)
- [x] Architecture diagram
- [x] Database schema
- [x] API endpoints and queries documented
- [x] RMF compliance explanation
- [x] UI mockups included
- [x] Code samples provided
- [x] Security measures documented
- [x] OAuth configuration complete
- [x] Testing plan outlined
- [x] Quota usage estimates
- [x] Support contact information
- [ ] Screenshots of live dashboard (pending Standard Access approval)

---

## Appendix: Technical Specifications

### System Requirements

**Production Environment:**
- **Hosting:** Vercel (Serverless Functions)
- **Database:** Neon PostgreSQL (Cloud)
- **CDN:** Vercel Edge Network
- **Domains:**
  - Primary: https://app.greensignals.io
  - API: https://weaveai-enterprise.vercel.app

**Dependencies:**
```json
{
  "google-ads-api": "^18.0.0",
  "sveltekit": "^5.0.0",
  "drizzle-orm": "^0.30.0",
  "pg": "^8.11.0",
  "@anthropic-ai/sdk": "^0.27.0"
}
```

### API Client Configuration

**gRPC Settings:**
```typescript
{
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  login_customer_id: "517-565-4322" // MCC account
}
```

**Timeout Settings:**
- Default query timeout: 60 seconds
- Connection timeout: 30 seconds
- Retry attempts: 3 (exponential backoff)

### Database Performance

**Connection Pooling:**
- Max connections: 20
- Idle timeout: 30 seconds
- Connection retry: 3 attempts

**Query Optimization:**
- Indexes on: campaign_id, date, customer_id
- Materialized views for aggregate reports
- Partition tables by month for metrics

---

## Conclusion

WeaveAI Enterprise is a purpose-built internal analytics platform designed to responsibly leverage the Google Ads API for reporting and limited campaign management. As an Internal-Only tool, we are exempt from RMF requirements but have implemented comprehensive reporting functionality to demonstrate best practices.

We request Standard Access to enable production account access under our MCC structure (517-565-4322) and support our growing marketing operations team. Our estimated usage of 500-1,000 operations/day is well within Standard Access limits, and we have robust security, monitoring, and compliance measures in place.

**Expected Go-Live Date:** Within 7 days of Standard Access approval
**Business Impact:** Enable data-driven decision making for $50,000+/month in managed ad spend

Thank you for considering our Standard Access application.

---

**Document Version:** 1.0
**Last Updated:** November 2, 2025
**Submitted By:** Ian Stone, Lead Developer, WeaveAI / Green Signals

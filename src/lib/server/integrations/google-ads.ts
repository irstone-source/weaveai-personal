/**
 * Google Ads API Integration
 *
 * Direct integration with Google Ads API for fetching campaign performance data.
 * Uses OAuth 2.0 for authentication and Google Ads Query Language (GAQL) for queries.
 *
 * API Documentation: https://developers.google.com/google-ads/api/docs/start
 */

const GOOGLE_ADS_API_VERSION = 'v18';
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

// ============================================================================
// Types
// ============================================================================

export interface GoogleAdsConfig {
	developerToken: string;
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	customerId: string; // Without hyphens (e.g., "5175654322")
}

export interface GoogleAdsCampaign {
	id: string;
	name: string;
	status: string;
	advertisingChannelType: string;
	biddingStrategyType: string;
	startDate: string;
	endDate?: string;
	metrics: CampaignMetrics;
}

export interface CampaignMetrics {
	clicks: number;
	impressions: number;
	cost: number; // In micros (divide by 1,000,000 for actual cost)
	conversions: number;
	conversionsValue: number;
	averageCpc: number;
	ctr: number;
	costPerConversion: number;
}

export interface GoogleAdsAccount {
	customerId: string;
	descriptiveName: string;
	currencyCode: string;
	timeZone: string;
	manager: boolean;
}

export interface SearchAdsQuery {
	query: string;
	pageSize?: number;
}

// ============================================================================
// Authentication
// ============================================================================

/**
 * Get OAuth access token from refresh token
 */
async function getAccessToken(
	clientId: string,
	clientSecret: string,
	refreshToken: string
): Promise<string> {
	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: refreshToken,
			grant_type: 'refresh_token',
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to get access token: ${error}`);
	}

	const data = await response.json();
	return data.access_token;
}

/**
 * Make authenticated request to Google Ads API
 */
async function googleAdsRequest<T>(
	config: GoogleAdsConfig,
	endpoint: string,
	method: string = 'GET',
	body?: any
): Promise<T> {
	const accessToken = await getAccessToken(
		config.clientId,
		config.clientSecret,
		config.refreshToken
	);

	const url = `${GOOGLE_ADS_API_BASE}/${endpoint}`;

	const response = await fetch(url, {
		method,
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'developer-token': config.developerToken,
			'login-customer-id': config.customerId.replace(/-/g, ''),
			'Content-Type': 'application/json',
		},
		body: body ? JSON.stringify(body) : undefined,
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Google Ads API error (${response.status}): ${error}`);
	}

	return response.json();
}

// ============================================================================
// Campaign Operations
// ============================================================================

/**
 * List all campaigns for a customer
 */
export async function listCampaigns(
	config: GoogleAdsConfig,
	options: {
		startDate?: string; // YYYY-MM-DD
		endDate?: string; // YYYY-MM-DD
		includeMetrics?: boolean;
	} = {}
): Promise<GoogleAdsCampaign[]> {
	const { startDate, endDate, includeMetrics = true } = options;

	// Build GAQL query
	let query = `
		SELECT
			campaign.id,
			campaign.name,
			campaign.status,
			campaign.advertising_channel_type,
			campaign.bidding_strategy_type,
			campaign.start_date,
			campaign.end_date
	`;

	if (includeMetrics) {
		query += `,
			metrics.clicks,
			metrics.impressions,
			metrics.cost_micros,
			metrics.conversions,
			metrics.conversions_value,
			metrics.average_cpc,
			metrics.ctr,
			metrics.cost_per_conversion
		`;
	}

	query += `
		FROM campaign
		WHERE campaign.status != 'REMOVED'
	`;

	if (startDate && endDate) {
		query += `
		AND segments.date BETWEEN '${startDate}' AND '${endDate}'
		`;
	}

	query += `
		ORDER BY campaign.id
	`;

	const response = await googleAdsRequest<any>(
		config,
		`customers/${config.customerId.replace(/-/g, '')}/googleAds:search`,
		'POST',
		{ query: query.trim() }
	);

	// Parse response
	const campaigns: GoogleAdsCampaign[] = [];

	if (response.results) {
		for (const result of response.results) {
			const campaign = result.campaign;
			const metrics = result.metrics || {};

			campaigns.push({
				id: campaign.id,
				name: campaign.name,
				status: campaign.status,
				advertisingChannelType: campaign.advertisingChannelType,
				biddingStrategyType: campaign.biddingStrategyType,
				startDate: campaign.startDate,
				endDate: campaign.endDate,
				metrics: {
					clicks: parseInt(metrics.clicks || '0'),
					impressions: parseInt(metrics.impressions || '0'),
					cost: parseInt(metrics.costMicros || '0') / 1000000,
					conversions: parseFloat(metrics.conversions || '0'),
					conversionsValue: parseFloat(metrics.conversionsValue || '0'),
					averageCpc: parseInt(metrics.averageCpc || '0') / 1000000,
					ctr: parseFloat(metrics.ctr || '0'),
					costPerConversion: parseInt(metrics.costPerConversion || '0') / 1000000,
				},
			});
		}
	}

	return campaigns;
}

/**
 * Get campaign performance by date range
 */
export async function getCampaignPerformance(
	config: GoogleAdsConfig,
	campaignId: string,
	startDate: string,
	endDate: string
): Promise<any[]> {
	const query = `
		SELECT
			segments.date,
			campaign.id,
			campaign.name,
			metrics.clicks,
			metrics.impressions,
			metrics.cost_micros,
			metrics.conversions,
			metrics.ctr,
			metrics.average_cpc
		FROM campaign
		WHERE campaign.id = ${campaignId}
		AND segments.date BETWEEN '${startDate}' AND '${endDate}'
		ORDER BY segments.date DESC
	`;

	const response = await googleAdsRequest<any>(
		config,
		`customers/${config.customerId.replace(/-/g, '')}/googleAds:search`,
		'POST',
		{ query: query.trim() }
	);

	return response.results || [];
}

/**
 * Get account hierarchy (MCC structure)
 */
export async function listCustomerAccounts(
	config: GoogleAdsConfig
): Promise<GoogleAdsAccount[]> {
	const query = `
		SELECT
			customer_client.id,
			customer_client.descriptive_name,
			customer_client.currency_code,
			customer_client.time_zone,
			customer_client.manager
		FROM customer_client
		WHERE customer_client.status = 'ENABLED'
		ORDER BY customer_client.descriptive_name
	`;

	const response = await googleAdsRequest<any>(
		config,
		`customers/${config.customerId.replace(/-/g, '')}/googleAds:search`,
		'POST',
		{ query: query.trim() }
	);

	const accounts: GoogleAdsAccount[] = [];

	if (response.results) {
		for (const result of response.results) {
			const client = result.customerClient;
			accounts.push({
				customerId: client.id,
				descriptiveName: client.descriptiveName,
				currencyCode: client.currencyCode,
				timeZone: client.timeZone,
				manager: client.manager,
			});
		}
	}

	return accounts;
}

/**
 * Execute custom GAQL query
 */
export async function executeQuery(
	config: GoogleAdsConfig,
	query: string,
	useStream: boolean = true
): Promise<any> {
	const endpoint = useStream
		? `customers/${config.customerId.replace(/-/g, '')}/googleAds:searchStream`
		: `customers/${config.customerId.replace(/-/g, '')}/googleAds:search`;

	return googleAdsRequest<any>(config, endpoint, 'POST', { query });
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Fetch all campaigns across multiple accounts (for MCC)
 */
export async function fetchAllCampaignsFromMCC(
	config: GoogleAdsConfig,
	options: {
		startDate?: string;
		endDate?: string;
	} = {}
): Promise<Map<string, GoogleAdsCampaign[]>> {
	// First, get all customer accounts
	const accounts = await listCustomerAccounts(config);

	const allCampaigns = new Map<string, GoogleAdsCampaign[]>();

	// Fetch campaigns for each account
	for (const account of accounts) {
		if (account.manager) {
			// Skip manager accounts
			continue;
		}

		try {
			const accountConfig = {
				...config,
				customerId: account.customerId,
			};

			const campaigns = await listCampaigns(accountConfig, options);
			allCampaigns.set(account.customerId, campaigns);
		} catch (error) {
			console.error(`Error fetching campaigns for ${account.descriptiveName}:`, error);
		}
	}

	return allCampaigns;
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get date range for last N days
 */
export function getDateRange(days: number): { startDate: string; endDate: string } {
	const end = new Date();
	const start = new Date();
	start.setDate(start.getDate() - days);

	return {
		startDate: formatDate(start),
		endDate: formatDate(end),
	};
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

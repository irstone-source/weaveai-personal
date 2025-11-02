/**
 * Google Ads API Integration (gRPC-based)
 *
 * Uses the official google-ads-api Node.js client library.
 * Documentation: https://developers.google.com/google-ads/api/docs/client-libs/nodejs
 */

import { GoogleAdsApi, Customer } from 'google-ads-api';

// ============================================================================
// Types
// ============================================================================

export interface GoogleAdsConfig {
	developerToken: string;
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	customerId: string; // Can include hyphens (e.g., "517-565-4322")
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
	cost: number; // In account currency (converted from micros)
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

export interface DateRange {
	startDate: string; // YYYY-MM-DD
	endDate: string; // YYYY-MM-DD
}

// ============================================================================
// Client Initialization
// ============================================================================

/**
 * Create a Google Ads API client
 */
function createClient(config: GoogleAdsConfig): GoogleAdsApi {
	const client = new GoogleAdsApi({
		client_id: config.clientId,
		client_secret: config.clientSecret,
		developer_token: config.developerToken,
	});

	return client;
}

/**
 * Get a customer instance for making API calls
 */
function getCustomer(config: GoogleAdsConfig): Customer {
	const client = createClient(config);

	// Remove hyphens from customer ID if present
	const customerId = config.customerId.replace(/-/g, '');

	return client.Customer({
		customer_id: customerId,
		refresh_token: config.refreshToken,
		login_customer_id: customerId, // Use the same customer as login for single accounts
	});
}

// ============================================================================
// Campaign Operations
// ============================================================================

/**
 * List all campaigns with optional date range and metrics
 */
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

	try {
		const results = await customer.query(query);

		const campaigns: GoogleAdsCampaign[] = [];

		for (const row of results) {
			const campaign = row.campaign;
			const metrics = row.metrics || {};

			campaigns.push({
				id: campaign.id?.toString() || '',
				name: campaign.name || '',
				status: campaign.status || 'UNKNOWN',
				advertisingChannelType: campaign.advertising_channel_type || 'UNKNOWN',
				biddingStrategyType: campaign.bidding_strategy_type || 'UNKNOWN',
				startDate: campaign.start_date || '',
				endDate: campaign.end_date || undefined,
				metrics: {
					clicks: Number(metrics.clicks || 0),
					impressions: Number(metrics.impressions || 0),
					cost: Number(metrics.cost_micros || 0) / 1000000,
					conversions: Number(metrics.conversions || 0),
					conversionsValue: Number(metrics.conversions_value || 0),
					averageCpc: Number(metrics.average_cpc || 0) / 1000000,
					ctr: Number(metrics.ctr || 0),
					costPerConversion: Number(metrics.cost_per_conversion || 0) / 1000000,
				},
			});
		}

		return campaigns;
	} catch (error: any) {
		throw new Error(`Failed to list campaigns: ${error.message}`);
	}
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
	const customer = getCustomer(config);

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

	try {
		const results = await customer.query(query);
		return Array.from(results);
	} catch (error: any) {
		throw new Error(`Failed to get campaign performance: ${error.message}`);
	}
}

/**
 * Get account hierarchy (MCC structure)
 */
export async function listCustomerAccounts(
	config: GoogleAdsConfig
): Promise<GoogleAdsAccount[]> {
	const customer = getCustomer(config);

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

	try {
		const results = await customer.query(query);

		const accounts: GoogleAdsAccount[] = [];

		for (const row of results) {
			const client = row.customer_client;

			accounts.push({
				customerId: client.id?.toString() || '',
				descriptiveName: client.descriptive_name || '',
				currencyCode: client.currency_code || '',
				timeZone: client.time_zone || '',
				manager: client.manager || false,
			});
		}

		return accounts;
	} catch (error: any) {
		throw new Error(`Failed to list customer accounts: ${error.message}`);
	}
}

/**
 * Get basic customer information
 */
export async function getCustomerInfo(config: GoogleAdsConfig): Promise<{
	id: string;
	descriptiveName: string;
	currencyCode: string;
	timeZone: string;
}> {
	const customer = getCustomer(config);

	const query = `
		SELECT
			customer.id,
			customer.descriptive_name,
			customer.currency_code,
			customer.time_zone
		FROM customer
		LIMIT 1
	`;

	try {
		const results = await customer.query(query);
		const row = Array.from(results)[0];

		if (!row || !row.customer) {
			throw new Error('No customer data returned');
		}

		return {
			id: row.customer.id?.toString() || '',
			descriptiveName: row.customer.descriptive_name || '',
			currencyCode: row.customer.currency_code || '',
			timeZone: row.customer.time_zone || '',
		};
	} catch (error: any) {
		throw new Error(`Failed to get customer info: ${error.message}`);
	}
}

/**
 * Execute custom GAQL query
 */
export async function executeQuery(config: GoogleAdsConfig, query: string): Promise<any[]> {
	const customer = getCustomer(config);

	try {
		const results = await customer.query(query);
		return Array.from(results);
	} catch (error: any) {
		throw new Error(`Failed to execute query: ${error.message}`);
	}
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
		} catch (error: any) {
			console.error(`Error fetching campaigns for ${account.descriptiveName}:`, error.message);
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
export function getDateRange(days: number): DateRange {
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

/**
 * Get date range for a specific month
 */
export function getMonthDateRange(year: number, month: number): DateRange {
	const startDate = new Date(year, month - 1, 1);
	const endDate = new Date(year, month, 0); // Last day of the month

	return {
		startDate: formatDate(startDate),
		endDate: formatDate(endDate),
	};
}

/**
 * Get date range for current month
 */
export function getCurrentMonthDateRange(): DateRange {
	const now = new Date();
	return getMonthDateRange(now.getFullYear(), now.getMonth() + 1);
}

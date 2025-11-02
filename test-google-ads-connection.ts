/**
 * Google Ads API Connection Test
 *
 * This script tests the Google Ads API connection using the credentials
 * from your .env file. It will attempt to:
 * 1. Authenticate using OAuth refresh token
 * 2. Fetch basic account information
 * 3. List campaigns with recent performance metrics
 */

import * as googleAds from './src/lib/server/integrations/google-ads';
import 'dotenv/config';

async function testConnection() {
	console.log('\n🧪 Google Ads API Connection Test\n');
	console.log('='.repeat(80));

	// Validate environment variables
	const requiredVars = [
		'GOOGLE_ADS_DEVELOPER_TOKEN',
		'GOOGLE_ADS_CLIENT_ID',
		'GOOGLE_ADS_CLIENT_SECRET',
		'GOOGLE_ADS_REFRESH_TOKEN',
		'GOOGLE_ADS_CUSTOMER_ID',
	];

	const missing = requiredVars.filter(varName => !process.env[varName]);

	if (missing.length > 0) {
		console.error('❌ Missing required environment variables:');
		missing.forEach(varName => console.error(`   - ${varName}`));
		console.error('\nPlease add these to your .env file.');
		process.exit(1);
	}

	console.log('✅ All required environment variables found\n');

	// Build config
	const config: googleAds.GoogleAdsConfig = {
		developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
		clientId: process.env.GOOGLE_ADS_CLIENT_ID!,
		clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
		refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
		customerId: process.env.GOOGLE_ADS_CUSTOMER_ID!,
	};

	console.log('📋 Configuration:');
	console.log(`   Developer Token: ${config.developerToken.substring(0, 10)}...`);
	console.log(`   Customer ID: ${config.customerId}`);
	console.log(`   Client ID: ${config.clientId.substring(0, 20)}...`);
	console.log('\n');

	try {
		// Test 1: List Customer Accounts
		console.log('🔍 Test 1: Fetching Account Hierarchy...\n');
		const accounts = await googleAds.listCustomerAccounts(config);

		console.log(`✅ Found ${accounts.length} customer accounts:\n`);

		accounts.forEach((account, index) => {
			console.log(`   ${index + 1}. ${account.descriptiveName}`);
			console.log(`      ID: ${account.customerId}`);
			console.log(`      Currency: ${account.currencyCode}`);
			console.log(`      Timezone: ${account.timeZone}`);
			console.log(`      Type: ${account.manager ? 'Manager (MCC)' : 'Client Account'}`);
			console.log();
		});

		// Test 2: List Campaigns with Last 30 Days Metrics
		console.log('='.repeat(80));
		console.log('🔍 Test 2: Fetching Campaign Performance (Last 30 Days)...\n');

		const dateRange = googleAds.getDateRange(30);
		console.log(`   Date Range: ${dateRange.startDate} to ${dateRange.endDate}\n`);

		const campaigns = await googleAds.listCampaigns(config, {
			startDate: dateRange.startDate,
			endDate: dateRange.endDate,
			includeMetrics: true,
		});

		console.log(`✅ Found ${campaigns.length} campaigns:\n`);

		if (campaigns.length === 0) {
			console.log('   No campaigns found for this account.');
			console.log('   This could mean:');
			console.log('   - This is a manager (MCC) account with no direct campaigns');
			console.log('   - All campaigns are in REMOVED status');
			console.log('   - The account has no campaigns yet\n');
		} else {
			// Sort by impressions (descending) to show most active campaigns first
			const sortedCampaigns = campaigns.sort((a, b) =>
				b.metrics.impressions - a.metrics.impressions
			);

			// Show top 10 campaigns
			const topCampaigns = sortedCampaigns.slice(0, 10);

			topCampaigns.forEach((campaign, index) => {
				console.log(`   ${index + 1}. ${campaign.name}`);
				console.log(`      ID: ${campaign.id}`);
				console.log(`      Status: ${campaign.status}`);
				console.log(`      Type: ${campaign.advertisingChannelType}`);
				console.log(`      Bidding: ${campaign.biddingStrategyType}`);
				console.log();
				console.log(`      Performance (Last 30 Days):`);
				console.log(`      - Clicks: ${campaign.metrics.clicks.toLocaleString()}`);
				console.log(`      - Impressions: ${campaign.metrics.impressions.toLocaleString()}`);
				console.log(`      - Cost: $${campaign.metrics.cost.toFixed(2)}`);
				console.log(`      - Conversions: ${campaign.metrics.conversions.toFixed(2)}`);
				console.log(`      - CTR: ${(campaign.metrics.ctr * 100).toFixed(2)}%`);
				console.log(`      - Avg CPC: $${campaign.metrics.averageCpc.toFixed(2)}`);

				if (campaign.metrics.conversions > 0) {
					console.log(`      - Cost/Conv: $${campaign.metrics.costPerConversion.toFixed(2)}`);
					console.log(`      - Conv Value: $${campaign.metrics.conversionsValue.toFixed(2)}`);
				}

				console.log();
			});

			if (campaigns.length > 10) {
				console.log(`   ... and ${campaigns.length - 10} more campaigns\n`);
			}

			// Summary statistics
			const totalClicks = campaigns.reduce((sum, c) => sum + c.metrics.clicks, 0);
			const totalImpressions = campaigns.reduce((sum, c) => sum + c.metrics.impressions, 0);
			const totalCost = campaigns.reduce((sum, c) => sum + c.metrics.cost, 0);
			const totalConversions = campaigns.reduce((sum, c) => sum + c.metrics.conversions, 0);
			const totalConvValue = campaigns.reduce((sum, c) => sum + c.metrics.conversionsValue, 0);

			console.log('='.repeat(80));
			console.log('📊 Summary (All Campaigns - Last 30 Days):\n');
			console.log(`   Total Clicks: ${totalClicks.toLocaleString()}`);
			console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
			console.log(`   Total Cost: $${totalCost.toFixed(2)}`);
			console.log(`   Total Conversions: ${totalConversions.toFixed(2)}`);
			console.log(`   Total Conversion Value: $${totalConvValue.toFixed(2)}`);
			console.log(`   Average CTR: ${((totalClicks / totalImpressions) * 100).toFixed(2)}%`);
			console.log(`   Average CPC: $${(totalCost / totalClicks).toFixed(2)}`);
			if (totalConversions > 0) {
				console.log(`   Average Cost/Conversion: $${(totalCost / totalConversions).toFixed(2)}`);
				console.log(`   ROI: ${(((totalConvValue - totalCost) / totalCost) * 100).toFixed(2)}%`);
			}
			console.log();
		}

		// Success message
		console.log('='.repeat(80));
		console.log('✅ Connection Test Successful!\n');
		console.log('Your Google Ads API integration is working correctly.');
		console.log('You can now:');
		console.log('  1. Import campaign data into your database');
		console.log('  2. Build client dashboards');
		console.log('  3. Create automated reports');
		console.log('  4. Query performance data via AI chat\n');

	} catch (error: any) {
		console.error('='.repeat(80));
		console.error('❌ Connection Test Failed\n');
		console.error('Error:', error.message);
		console.error();

		// Provide helpful troubleshooting tips
		if (error.message.includes('DEVELOPER_TOKEN_NOT_APPROVED')) {
			console.error('💡 Troubleshooting: Developer Token Not Approved');
			console.error('   Your developer token is in test mode.');
			console.error('   - You can only access test accounts');
			console.error('   - Apply for standard access: https://ads.google.com/aw/apicenter\n');
		} else if (error.message.includes('CUSTOMER_NOT_ENABLED')) {
			console.error('💡 Troubleshooting: Customer Not Enabled');
			console.error('   The customer account doesn\'t have API access enabled.');
			console.error('   - Enable in Google Ads account settings\n');
		} else if (error.message.includes('AUTHENTICATION_ERROR') || error.message.includes('invalid_grant')) {
			console.error('💡 Troubleshooting: Authentication Error');
			console.error('   Your refresh token may be invalid or expired.');
			console.error('   - Re-run: npx tsx get-google-ads-refresh-token.ts');
			console.error('   - Update GOOGLE_ADS_REFRESH_TOKEN in .env\n');
		} else if (error.message.includes('PERMISSION_DENIED')) {
			console.error('💡 Troubleshooting: Permission Denied');
			console.error('   You don\'t have access to this account.');
			console.error('   - Check MCC link and permissions');
			console.error('   - Verify GOOGLE_ADS_CUSTOMER_ID is correct\n');
		}

		process.exit(1);
	}
}

// Run the test
testConnection()
	.then(() => {
		console.log('✅ Test complete!\n');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Unexpected error:', error);
		process.exit(1);
	});

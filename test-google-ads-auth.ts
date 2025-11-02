/**
 * Simple Google Ads API Authentication Test
 * Tests if we can successfully authenticate with the Google Ads API
 */

import 'dotenv/config';

async function testAuth() {
	console.log('\n🧪 Google Ads API Authentication Test\n');
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
		process.exit(1);
	}

	console.log('✅ All required environment variables found\n');

	// Step 1: Get access token from refresh token
	console.log('🔑 Step 1: Getting OAuth access token...\n');

	try {
		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
				client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
				refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
				grant_type: 'refresh_token',
			}),
		});

		if (!tokenResponse.ok) {
			const error = await tokenResponse.text();
			console.error('❌ Failed to get access token:');
			console.error(error);
			process.exit(1);
		}

		const tokens = await tokenResponse.json();
		console.log('✅ Successfully obtained access token');
		console.log(`   Token type: ${tokens.token_type}`);
		console.log(`   Expires in: ${tokens.expires_in} seconds`);
		console.log(`   Access token: ${tokens.access_token.substring(0, 50)}...\n`);

		// Step 2: Try to make a simple API call using the official client library pattern
		console.log('🔍 Step 2: Testing API access with a simple query...\n');

		const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, '');

		// Try the simplest possible query - just get customer info
		const query = `SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1`;

		const apiResponse = await fetch(
			`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${tokens.access_token}`,
					'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
					'login-customer-id': customerId,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ query }),
			}
		);

		console.log(`API Response Status: ${apiResponse.status} ${apiResponse.statusText}\n`);

		const responseText = await apiResponse.text();

		if (!apiResponse.ok) {
			console.error('❌ API Request Failed\n');
			console.error('Response:');
			console.error(responseText);
			console.error('\n');

			// Parse error for specific issues
			try {
				const errorData = JSON.parse(responseText);
				if (errorData.error) {
					console.error('Error details:');
					console.error(`  Code: ${errorData.error.code}`);
					console.error(`  Status: ${errorData.error.status}`);
					console.error(`  Message: ${errorData.error.message}\n`);

					// Provide specific guidance
					if (errorData.error.code === 403 && errorData.error.message.includes('not been used')) {
						console.error('💡 The Google Ads API needs to be enabled in your Google Cloud project.');
						console.error('   Visit the link in the error message above to enable it.\n');
					} else if (errorData.error.code === 401) {
						console.error('💡 Authentication issue - your refresh token may be invalid.');
						console.error('   Try re-running: npx tsx get-google-ads-refresh-token.ts\n');
					} else if (errorData.error.code === 501) {
						console.error('💡 The REST API endpoint is not implemented.');
						console.error('   Google Ads API v18 primarily uses gRPC, not REST.');
						console.error('   You may need to use the official Node.js client library instead:\n');
						console.error('   https://github.com/googleads/google-ads-node\n');
					}
				}
			} catch (e) {
				// Not JSON, just show raw error
			}

			process.exit(1);
		}

		// Success!
		const data = JSON.parse(responseText);
		console.log('✅ API Request Successful!\n');
		console.log('Response data:');
		console.log(JSON.stringify(data, null, 2));
		console.log('\n');

		console.log('='.repeat(80));
		console.log('✅ Authentication Test Passed!\n');
		console.log('Your Google Ads API credentials are working correctly.');
		console.log('However, note that the REST API has limited functionality.');
		console.log('Consider using the official google-ads-node client library for full access.\n');

	} catch (error: any) {
		console.error('❌ Unexpected error:', error.message);
		process.exit(1);
	}
}

// Run the test
testAuth()
	.then(() => {
		console.log('✅ Test complete!\n');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Unexpected error:', error);
		process.exit(1);
	});

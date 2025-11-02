/**
 * Google Ads OAuth Refresh Token Generator
 *
 * This script helps you generate a refresh token for Google Ads API.
 * Run this after creating OAuth credentials in Google Cloud Console.
 *
 * Usage:
 *   1. Create OAuth credentials in Google Cloud Console
 *   2. Set CLIENT_ID and CLIENT_SECRET below
 *   3. Run: npx tsx get-google-ads-refresh-token.ts
 *   4. Follow the authorization URL
 *   5. Copy the refresh token to your .env file
 */

import * as http from 'http';
import * as url from 'url';
import open from 'open';

// ============================================================================
// Configuration - REPLACE WITH YOUR VALUES
// ============================================================================

const CLIENT_ID = '1093527084995-ne9a84445ofhjqtm4atu9dfk2sun0d06.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3002/oauth2callback';

// Google Ads API requires these scopes
const SCOPES = ['https://www.googleapis.com/auth/adwords'];

// ============================================================================
// OAuth Flow
// ============================================================================

async function generateRefreshToken() {
	console.log('\n🔐 Google Ads OAuth Refresh Token Generator\n');
	console.log('='.repeat(80));

	// Validate configuration
	if (CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
		console.error('❌ Error: Please set your CLIENT_ID in this file first');
		console.error('   Get it from: https://console.cloud.google.com/apis/credentials');
		process.exit(1);
	}

	if (CLIENT_SECRET === 'YOUR_CLIENT_SECRET_HERE') {
		console.error('❌ Error: Please set your CLIENT_SECRET in this file first');
		console.error('   Get it from: https://console.cloud.google.com/apis/credentials');
		process.exit(1);
	}

	// Step 1: Generate authorization URL
	const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	authUrl.searchParams.set('client_id', CLIENT_ID);
	authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('scope', SCOPES.join(' '));
	authUrl.searchParams.set('access_type', 'offline'); // Required for refresh token
	authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token

	console.log('\n📝 Step 1: Authorize the application\n');
	console.log('Opening browser to authorize access...\n');
	console.log('Authorization URL:');
	console.log(authUrl.toString());
	console.log();

	// Open browser
	try {
		await open(authUrl.toString());
	} catch (error) {
		console.log('⚠️  Could not open browser automatically');
		console.log('   Please open the URL above manually\n');
	}

	// Step 2: Start local server to receive callback
	console.log('📡 Step 2: Waiting for authorization...\n');
	console.log(`Starting local server on ${REDIRECT_URI}...`);

	const authCode = await new Promise<string>((resolve, reject) => {
		const server = http.createServer(async (req, res) => {
			if (!req.url) {
				res.end('Invalid request');
				return;
			}

			const parsedUrl = url.parse(req.url, true);

			// Handle OAuth callback
			if (parsedUrl.pathname === '/oauth2callback') {
				const code = parsedUrl.query.code as string;

				if (code) {
					res.writeHead(200, { 'Content-Type': 'text/html' });
					res.end(`
						<html>
							<body style="font-family: system-ui; padding: 40px; text-align: center;">
								<h1>✅ Authorization Successful!</h1>
								<p>You can close this window and return to the terminal.</p>
							</body>
						</html>
					`);

					server.close();
					resolve(code);
				} else {
					res.writeHead(400, { 'Content-Type': 'text/html' });
					res.end(`
						<html>
							<body style="font-family: system-ui; padding: 40px; text-align: center;">
								<h1>❌ Authorization Failed</h1>
								<p>No authorization code received.</p>
							</body>
						</html>
					`);

					server.close();
					reject(new Error('No authorization code received'));
				}
			} else {
				res.end('Invalid endpoint');
			}
		});

		server.listen(3002, () => {
			console.log('✅ Server ready and listening for callback...\n');
		});

		// Timeout after 5 minutes
		setTimeout(() => {
			server.close();
			reject(new Error('Authorization timeout after 5 minutes'));
		}, 5 * 60 * 1000);
	});

	console.log('✅ Authorization code received!\n');

	// Step 3: Exchange code for tokens
	console.log('🔄 Step 3: Exchanging code for tokens...\n');

	const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			code: authCode,
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
			redirect_uri: REDIRECT_URI,
			grant_type: 'authorization_code',
		}),
	});

	if (!tokenResponse.ok) {
		const error = await tokenResponse.text();
		throw new Error(`Failed to exchange code for tokens: ${error}`);
	}

	const tokens = await tokenResponse.json();

	// Step 4: Display results
	console.log('='.repeat(80));
	console.log('✅ SUCCESS! Refresh Token Generated\n');
	console.log('='.repeat(80));
	console.log();
	console.log('📋 Add these to your .env file:\n');
	console.log('# Google Ads OAuth Credentials');
	console.log(`GOOGLE_ADS_CLIENT_ID=${CLIENT_ID}`);
	console.log(`GOOGLE_ADS_CLIENT_SECRET=${CLIENT_SECRET}`);
	console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);
	console.log();
	console.log('='.repeat(80));
	console.log();
	console.log('💡 Next Steps:');
	console.log('   1. Copy the variables above to your .env file');
	console.log('   2. Make sure you also have:');
	console.log('      - GOOGLE_ADS_DEVELOPER_TOKEN=swQQBb1hPh8Ofid5fnDgjg');
	console.log('      - GOOGLE_ADS_CUSTOMER_ID=517-565-4322');
	console.log('   3. Test the connection with: npx tsx test-google-ads-connection.ts');
	console.log();

	// Also show access token for testing
	if (tokens.access_token) {
		console.log('🔑 Access Token (expires in 1 hour):');
		console.log(`   ${tokens.access_token.substring(0, 50)}...`);
		console.log();
	}
}

// Run the generator
generateRefreshToken()
	.then(() => {
		console.log('✅ Complete!\n');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Error:', error.message);
		process.exit(1);
	});

/**
 * Load Bulk Client Emails from Rube Workbench into Database
 *
 * Loads the 1883 parsed emails from Rube into the interactions table
 * with proper client profile mapping and deduplication.
 */

import postgres from 'postgres';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
const EMAILS_FILE = process.env.EMAILS_FILE || './parsed_emails.json';

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL environment variable required');
	process.exit(1);
}

// Client domain configuration
const CLIENT_DOMAINS = [
	{
		domain: 'stewartgolf.com',
		clientName: 'Stewart Golf',
		companyName: 'Stewart Golf Ltd'
	},
	{
		domain: 'windowsupplydirectltd.co.uk',
		clientName: 'Window Supply Direct',
		companyName: 'Window Supply Direct Ltd'
	},
	{
		domain: 'forevergreen-energy.co.uk',
		clientName: 'Forever Green Energy',
		companyName: 'Forever Green Renewables Ltd'
	},
	{
		domain: 'gsgardens.co.uk',
		clientName: 'GS Gardens',
		companyName: 'Green Signals Gardens Ltd'
	}
];

interface ParsedEmail {
	messageId: string;
	threadId: string;
	subject: string;
	sender: string;
	to: string;
	body: string;
	messageTimestamp: string;
	labelIds: string[];
	participants: Array<{ name: string; email: string }>;
	clientDomain: string;
	clientName: string;
	companyName: string;
}

async function loadBulkEmails() {
	const sql = postgres(DATABASE_URL);

	try {
		console.log('📧 Starting bulk email load process...\n');

		// Step 1: Load parsed emails from file
		if (!fs.existsSync(EMAILS_FILE)) {
			console.error(`❌ Emails file not found: ${EMAILS_FILE}`);
			console.error('Please download the file from Rube workbench first.');
			process.exit(1);
		}

		const emailsData: ParsedEmail[] = JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf-8'));
		console.log(`✅ Loaded ${emailsData.length} emails from file\n`);

		// Step 2: Get or create user ID
		const [user] = await sql`
			SELECT id FROM "user" LIMIT 1
		`;

		if (!user) {
			console.error('❌ No user found in database. Please create a user first.');
			process.exit(1);
		}

		const userId = user.id;
		console.log(`✅ Using user ID: ${userId}\n`);

		// Step 3: Create or get client profiles
		console.log('📋 Setting up client profiles...');
		const clientProfileMap = new Map<string, string>();

		for (const client of CLIENT_DOMAINS) {
			const existing = await sql`
				SELECT id FROM client_profiles
				WHERE company_name = ${client.companyName}
				AND user_id = ${userId}
			`;

			let clientProfileId: string;

			if (existing.length > 0) {
				clientProfileId = existing[0].id;
				console.log(`  ✓ Found existing profile: ${client.clientName}`);
			} else {
				const [newProfile] = await sql`
					INSERT INTO client_profiles (
						id, user_id, client_name, client_email, company_name
					) VALUES (
						${randomUUID()}, ${userId}, ${client.clientName}, ${'contact@' + client.domain}, ${client.companyName}
					) RETURNING id
				`;
				clientProfileId = newProfile.id;
				console.log(`  ✓ Created new profile: ${client.clientName}`);
			}

			clientProfileMap.set(client.domain, clientProfileId);
		}

		console.log(`\n✅ ${clientProfileMap.size} client profiles ready\n`);

		// Step 4: Get existing email IDs to avoid duplicates
		console.log('🔍 Checking for existing emails...');
		const existingEmails = await sql`
			SELECT "sourceId" FROM interaction
			WHERE "interactionType" = 'email'
		`;
		const existingEmailIds = new Set(existingEmails.map(e => e.sourceId));
		console.log(`  Found ${existingEmailIds.size} existing emails in database\n`);

		// Step 5: Filter out duplicates
		const newEmails = emailsData.filter(email => !existingEmailIds.has(email.messageId));
		console.log(`📊 Emails to insert: ${newEmails.length} (${emailsData.length - newEmails.length} duplicates skipped)\n`);

		if (newEmails.length === 0) {
			console.log('ℹ️  No new emails to insert. All emails already exist in database.');
			return;
		}

		// Step 6: Insert emails in batches
		const BATCH_SIZE = 50;
		const totalBatches = Math.ceil(newEmails.length / BATCH_SIZE);
		let inserted = 0;
		let errors = 0;

		console.log(`⚡ Inserting ${newEmails.length} emails in ${totalBatches} batches...\n`);

		for (let i = 0; i < newEmails.length; i += BATCH_SIZE) {
			const batch = newEmails.slice(i, i + BATCH_SIZE);
			const batchNum = Math.floor(i / BATCH_SIZE) + 1;

			try {
				await sql.begin(async sql => {
					for (const email of batch) {
						const clientProfileId = clientProfileMap.get(email.clientDomain);

						if (!clientProfileId) {
							console.error(`  ⚠️  No client profile found for domain: ${email.clientDomain}`);
							errors++;
							continue;
						}

						await sql`
							INSERT INTO interaction (
								id, "userId", "clientProfileId", "interactionType", "sourceId",
								title, content, participants, metadata, "interactionDate",
								"createdAt", "updatedAt"
							) VALUES (
								${randomUUID()},
								${userId},
								${clientProfileId},
								'email',
								${email.messageId},
								${email.subject || 'No Subject'},
								${email.body || ''},
								${sql.json(email.participants || [])},
								${sql.json({
									emailThreadId: email.threadId,
									labelIds: email.labelIds || [],
									sender: email.sender,
									to: email.to
								})},
								${new Date(email.messageTimestamp)},
								${new Date()},
								${new Date()}
							)
						`;

						inserted++;
					}
				});

				const progress = ((batchNum / totalBatches) * 100).toFixed(1);
				console.log(`  ✅ Batch ${batchNum}/${totalBatches} complete (${progress}%) - ${inserted} emails inserted`);

			} catch (error: any) {
				console.error(`  ❌ Error in batch ${batchNum}:`, error.message);
				errors += batch.length;
			}
		}

		// Step 7: Show final summary
		const [totalEmails] = await sql`
			SELECT COUNT(*) as count FROM interaction WHERE "interactionType" = 'email'
		`;

		console.log('\n' + '='.repeat(80));
		console.log('EMAIL LOAD COMPLETE');
		console.log('='.repeat(80));
		console.log(`✅ Successfully inserted: ${inserted} emails`);
		if (errors > 0) {
			console.log(`⚠️  Errors encountered: ${errors} emails`);
		}
		console.log(`📊 Total emails in database: ${totalEmails.count}`);

		// Show breakdown by client
		console.log('\nBreakdown by client:');
		for (const [domain, profileId] of clientProfileMap) {
			const [{ count, client_name }] = await sql`
				SELECT COUNT(*)::int as count, cp.client_name
				FROM interaction i
				JOIN client_profiles cp ON i."clientProfileId" = cp.id
				WHERE i."clientProfileId" = ${profileId}
				GROUP BY cp.client_name
			`;
			console.log(`  ${client_name}: ${count} emails`);
		}

		console.log('\n🎯 Next Steps:');
		console.log('  1. Generate Pinecone embeddings for email content');
		console.log('  2. Enable chat to query email history');
		console.log('  3. Test with prompts like "Show me recent emails from Stewart Golf"');

	} catch (error: any) {
		console.error('❌ Error:', error.message);
		throw error;
	} finally {
		await sql.end();
	}
}

loadBulkEmails()
	.then(() => {
		console.log('\n✅ Bulk email loading complete!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Failed:', error);
		process.exit(1);
	});

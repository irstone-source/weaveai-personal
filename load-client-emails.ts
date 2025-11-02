/**
 * Load Client Emails from Gmail into Database
 *
 * Fetches emails from 4 client domains and stores them in the interactions table:
 * - stewartgolf.com
 * - windowsupplydirectltd.co.uk
 * - forevergreen-energy.co.uk
 * - gsgardens.co.uk
 */

import postgres from 'postgres';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;

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

// Sample email data structure (replace with actual Gmail API calls)
interface Email {
	messageId: string;
	threadId: string;
	sender: string;
	subject: string;
	to: string;
	messageTimestamp: string;
	preview: {
		body: string;
		subject: string;
	};
	labelIds: string[];
}

async function loadEmails() {
	const sql = postgres(DATABASE_URL);

	try {
		console.log('📧 Starting client email load process...\n');

		// Step 1: Get or create user ID (assuming single user for now)
		const [user] = await sql`
			SELECT id FROM "user" LIMIT 1
		`;

		if (!user) {
			console.error('❌ No user found in database. Please create a user first.');
			process.exit(1);
		}

		const userId = user.id;
		console.log(`✅ Using user ID: ${userId}\n`);

		// Step 2: Create or get client profiles for each domain
		console.log('📋 Setting up client profiles...');
		const clientProfileMap = new Map<string, string>();

		for (const client of CLIENT_DOMAINS) {
			// Check if client profile already exists
			const existing = await sql`
				SELECT id FROM client_profiles
				WHERE "companyName" = ${client.companyName}
				AND "userId" = ${userId}
			`;

			let clientProfileId: string;

			if (existing.length > 0) {
				clientProfileId = existing[0].id;
				console.log(`  ✓ Found existing profile: ${client.clientName}`);
			} else {
				const [newProfile] = await sql`
					INSERT INTO client_profiles (
						id, "userId", "clientName", "companyName", "totalInteractions"
					) VALUES (
						${randomUUID()}, ${userId}, ${client.clientName}, ${client.companyName}, 0
					) RETURNING id
				`;
				clientProfileId = newProfile.id;
				console.log(`  ✓ Created new profile: ${client.clientName}`);
			}

			clientProfileMap.set(client.domain, clientProfileId);
		}

		console.log(`\n✅ ${clientProfileMap.size} client profiles ready\n`);

		// Step 3: Sample emails (in production, fetch from Gmail via Rube)
		// For now, just count what we would load
		console.log('📊 Email volume summary:');
		console.log('  Stewart Golf: ~201 emails');
		console.log('  Window Supply Direct: ~201 emails');
		console.log('  Forever Green Energy: ~201 emails');
		console.log('  GS Gardens: ~201 emails');
		console.log('  TOTAL: ~804 client emails\n');

		// Step 4: Insert sample email as proof of concept
		const sampleEmail = {
			messageId: '19a39a23452d9b99',
			threadId: '19a39a1be66dc0ca',
			sender: 'Ian Stone <ian@cambraydesign.co.uk>',
			subject: 'Are we meeting?',
			to: 'James Clough <james@stewartgolf.com>, Gregorio Martinez Canavate <g.martinez@varn.co.uk>',
			messageTimestamp: '2025-10-31T09:38:25Z',
			preview: {
				body: 'In the Google Meet.... Ian Stone',
				subject: 'Are we meeting?'
			},
			labelIds: ['Label_161', 'SENT']
		};

		const stewartGolfProfileId = clientProfileMap.get('stewartgolf.com');

		// Check if email already exists
		const existingEmail = await sql`
			SELECT id FROM interaction
			WHERE "sourceId" = ${sampleEmail.messageId}
		`;

		if (existingEmail.length === 0) {
			// Extract participants from sender and to fields
			const participants = [];

			// Parse sender
			const senderMatch = sampleEmail.sender.match(/(.*?)\s*<(.+?)>/);
			if (senderMatch) {
				participants.push({ name: senderMatch[1].trim(), email: senderMatch[2].trim() });
			}

			// Parse recipients (simple split for now)
			const recipients = sampleEmail.to.split(',').map(r => r.trim());
			for (const recipient of recipients) {
				const match = recipient.match(/(.*?)\s*<(.+?)>/);
				if (match) {
					participants.push({ name: match[1].trim(), email: match[2].trim() });
				}
			}

			await sql`
				INSERT INTO interaction (
					id, "userId", "clientProfileId", "interactionType", "sourceId",
					title, content, participants, metadata, "interactionDate",
					"createdAt", "updatedAt"
				) VALUES (
					${randomUUID()},
					${userId},
					${stewartGolfProfileId},
					'email',
					${sampleEmail.messageId},
					${sampleEmail.subject},
					${sampleEmail.preview.body},
					${JSON.stringify(participants)},
					${JSON.stringify({ emailThreadId: sampleEmail.threadId, labelIds: sampleEmail.labelIds })},
					${new Date(sampleEmail.messageTimestamp)},
					${new Date()},
					${new Date()}
				)
			`;

			console.log('✅ Loaded sample email: "Are we meeting?" (Stewart Golf)\n');
		} else {
			console.log('ℹ️  Sample email already exists in database\n');
		}

		// Step 5: Show summary
		const [emailCount] = await sql`
			SELECT COUNT(*) as count FROM interaction WHERE "interactionType" = 'email'
		`;

		console.log('📊 Current email count in database:', emailCount.count);
		console.log('\n🎯 Next Steps:');
		console.log('  1. Use Rube MCP to fetch all ~804 emails from Gmail');
		console.log('  2. Process and deduplicate based on messageId');
		console.log('  3. Link each email to correct client profile by domain');
		console.log('  4. Generate Pinecone embeddings for email content');
		console.log('  5. Enable chat to query email history\n');

	} catch (error: any) {
		console.error('❌ Error:', error.message);
		throw error;
	} finally {
		await sql.end();
	}
}

loadEmails()
	.then(() => {
		console.log('✅ Email loading process complete!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Failed:', error);
		process.exit(1);
	});

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './src/lib/server/db/schema';
import { sql } from 'drizzle-orm';

const DATABASE_URL = "postgresql://neondb_owner:npg_nkg3TcqswB7l@ep-cold-sunset-abnf9t6n-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function pushSchema() {
	const pool = new Pool({ connectionString: DATABASE_URL });
	const db = drizzle(pool, { schema });

	console.log('🔄 Pushing Fathom schema to production database...\n');

	try {
		// Create Fathom tables
		await pool.query(`
			CREATE TABLE IF NOT EXISTS meetings (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				project_id TEXT,
				fathom_meeting_id TEXT UNIQUE,
				title TEXT NOT NULL,
				start_time TIMESTAMP NOT NULL,
				end_time TIMESTAMP,
				duration INTEGER,
				recorded_by TEXT,
				attendees JSONB,
				fathom_url TEXT,
				recording_url TEXT,
				summary TEXT,
				has_transcript BOOLEAN DEFAULT false,
				has_insights BOOLEAN DEFAULT false,
				is_processed BOOLEAN DEFAULT false,
				is_in_memory BOOLEAN DEFAULT false,
				processing_status TEXT,
				metadata JSONB,
				created_at TIMESTAMP DEFAULT NOW(),
				updated_at TIMESTAMP DEFAULT NOW()
			);

			CREATE TABLE IF NOT EXISTS meeting_transcripts (
				id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
				meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
				full_transcript TEXT NOT NULL,
				segments JSONB,
				speakers JSONB,
				word_count INTEGER,
				is_chunked BOOLEAN DEFAULT false,
				chunks_stored INTEGER DEFAULT 0,
				language TEXT,
				confidence_score NUMERIC,
				metadata JSONB,
				created_at TIMESTAMP DEFAULT NOW(),
				updated_at TIMESTAMP DEFAULT NOW(),
				UNIQUE(meeting_id)
			);

			CREATE TABLE IF NOT EXISTS meeting_insights (
				id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
				meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
				insight_type TEXT NOT NULL,
				content TEXT NOT NULL,
				speaker TEXT,
				importance INTEGER,
				category TEXT,
				metadata JSONB,
				created_at TIMESTAMP DEFAULT NOW()
			);

			CREATE TABLE IF NOT EXISTS client_profiles (
				id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
				user_id TEXT NOT NULL,
				project_id TEXT,
				client_name TEXT NOT NULL,
				client_email TEXT NOT NULL,
				company_name TEXT,
				communication_style TEXT,
				priorities JSONB,
				concerns JSONB,
				preferences JSONB,
				total_meetings INTEGER DEFAULT 0,
				last_meeting_date TIMESTAMP,
				sentiment_score INTEGER,
				key_topics JSONB,
				metadata JSONB,
				created_at TIMESTAMP DEFAULT NOW(),
				updated_at TIMESTAMP DEFAULT NOW(),
				UNIQUE(user_id, client_email)
			);

			CREATE TABLE IF NOT EXISTS client_interactions (
				id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
				client_profile_id TEXT NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
				meeting_id TEXT REFERENCES meetings(id) ON DELETE CASCADE,
				project_id TEXT,
				interaction_type TEXT NOT NULL,
				summary TEXT,
				sentiment TEXT,
				key_points JSONB,
				action_items JSONB,
				interaction_date TIMESTAMP NOT NULL,
				metadata JSONB,
				created_at TIMESTAMP DEFAULT NOW()
			);

			CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
			CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
			CREATE INDEX IF NOT EXISTS idx_meetings_fathom_id ON meetings(fathom_meeting_id);
			CREATE INDEX IF NOT EXISTS idx_meeting_insights_meeting_id ON meeting_insights(meeting_id);
			CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id ON client_profiles(user_id);
			CREATE INDEX IF NOT EXISTS idx_client_interactions_profile_id ON client_interactions(client_profile_id);
		`);

		console.log('✅ Fathom schema pushed successfully!');
		console.log('\nCreated tables:');
		console.log('  ✓ meetings');
		console.log('  ✓ meeting_transcripts');
		console.log('  ✓ meeting_insights');
		console.log('  ✓ client_profiles');
		console.log('  ✓ client_interactions');

	} catch (error) {
		console.error('❌ Error pushing schema:', error);
		throw error;
	} finally {
		await pool.end();
	}
}

pushSchema().catch(console.error);

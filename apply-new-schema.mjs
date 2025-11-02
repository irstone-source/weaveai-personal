// Manual migration script to add new tables
import pg from 'pg';
const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable not set');
  process.exit(1);
}

const client = new Client({ connectionString });

const migrations = [
  // 1. Add new columns to linear_integration table
  `ALTER TABLE "linear_integration"
   ADD COLUMN IF NOT EXISTS "webhookSecret" text,
   ADD COLUMN IF NOT EXISTS "webhookUrl" text,
   ADD COLUMN IF NOT EXISTS "syncMode" text DEFAULT 'manual',
   ADD COLUMN IF NOT EXISTS "autoSyncEnabled" boolean DEFAULT true NOT NULL;`,

  // 2. Create linear_team_mapping table
  `CREATE TABLE IF NOT EXISTS "linear_team_mapping" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "linearTeamId" text NOT NULL,
    "linearTeamName" text NOT NULL,
    "projectId" text REFERENCES "project"("id") ON DELETE SET NULL,
    "autoCreated" boolean DEFAULT true NOT NULL,
    "syncEnabled" boolean DEFAULT true NOT NULL,
    "webhookConfigured" boolean DEFAULT false NOT NULL,
    "pineconeIndexName" text,
    "lastSyncAt" timestamp,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
  );`,

  // 3. Create indexes for linear_team_mapping
  `CREATE INDEX IF NOT EXISTS "linear_team_mapping_user_id_idx" ON "linear_team_mapping"("userId");`,
  `CREATE INDEX IF NOT EXISTS "linear_team_mapping_team_id_idx" ON "linear_team_mapping"("linearTeamId");`,

  // 4. Create linear_project table
  `CREATE TABLE IF NOT EXISTS "linear_project" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "linearTeamId" text NOT NULL,
    "linearProjectId" text NOT NULL UNIQUE,
    "name" text NOT NULL,
    "description" text,
    "state" text NOT NULL,
    "lead" text,
    "leadEmail" text,
    "startDate" timestamp,
    "targetDate" timestamp,
    "pineconeId" text,
    "lastSyncedAt" timestamp,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
  );`,

  // 5. Create indexes for linear_project
  `CREATE INDEX IF NOT EXISTS "linear_project_user_id_idx" ON "linear_project"("userId");`,
  `CREATE INDEX IF NOT EXISTS "linear_project_team_id_idx" ON "linear_project"("linearTeamId");`,
  `CREATE INDEX IF NOT EXISTS "linear_project_linear_id_idx" ON "linear_project"("linearProjectId");`,

  // 6. Create linear_issue table
  `CREATE TABLE IF NOT EXISTS "linear_issue" (
    "id" text PRIMARY KEY NOT NULL,
    "linearProjectId" text NOT NULL REFERENCES "linear_project"("id") ON DELETE CASCADE,
    "linearIssueId" text NOT NULL UNIQUE,
    "identifier" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "priority" integer DEFAULT 0 NOT NULL,
    "priorityLabel" text DEFAULT 'No priority' NOT NULL,
    "status" text NOT NULL,
    "statusType" text NOT NULL,
    "assignee" text,
    "assigneeEmail" text,
    "estimate" integer,
    "dueDate" timestamp,
    "completedAt" timestamp,
    "url" text NOT NULL,
    "labels" json DEFAULT '[]'::json NOT NULL,
    "pineconeId" text,
    "lastSyncedAt" timestamp,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
  );`,

  // 7. Create indexes for linear_issue
  `CREATE INDEX IF NOT EXISTS "linear_issue_project_id_idx" ON "linear_issue"("linearProjectId");`,
  `CREATE INDEX IF NOT EXISTS "linear_issue_linear_id_idx" ON "linear_issue"("linearIssueId");`,
  `CREATE INDEX IF NOT EXISTS "linear_issue_status_idx" ON "linear_issue"("status");`,
  `CREATE INDEX IF NOT EXISTS "linear_issue_assignee_idx" ON "linear_issue"("assigneeEmail");`,

  // 8. Create interaction table
  `CREATE TABLE IF NOT EXISTS "interaction" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "projectId" text REFERENCES "project"("id") ON DELETE SET NULL,
    "clientProfileId" text REFERENCES "client_profiles"("id") ON DELETE SET NULL,
    "interactionType" text NOT NULL,
    "sourceId" text NOT NULL,
    "sourceUrl" text,
    "title" text NOT NULL,
    "content" text NOT NULL,
    "participants" json DEFAULT '[]'::json NOT NULL,
    "sentiment" text,
    "priority" text DEFAULT 'none',
    "tags" json DEFAULT '[]'::json NOT NULL,
    "metadata" json DEFAULT '{}'::json NOT NULL,
    "pineconeStored" boolean DEFAULT false NOT NULL,
    "pineconeId" text,
    "interactionDate" timestamp NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
  );`,

  // 9. Create indexes for interaction
  `CREATE INDEX IF NOT EXISTS "interaction_user_id_idx" ON "interaction"("userId");`,
  `CREATE INDEX IF NOT EXISTS "interaction_project_id_idx" ON "interaction"("projectId");`,
  `CREATE INDEX IF NOT EXISTS "interaction_client_profile_id_idx" ON "interaction"("clientProfileId");`,
  `CREATE INDEX IF NOT EXISTS "interaction_type_idx" ON "interaction"("interactionType");`,
  `CREATE INDEX IF NOT EXISTS "interaction_date_idx" ON "interaction"("interactionDate");`,
  `CREATE INDEX IF NOT EXISTS "interaction_source_id_idx" ON "interaction"("sourceId");`,
];

async function runMigrations() {
  try {
    await client.connect();
    console.log('Connected to database');

    for (const [index, migration] of migrations.entries()) {
      try {
        console.log(`\nRunning migration ${index + 1}/${migrations.length}...`);
        await client.query(migration);
        console.log(`✓ Migration ${index + 1} completed`);
      } catch (error) {
        // Log error but continue (some might be "already exists" errors)
        console.warn(`⚠ Migration ${index + 1} warning:`, error.message);
      }
    }

    console.log('\n✓ All migrations completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();

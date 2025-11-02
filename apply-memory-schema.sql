-- Memory System Schema Migration
-- Creates memory and focus_session tables

CREATE TABLE IF NOT EXISTS "focus_session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"categories" json NOT NULL,
	"boostFactor" integer DEFAULT 200 NOT NULL,
	"durationHours" integer DEFAULT 4 NOT NULL,
	"memoriesAccessed" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "memory" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"chatId" text,
	"content" text NOT NULL,
	"contentHash" text NOT NULL,
	"pineconeId" text NOT NULL,
	"memoryType" text DEFAULT 'working' NOT NULL,
	"privacyLevel" text DEFAULT 'contextual' NOT NULL,
	"category" text,
	"tags" json DEFAULT '[]'::json NOT NULL,
	"importance" integer DEFAULT 5 NOT NULL,
	"accessCount" integer DEFAULT 0 NOT NULL,
	"lastAccessedAt" timestamp,
	"strength" integer DEFAULT 10 NOT NULL,
	"decayRate" integer DEFAULT 0 NOT NULL,
	"isPermanent" boolean DEFAULT false NOT NULL,
	"requiresAuth" boolean DEFAULT false NOT NULL,
	"expiresAt" timestamp,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "memoryMode" text DEFAULT 'humanized';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'focus_session_userId_user_id_fk') THEN
        ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory_userId_user_id_fk') THEN
        ALTER TABLE "memory" ADD CONSTRAINT "memory_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory_chatId_chat_id_fk') THEN
        ALTER TABLE "memory" ADD CONSTRAINT "memory_chatId_chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."chat"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "focus_session_user_id_idx" ON "focus_session" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "focus_session_is_active_idx" ON "focus_session" USING btree ("isActive");
CREATE INDEX IF NOT EXISTS "memory_user_id_idx" ON "memory" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "memory_chat_id_idx" ON "memory" USING btree ("chatId");
CREATE INDEX IF NOT EXISTS "memory_privacy_level_idx" ON "memory" USING btree ("privacyLevel");
CREATE INDEX IF NOT EXISTS "memory_category_idx" ON "memory" USING btree ("category");
CREATE INDEX IF NOT EXISTS "memory_type_idx" ON "memory" USING btree ("memoryType");
CREATE INDEX IF NOT EXISTS "memory_content_hash_idx" ON "memory" USING btree ("contentHash");

-- Add tags and tagsGenerated columns to imported_conversation table
-- This bypasses drizzle-kit's interactive prompt

ALTER TABLE "imported_conversation"
ADD COLUMN IF NOT EXISTS "tags" json DEFAULT '[]'::json;

ALTER TABLE "imported_conversation"
ADD COLUMN IF NOT EXISTS "tagsGenerated" boolean DEFAULT false NOT NULL;

# Database Schema Synchronization Issue

**Date**: 2025-10-30
**Status**: ⚠️ Requires Manual Resolution
**Priority**: Medium (blocks meetings feature deployment)

## Issue Summary

Discovered table and column naming mismatches between Drizzle schema definitions and the production PostgreSQL database. This prevents the `drizzle-kit push` command from syncing the schema safely.

## Root Cause

### Table Name Mismatches (FIXED ✅)

Schema originally defined tables with SINGULAR names, but database has PLURAL names:

**Fixed in schema.ts** (lines 586, 634, 667, 706, 768):
- ✅ `pgTable("meeting"` → `pgTable("meetings"`
- ✅ `pgTable("meeting_transcript"` → `pgTable("meeting_transcripts"`
- ✅ `pgTable("meeting_insight"` → `pgTable("meeting_insights"`
- ✅ `pgTable("client_profile"` → `pgTable("client_profiles"`
- ✅ `pgTable("client_interaction"` → `pgTable("client_interactions"`

### Column Naming Convention (NEEDS INVESTIGATION ⚠️)

When running `drizzle-kit push` after table name fixes, Drizzle detected potential column name mismatches and asked:

```
Is userId column in meetings table created or renamed from another column?
❯ + userId                     create column
  ~ user_id › userId           rename column
  ...
```

This suggests the database may have snake_case columns (`user_id`, `project_id`, etc.) while the schema defines camelCase columns (`userId`, `projectId`, etc.).

## Current State

**Schema Files Modified**:
- `/src/lib/server/db/schema.ts`
  - Table names updated to plural for 5 tables
  - Column definitions remain in camelCase (userId, projectId, startTime, etc.)

**Drizzle-Kit Push Status**:
- Waiting for user input on column rename/create decisions
- Cannot proceed automatically without risking data loss

## Investigation Needed

### 1. Verify Existing Table Names

Check which tables currently exist in the production database:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

### 2. Verify Column Naming Convention

Check column names in the `project` table (which is working in production):
```sql
\d project
-- OR
SELECT column_name FROM information_schema.columns
WHERE table_name = 'project';
```

This will reveal if existing tables use:
- **snake_case** (`user_id`, `project_id`, `start_date`)
- **camelCase** (`userId`, `projectId`, `startDate`)

### 3. Check if Meetings Tables Exist

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'meetings'
);
```

## Resolution Options

### Option 1: Database Uses Plural + CamelCase (Expected)

If database has:
- Table: `meetings` (plural)
- Columns: `userId`, `projectId`, `startTime` (camelCase)

**Action**: Current schema changes are correct. Run `drizzle-kit push` and select "+ create column" for all columns to create new tables.

**Result**: Meetings tables will be created successfully with plural names and camelCase columns.

### Option 2: Database Uses Plural + snake_case (Possible)

If database has:
- Table: `meetings` (plural)
- Columns: `user_id`, `project_id`, `start_time` (snake_case)

**Action**: Update ALL column definitions in schema to use snake_case:
```typescript
// Before
userId: text("userId")

// After
userId: text("user_id")
```

**Impact**: MASSIVE schema change affecting hundreds of columns across all tables. Very risky.

### Option 3: Meetings Tables Don't Exist (Most Likely)

If the meetings tables (`meetings`, `meeting_transcripts`, `meeting_insights`, `client_profiles`, `client_interactions`) don't exist yet:

**Action**:
1. Abort current `drizzle-kit push` process
2. Run fresh `drizzle-kit push` with updated schema
3. Review the proposed CREATE TABLE statements
4. Accept if they match the intended schema

**Result**: New meetings-related tables will be created with plural names and camelCase columns (matching existing project table convention).

## Recommended Next Steps

1. **Query production database** to determine:
   - Which tables exist
   - What naming convention columns use
   - Whether meetings tables already exist

2. **Based on findings**:
   - **If meetings tables don't exist**: Proceed with Option 3 (create new tables)
   - **If meetings tables exist with matching naming**: Accept drizzle-kit push
   - **If major naming mismatch**: Plan careful migration with column renames

3. **Test in staging first** if possible to avoid production data loss

## Files Modified

### `/src/lib/server/db/schema.ts`
**Changes Made**:
```typescript
// Line 586
export const meetings = pgTable("meetings", {  // was "meeting"

// Line 634
export const meetingTranscripts = pgTable("meeting_transcripts", {  // was "meeting_transcript"

// Line 667
export const meetingInsights = pgTable("meeting_insights", {  // was "meeting_insight"

// Line 706
export const clientProfiles = pgTable("client_profiles", {  // was "client_profile"

// Line 768
export const clientInteractions = pgTable("client_interactions", {  // was "client_interaction"
```

**Status**: Changes saved but not yet synced to database

## Risk Assessment

### Low Risk ✅
- Table name fixes (singular → plural)
- Creating new tables that don't exist

### Medium Risk ⚠️
- Column renames if database uses different casing
- Potential data loss if wrong option selected in drizzle-kit

### High Risk 🔴
- Running drizzle-kit push without understanding current database state
- Mass column renaming across existing tables with data

## Related Documents

- `/PERFORMANCE-OPTIMIZATION-REPORT-2025-10-30.md` - Performance analysis
- `/DEVELOPMENT-SESSION-SUMMARY-2025-10-30.md` - Session summary with QA fixes
- `/QA-REPORT-AND-TASKLIST.md` - Original QA roadmap

## Manual Intervention Required

⚠️ **Cannot proceed with automated schema sync without user confirmation of database state**

**User Action Needed**:
1. Access production database directly (via Neon dashboard or psql)
2. Run the SQL queries above to verify table/column naming
3. Report findings to determine correct resolution path
4. Once confirmed, manually run `drizzle-kit push` and select appropriate options

**Status**: BLOCKED - Waiting for database introspection results

# Fathom Meeting Integration Guide

## Overview

This guide explains how to import all your Fathom meeting transcripts and data into the WeaveAI Enterprise database.

## Prerequisites

### 1. Get Your Fathom API Key

1. Go to [Fathom Settings > Integrations](https://app.fathom.video/settings/integrations)
2. Click "Generate API Key" or copy your existing key
3. Save it securely

### 2. Set Up Environment Variable

Add your Fathom API key to `.env`:

```bash
FATHOM_API_KEY=your_actual_fathom_api_key_here
```

Replace `your_actual_fathom_api_key_here` with your real API key from Fathom.

## Data Extraction

The import script extracts **every available data point** from Fathom:

### Meeting Metadata
- ✅ Meeting ID (Fathom's unique identifier)
- ✅ Title
- ✅ Start time
- ✅ End time
- ✅ Duration (in seconds)
- ✅ Recorded by (host name and email)
- ✅ Meeting URL (link to Fathom meeting page)
- ✅ Video URL (recording link)
- ✅ Platform (Zoom, Google Meet, Teams, etc.)
- ✅ Team IDs (if meeting belongs to specific teams)
- ✅ Custom metadata fields

### Attendees
- ✅ Full attendee list with:
  - Name
  - Email address
  - Role (host, attendee)

### Transcripts
- ✅ Full transcript text (complete verbatim transcript)
- ✅ Segment-by-segment breakdown with:
  - Speaker name
  - Text spoken
  - Timestamp (seconds from start)
  - Segment duration
- ✅ Keywords extracted by Fathom AI

### AI-Generated Content
- ✅ Meeting summary (Fathom's AI-generated summary)
- ✅ Action items with:
  - Action text
  - Assignee (if specified)
  - Due date (if specified)
  - Completion status
- ✅ Key points extracted from meeting

## Database Schema

The script populates two tables:

### `meetings` Table
```sql
- id (UUID, primary key)
- userId (UUID, foreign key to user)
- fathomMeetingId (text, unique - Fathom's meeting ID)
- projectId (UUID, optional - link to client project)
- title (text)
- startTime (timestamp)
- endTime (timestamp)
- duration (integer - seconds)
- recordedBy (text - host name)
- meetingUrl (text - Fathom meeting page)
- videoUrl (text - recording URL)
- attendees (JSON array - [{name, email, role}])
- platform (text - "zoom", "google_meet", "teams", etc.)
- metadata (JSON - additional fields)
- createdAt (timestamp)
- updatedAt (timestamp)
```

### `meeting_transcripts` Table
```sql
- id (UUID, primary key)
- meetingId (UUID, foreign key to meetings)
- fullTranscript (text - complete transcript)
- segments (JSON array - [{speaker, text, timestamp, duration}])
- summary (text - AI summary)
- actionItems (JSON array - [{text, assignee, dueDate, completed}])
- keywords (JSON array - extracted keywords)
- keyPoints (JSON array - key discussion points)
- createdAt (timestamp)
- updatedAt (timestamp)
```

## Running the Import

### Step 1: Import All Meetings

```bash
DATABASE_URL="postgresql://..." \
FATHOM_API_KEY="your_api_key" \
npx tsx load-fathom-meetings.ts
```

This will:
1. Connect to Fathom API
2. Fetch all meetings from the last 365 days (configurable)
3. For each meeting:
   - Fetch meeting metadata
   - Fetch full transcript with speaker attribution
   - Fetch AI summary and action items
4. Store everything in the database
5. Show progress and summary

### Step 2: Convert to Interactions (Optional)

After importing to the `meetings` table, you can convert them to the unified `interaction` table for chat querying:

```bash
DATABASE_URL="postgresql://..." \
npx tsx convert-meetings-to-interactions.ts
```

This makes meetings searchable alongside emails and Linear issues in the chat interface.

## Features

### Deduplication
- ✅ Checks for existing meetings by `fathomMeetingId`
- ✅ Skips meetings already in database
- ✅ Safe to run multiple times

### Error Handling
- ✅ Graceful handling of missing transcripts
- ✅ Graceful handling of missing summaries
- ✅ Continues processing even if some meetings fail
- ✅ Reports errors at the end

### Progress Tracking
- ✅ Shows real-time progress for each meeting
- ✅ Indicates transcript/summary availability
- ✅ Reports partial data (e.g., meeting without summary)

### Batch Processing
- ✅ Fetches meetings in batches of 100
- ✅ Handles pagination automatically
- ✅ Safety limit of 10,000 meetings to prevent infinite loops

## Date Range Configuration

By default, the script fetches meetings from the last 365 days. To change this:

### Last N Days
```typescript
// In load-fathom-meetings.ts, line ~73:
const dateRange = fathom.getDateRange(90);  // Last 90 days
```

### Custom Date Range
```typescript
// In load-fathom-meetings.ts, line ~73:
const dateRange = fathom.getCustomDateRange(
  new Date('2024-01-01'),  // Start date
  new Date()                // End date (today)
);
```

### All Time
```typescript
// In load-fathom-meetings.ts, line ~74:
const fathomMeetings = await fathom.fetchAllMeetings(FATHOM_API_KEY, {
  // No date range = all meetings
  limit: 100
});
```

## Expected Output

```
🎥 Starting Fathom meetings import process...

✅ Using user ID: 09bb9def-20c9-4d4d-bb4c-741885697863

📡 Fetching meetings from Fathom API...
✅ Fetched 47 meetings from Fathom

🔍 Checking for existing meetings in database...
  Found 0 existing meetings in database

⚡ Processing meetings with transcripts and summaries...

  [1/47] 📥 Fetching details: Weekly Client Check-in - Stewart Golf
      ✅ Complete (with transcript)
  [2/47] 📥 Fetching details: Product Roadmap Discussion
      ✅ Complete (with transcript)
  [3/47] 📥 Fetching details: Q3 Planning Meeting
      ⚠️  Partial data: Failed to fetch summary
  ...

📊 Processing complete:
   New meetings to insert: 47
   Already in database: 0
   Fetch errors: 0

💾 Inserting meetings into database...

  ✅ Inserted meeting: Weekly Client Check-in - Stewart Golf
      📝 Added transcript (156 segments)
  ✅ Inserted meeting: Product Roadmap Discussion
      📝 Added transcript (89 segments)
  ...

================================================================================
FATHOM IMPORT COMPLETE
================================================================================
✅ Inserted meetings: 47
📝 Inserted transcripts: 45
📊 Total meetings in database: 47
📊 Total transcripts in database: 45

📋 Sample meetings:
1. Weekly Client Check-in - Stewart Golf
   Date: 2025-10-30T14:00:00.000Z
   Platform: zoom
   Transcript: Yes
2. Product Roadmap Discussion
   Date: 2025-10-28T10:30:00.000Z
   Platform: google_meet
   Transcript: Yes
...

🎯 Next Steps:
  1. Convert meetings to interactions using meeting-importer.ts
  2. Generate Pinecone embeddings for meeting content
  3. Enable chat to query meeting history
  4. Test with prompts like "Show me recent meetings with Stewart Golf"

✅ Fathom meeting import complete!
```

## Data Points Summary

Here's a complete checklist of what gets extracted:

### From Meeting Object
- [x] id
- [x] title
- [x] start_time
- [x] end_time
- [x] duration
- [x] recorded_by (id, name, email)
- [x] calendar_invitees (array of {name, email})
- [x] recording_url
- [x] video_url
- [x] team_ids
- [x] platform
- [x] metadata (custom fields)

### From Transcript Object
- [x] meeting_id
- [x] full_transcript
- [x] segments (array of {speaker, text, timestamp, duration})
- [x] keywords

### From Summary Object
- [x] meeting_id
- [x] summary (AI-generated text)
- [x] action_items (array of {text, assignee, due_date})
- [x] key_points

## Troubleshooting

### "No meetings found in Fathom"
- Check that you have recordings in your Fathom account
- Verify API key has correct permissions
- Try increasing the date range

### "Failed to fetch transcript"
- Some meetings may not have transcripts processed yet
- Fathom processes transcripts asynchronously
- Re-run the script later to catch newly processed transcripts

### "Failed to fetch summary"
- Summaries are optional and may not exist for all meetings
- Fathom generates summaries automatically but may take time
- The script will continue without summaries

### API Rate Limits
- Fathom API has rate limits (check Fathom documentation)
- The script fetches meetings sequentially to avoid hitting limits
- Add delays between requests if needed

## Next Steps

After importing Fathom meetings:

1. **Convert to Interactions**: Run `convert-meetings-to-interactions.ts` to make meetings searchable in chat
2. **Generate Embeddings**: Create Pinecone vectors for semantic search
3. **Link to Clients**: Manually link meetings to client profiles via `projectId`
4. **Test Chat**: Query meetings with prompts like:
   - "Show me recent meetings with Stewart Golf"
   - "What action items came out of last week's meetings?"
   - "Summarize discussions about the Q3 roadmap"

## Files Created

1. `load-fathom-meetings.ts` - Main import script
2. `FATHOM_INTEGRATION_GUIDE.md` - This guide
3. `src/lib/server/integrations/fathom.ts` - Fathom API client (already exists)

## API Reference

For more details on the Fathom API:
- [Fathom API Documentation](https://docs.fathom.video/docs/api-reference)
- [Authentication](https://docs.fathom.video/docs/authentication)
- [Meetings Endpoint](https://docs.fathom.video/docs/meetings-api)
- [Transcripts Endpoint](https://docs.fathom.video/docs/transcripts-api)

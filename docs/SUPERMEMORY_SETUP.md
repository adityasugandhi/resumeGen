# SuperMemory Integration Setup Guide

## Overview

SuperMemory has been integrated into the resume optimization platform as an optional **context augmentation layer**. It provides persistent career memory capabilities while maintaining the local-first architecture.

## Quick Start

### 1. Get SuperMemory API Key

1. Sign up at [https://console.supermemory.ai](https://console.supermemory.ai)
2. Create a new project (free tier available)
3. Copy your API key from the dashboard

### 2. Configure Environment Variables

Add your SuperMemory API key to `.env.local`:

```bash
SUPERMEMORY_API_KEY=your_api_key_here
```

**Note**: Replace `your_api_key_here` with your actual API key.

### 3. Enable SuperMemory Features

1. Start the development server: `npm run dev`
2. Navigate to [http://localhost:3000/settings](http://localhost:3000/settings)
3. Toggle "SuperMemory Features" to enable
4. Review and accept the privacy notice
5. Click "Sync Now" to perform initial sync

## Features

### What Gets Synced

SuperMemory stores your career data for enhanced AI context:

- **Resume Components**: Experiences, skills, projects, education
- **Job Postings**: Scanned job listings with semantic embeddings
- **Resume Versions**: Tailored resumes with tracked changes
- **Application Outcomes**: Interview results, feedback (when tracked)

### What Stays Local

The following data remains only in IndexedDB (never synced):

- LaTeX compilation files and PDFs
- Local file system structure
- UI preferences and settings
- PDF preview data

### Benefits

1. **Context-Aware Optimization**: AI can reference past successful resume optimizations
2. **Semantic Job Search**: Find similar jobs across all scanned postings
3. **Pattern Learning**: System learns which resume changes lead to interviews
4. **Cross-Device Sync**: Access career data from any device (future feature)
5. **Historical Insights**: Track resume evolution and application patterns

## Usage

### Auto-Sync

Enable auto-sync to automatically sync new jobs and resume versions to SuperMemory:

1. Go to Settings → SuperMemory Sync
2. Toggle "Auto-sync" on
3. New items will sync automatically

### Manual Sync

Perform manual sync at any time:

1. Go to Settings → SuperMemory Sync
2. Click "Sync Now"
3. Wait for sync to complete (progress shown in UI)

### Check Sync Status

View sync statistics and connection status:

- **Last Synced**: Time of last successful sync
- **Stats**: Number of jobs, resumes, and total memories synced
- **Connection Indicator**: Green dot = connected, Red dot = disconnected

## Architecture

### Dual Storage Strategy

```
User Action → IndexedDB (primary) → SuperMemory (optional sync)
                ↓                           ↓
         Local state (Zustand)      Semantic search & context
                ↓                           ↓
         UI rendering ←────── Context-enriched AI responses
```

### Key Principles

1. **Local-First**: All features work without SuperMemory
2. **Opt-In**: Users must explicitly enable sync
3. **Privacy**: User controls what gets synced
4. **Graceful Degradation**: App continues to function if SuperMemory is unavailable

## API Endpoints

### `/api/supermemory/sync`

**POST**: Perform full sync

```bash
curl -X POST http://localhost:3000/api/supermemory/sync \
  -H "Content-Type: application/json" \
  -d '{"userId": "default-user"}'
```

**GET**: Check sync status

```bash
curl http://localhost:3000/api/supermemory/sync
```

## Troubleshooting

### "SuperMemory is not configured"

**Cause**: API key missing or invalid

**Solution**:
1. Check `.env.local` has `SUPERMEMORY_API_KEY`
2. Verify API key is correct (no extra spaces)
3. Restart dev server: `npm run dev`

### "Failed to connect to SuperMemory"

**Cause**: Network issues or SuperMemory service unavailable

**Solution**:
1. Check internet connection
2. Verify SuperMemory status: [https://status.supermemory.ai](https://status.supermemory.ai)
3. Try again in a few minutes

### "Sync completed with errors"

**Cause**: Some items failed to sync (rate limits, invalid data)

**Solution**:
1. Check browser console for detailed errors
2. Wait 1-2 minutes (rate limit cooldown)
3. Try syncing again

### "Rate limit exceeded"

**Cause**: Free tier limit reached (100 requests/hour)

**Solution**:
1. Wait 1 hour for limit reset
2. Consider upgrading to paid tier
3. Disable auto-sync to reduce requests

## Privacy & Security

### Data Sent to SuperMemory

When enabled, the following data is sent to SuperMemory's cloud API:

- Resume content (experiences, skills, projects)
- Job posting details (title, company, requirements)
- Resume optimization history

### Data Retention

- SuperMemory may log requests for 30 days
- Data persists in SuperMemory until manually deleted
- Review SuperMemory's privacy policy: [https://groq.com/privacy-policy/](https://groq.com/privacy-policy/)

### Best Practices

1. **Review Sensitive Information**: Remove personal addresses/phone numbers before syncing
2. **API Key Security**: Never commit `.env.local` to git
3. **Regular Cleanup**: Periodically review synced data
4. **Disable When Not Needed**: Turn off SuperMemory if not using AI features

## Rate Limits

### Free Tier
- **Requests/Hour**: 100
- **Cost**: $0
- **Window**: Rolling 60 minutes

### Paid Tier
- **Requests/Hour**: 1,000+
- **Cost**: Subscription-based (see SuperMemory pricing)

### Managing Rate Limits

1. **Use Auto-Sync Wisely**: Disable if scanning many jobs at once
2. **Batch Operations**: Sync performs batched requests automatically
3. **Monitor Usage**: Check sync stats regularly

## Advanced Configuration

### Custom User IDs

By default, the app uses `'default-user'` as the user ID. To implement multi-user support:

1. Update `components/supermemory/SyncPanel.tsx`:
   ```typescript
   const USER_ID = getUserId(); // Your auth system
   ```

2. Pass user ID to all sync operations

### Selective Sync

To sync only specific data types, modify `lib/supermemory/sync.ts`:

```typescript
// Sync only jobs, skip resume versions
export async function syncJobsOnly(userId: string): Promise<SyncResult> {
  const operations = await syncJobs(userId);
  // Return result
}
```

### Custom Metadata

Add custom metadata to synced items in `lib/supermemory/sync.ts`:

```typescript
const metadata: JobPostingMetadata = {
  // ... existing fields
  customField: 'custom value',
  tags: ['important', 'high-priority'],
};
```

## Next Steps

### Phase 2: Job Tracking Enhancement

- Semantic job search using SuperMemory
- Context-aware job analysis
- Historical match scores

### Phase 3: Resume Optimization with Memory

- Inject relevant past optimizations into AI prompts
- Track successful change patterns
- Cover letter generation with writing style memory

### Phase 4: Learning Loop

- Application outcome tracking
- Success pattern analysis
- Insights dashboard

## Support

- **SuperMemory Docs**: [https://supermemory.ai/docs](https://supermemory.ai/docs)
- **GitHub Issues**: Report bugs in the project repo
- **Console**: [https://console.supermemory.ai](https://console.supermemory.ai)

## Version History

- **v1.0.0** (Current): Phase 1 - Core Infrastructure
  - Client singleton with error handling
  - Service abstraction layer
  - IndexedDB → SuperMemory sync
  - Zustand store for state management
  - SyncPanel UI component
  - Settings page integration

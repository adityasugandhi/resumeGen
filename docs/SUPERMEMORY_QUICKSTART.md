# SuperMemory Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Get API Key (2 minutes)

1. Visit [https://console.supermemory.ai](https://console.supermemory.ai)
2. Sign up (free tier: 100 requests/hour)
3. Copy your API key

### Step 2: Configure (1 minute)

Add to `.env.local`:
```bash
SUPERMEMORY_API_KEY=your_actual_api_key_here
```

**Important**: Replace `your_actual_api_key_here` with your real API key!

### Step 3: Enable & Sync (2 minutes)

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Navigate to settings:
   ```
   http://localhost:3000/settings
   ```

3. Toggle "SuperMemory Features" ON
4. Accept the privacy notice
5. Click "Sync Now"

**Done!** Your career data is now synced to SuperMemory.

---

## 🎯 What Gets Synced?

When you click "Sync Now", the system will:

✅ Parse your master resume into components
✅ Sync all scanned job postings
✅ Sync all tailored resume versions
✅ Create semantic embeddings for search

**Typical sync time**: 5-15 seconds (depending on data volume)

---

## ⚙️ Auto-Sync (Optional)

Enable auto-sync to automatically sync new items:

1. Go to Settings → SuperMemory Sync
2. Toggle "Auto-sync" ON
3. New jobs and resumes will sync automatically

**Note**: Auto-sync uses your API quota. Disable if you're close to the 100 req/hour limit.

---

## 🔍 How to Use

### Semantic Job Search (Phase 2 - Coming Soon)
```typescript
// Find similar jobs across all scanned postings
const similarJobs = await jobPostingService.search(
  'user-123',
  'senior react developer remote',
  10
);
```

### Context-Aware Resume Optimization (Phase 3 - Coming Soon)
```typescript
// AI will use past successful optimizations for context
const optimized = await optimizeResumeWithMemory(
  jobId,
  resumeLatex,
  userId
);
```

---

## 📊 Monitor Sync Status

### UI Indicators

**Connection Status**:
- 🟢 Green dot = Connected
- 🔴 Red dot = Disconnected

**Sync Statistics**:
- Jobs synced
- Resume versions synced
- Total memories

**Last Synced**: Shows time of last successful sync

---

## 🛠️ Troubleshooting

### Issue: "SuperMemory is not configured"

**Fix**:
```bash
# 1. Check .env.local has API key
cat .env.local | grep SUPERMEMORY

# 2. Restart dev server
npm run dev
```

### Issue: "Failed to connect"

**Checks**:
- [ ] API key is correct (no extra spaces)
- [ ] Internet connection working
- [ ] SuperMemory service status: [status.supermemory.ai](https://status.supermemory.ai)

### Issue: "Rate limit exceeded"

**Solutions**:
1. **Wait**: Free tier resets every hour
2. **Disable auto-sync**: Reduce request frequency
3. **Upgrade**: Get paid tier for 1,000+ req/hour

---

## 📚 Learn More

- **Full Setup Guide**: [SUPERMEMORY_SETUP.md](./SUPERMEMORY_SETUP.md)
- **Phase 1 Summary**: [SUPERMEMORY_PHASE1_SUMMARY.md](./SUPERMEMORY_PHASE1_SUMMARY.md)
- **Project Documentation**: [../CLAUDE.md](../CLAUDE.md)
- **SuperMemory Docs**: [supermemory.ai/docs](https://supermemory.ai/docs)

---

## 🎉 Next Steps

After completing setup:

1. ✅ **Test the sync**: Scan a job, then check if it syncs
2. ✅ **Try manual sync**: Click "Sync Now" and monitor progress
3. ✅ **Explore settings**: Toggle auto-sync, check connection status
4. 📖 **Read full docs**: Learn about advanced features coming in Phase 2-4

---

**Need help?** Check [SUPERMEMORY_SETUP.md](./SUPERMEMORY_SETUP.md) for detailed troubleshooting.

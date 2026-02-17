# Common Debugging Tasks

## LaTeX Compilation Issues

**Check Docker Installation**:

```bash
# Check if Docker is running
docker ps

# Check Docker version
docker --version

# Check if texlive image is available
docker images texlive/texlive

# Pull texlive image if missing
docker pull texlive/texlive:latest

# Test Docker compilation manually
mkdir test-latex
cd test-latex
echo '\documentclass{article}\begin{document}Hello World\end{document}' > test.tex
docker run --rm -v "$(pwd):/workspace" -w /workspace texlive/texlive:latest pdflatex test.tex
```

**Compilation Timeout**:
Adjust `maxDuration` in `app/api/compile/route.ts` (default: 30 seconds)

**Docker Container Issues**:
```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# Clean up stopped containers
docker container prune

# Check Docker logs
docker logs <container-id>
```

## AI Features Debugging

**Check Groq API Configuration**:

```bash
# Verify API key is set
cat .env.local | grep GROQ_API_KEY

# Test API connectivity
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

**Job Scanning Failures**:

1. **Error: "Failed to fetch job posting"**
   - Some sites block scraping or require authentication
   - Try different job boards (LinkedIn often works)
   - Verify URL is accessible in browser

2. **Error: "Could not extract meaningful content"**
   - Dynamic JS-loaded content may not be captured
   - HTML structure may be too complex
   - Future feature: Manual job entry as alternative

3. **Error: "No text response from Groq"**
   - Check `.env.local` has valid `GROQ_API_KEY`
   - Verify API key has remaining credits
   - Check Groq status: https://status.groq.com/

**Resume Optimization Failures**:

1. **Error: "Please open a resume file in the editor first"**
   - Navigate to main editor (`/`), open a `.tex` file
   - Ensure file is loaded in `editorStore` before optimizing

2. **Error: "Failed to optimize resume with AI"**
   - API key missing or invalid
   - Resume file too large (>10KB LaTeX)
   - Groq rate limit exceeded (wait 1 minute)

**Semantic Matching Issues**:

1. **Error: "Failed to initialize embedding model"**
   - Browser cache issues or network problems
   - Clear browser cache and reload
   - Check internet connection (model downloads on first use ~20MB)
   - Try Chrome/Edge instead of Safari

2. **Slow embedding generation**:
   - First run downloads model (~20MB, one-time)
   - Subsequent runs use cached model (2-5 seconds)
   - Keep browser tab active during processing

**Check Groq Model Configuration**:

```typescript
// Verify models in use (check console output)
console.log('Job Parser Model:', process.env.GROQ_JOB_PARSER_MODEL);
console.log('Optimizer Model:', process.env.GROQ_OPTIMIZER_MODEL);
```

**API Rate Limits** (Groq):
- **Free Tier**: 14,400 requests/day, 30 requests/minute
- **Paid Tier**: 60+ requests/minute
- **Error**: "Rate limit exceeded" → Wait 60 seconds
- **Cost per operation**:
  - Job scan: ~$0.004-0.01
  - Resume optimization: ~$0.01-0.02

## Data Management

**Clear IndexedDB**:

Open DevTools → Application tab → IndexedDB → Delete `latex-editor-db`

**Export Jobs Data** (for backup):

```javascript
// Run in browser console
const db = await window.indexedDB.open('latex-editor-db', 2);
const tx = db.transaction(['jobs'], 'readonly');
const store = tx.objectStore('jobs');
const jobs = await store.getAll();
console.log(JSON.stringify(jobs, null, 2));
```

**Check Store Sizes**:

```javascript
// Run in browser console
async function checkStoreSizes() {
  const db = await window.indexedDB.open('latex-editor-db', 2);
  const stores = ['files', 'jobs', 'resumeVersions', 'masterResume'];
  for (const storeName of stores) {
    const tx = db.transaction([storeName], 'readonly');
    const count = await tx.objectStore(storeName).count();
    console.log(`${storeName}: ${count} items`);
  }
}
checkStoreSizes();
```

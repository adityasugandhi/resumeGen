# AI Job Scanning & Resume Tailoring System

Complete AI-powered system for scanning job postings, performing semantic matching, and generating optimized resume versions with track changes.

## Features

### 1. Job URL Scanning
- Paste any job posting URL
- AI extracts: title, company, location, salary, requirements, responsibilities
- Generates semantic embeddings for matching
- Stores in local IndexedDB (fully offline-capable)

### 2. Semantic Matching
- Client-side vector embeddings using Xenova Transformers
- Calculates similarity between job requirements and your resume
- Match scores (0-100%) for each job
- Gap analysis showing missing qualifications

### 3. AI Resume Optimization
- Claude analyzes your resume against specific job requirements
- Suggests strategic changes to improve match
- Maintains honesty (no fabrication)
- Track changes with reasoning for each modification

### 4. Preview Modal with Track Changes
- Overlay view: Clean resume with color-coded highlights
- Detailed view: Side-by-side comparison with accept/reject controls
- Change types: Added (green), Modified (yellow), Deleted (red)
- Export optimized resume to LaTeX compiler

## Architecture

### Tech Stack
- **AI**: Groq (multiple optimized models) for job parsing & optimization
  - Job Parsing: `llama3-groq-70b-8192-tool-use-preview` (tool calling optimized)
  - Resume Optimization: `llama-3.3-70b-versatile` (reasoning optimized)
- **Embeddings**: Xenova Transformers (all-MiniLM-L6-v2) - runs in browser
- **Storage**: IndexedDB (local-first, no backend database)
- **State**: Zustand stores with persistence
- **UI**: React Bits animated components

### Data Flow

```
1. User pastes job URL
   ↓
2. /api/jobs/scan
   → Fetch HTML with cheerio
   → Groq extracts structured data (Llama-3.3-70B)
   → Generate embeddings (client-side)
   → Save to IndexedDB
   ↓
3. Jobs Dashboard displays job cards
   → Shows match score badges
   → Real-time stats
   ↓
4. User clicks "Optimize Resume"
   ↓
5. /api/resume/optimize
   → Groq analyzes job requirements
   → Generates tailored LaTeX with changes
   → Returns tracked modifications
   ↓
6. Preview Modal opens
   → User reviews changes
   → Accept/reject granularly
   → Export to editor
   ↓
7. Compile optimized PDF
```

## File Structure

### AI Agents
```
lib/ai/
├── job-parser.ts          # Groq-based job extraction (Llama-3.3-70B)
├── semantic-matcher.ts    # Vector embeddings & similarity
└── resume-optimizer.ts    # Groq-based resume tailoring (Llama-3.3-70B)
```

### API Routes
```
app/api/
├── jobs/
│   ├── scan/route.ts      # POST: Scan job URL
│   └── analyze/route.ts   # POST: Semantic analysis
└── resume/
    ├── optimize/route.ts  # POST: Generate optimized version
    └── preview/[id]/route.ts  # GET: Fetch version details
```

### State Management
```
store/
├── jobStore.ts            # Job CRUD, filtering, stats
└── resumeStore.ts         # Master resume, versions, changes
```

### IndexedDB Schema (v2)
```
latex-editor-db
├── jobs                   # Job postings with embeddings
├── resumeVersions         # Tailored resumes per job
└── masterResume           # User's master resume data
```

### Components
```
components/jobs/
├── JobCard.tsx           # Animated job card with SpotlightCard
├── PreviewModal.tsx      # Track changes modal
└── (React Bits components)
```

## Environment Setup

### Required Environment Variables

Create `.env.local`:

```bash
# Groq API Key (required for AI-powered job scanning & optimization)
GROQ_API_KEY=gsk-xxxxx

# Optional: Override default models
GROQ_JOB_PARSER_MODEL=llama3-groq-70b-8192-tool-use-preview
GROQ_OPTIMIZER_MODEL=llama-3.3-70b-versatile
```

Get your API key from: https://console.groq.com/

### Installation

All dependencies already installed. To verify:

```bash
npm list groq-sdk @xenova/transformers cheerio uuid
```

## Usage

### 1. Start Development Server

```bash
npm run dev
```

Navigate to: `http://localhost:3000/jobs`

### 2. Scan Your First Job

1. Click **"Scan New Job"**
2. Paste a job posting URL (LinkedIn, Indeed, company career pages)
3. Wait 10-30 seconds for AI extraction
4. Job card appears with extracted details

**Supported URLs:**
- LinkedIn: `https://www.linkedin.com/jobs/view/...`
- Indeed: `https://www.indeed.com/viewjob?jk=...`
- Company career pages (most work!)

### 3. Optimize Resume

1. Open a `.tex` resume file in the main editor
2. Go to Jobs Dashboard (`/jobs`)
3. Click **"Optimize Resume"** on any job card
4. Wait 20-40 seconds for AI optimization
5. Preview modal opens with tracked changes

### 4. Review & Export

**Overlay View**: See clean resume with color highlights
**Detailed View**:
- Review each change individually
- Read AI reasoning for each modification
- Accept/reject changes
- Click **"Export Resume"** when satisfied

**The optimized LaTeX will load into your editor, ready to compile!**

## Model Selection Strategy

### Why Different Models?

We use **specialized Groq models** for different tasks to optimize performance:

| Task | Model | Reason |
|------|-------|--------|
| **Job Parsing** | `llama3-groq-70b-8192-tool-use-preview` | Optimized for function calling and structured extraction. Better JSON consistency, ~20% faster for extraction tasks |
| **Resume Optimization** | `llama-3.3-70b-versatile` | Better reasoning capabilities for complex optimization logic and creative reframing of experience |

### Performance Comparison

| Model | Inference Speed | Structured Output | Reasoning | Best For |
|-------|----------------|-------------------|-----------|----------|
| llama3-groq-tool-use | ⚡️ Ultra Fast | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️ | Job parsing, data extraction |
| llama-3.3-70b | ⚡️⚡️ Very Fast | ⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️⭐️ | Resume optimization, reasoning |
| mixtral-8x7b | ⚡️⚡️⚡️ Fast | ⭐️⭐️⭐️ | ⭐️⭐️⭐️ | Budget alternative |

### How to Change Models

**Option 1: Environment Variables** (Recommended)
Edit `.env.local`:
```bash
GROQ_JOB_PARSER_MODEL=llama-3.3-70b-versatile  # Use versatile for both
GROQ_OPTIMIZER_MODEL=mixtral-8x7b-32768        # Use cheaper model
```

**Option 2: Code Modification**
Edit the files directly:
- `lib/ai/job-parser.ts` - Line 72
- `lib/ai/resume-optimizer.ts` - Line 75

## AI Agent Details

### Job Parser Agent

**File**: `lib/ai/job-parser.ts`

**Input**: Job posting HTML/text + URL
**Output**: Structured JobData object

```typescript
{
  title: "Senior Full Stack Engineer",
  company: "TechCorp Inc.",
  location: "San Francisco, CA (Remote)",
  salary: "$150k - $200k",
  employmentType: "Full-time",
  description: "...",
  requirements: [
    "5+ years React experience",
    "TypeScript proficiency",
    ...
  ],
  responsibilities: [...],
  qualifications: [...]
}
```

**Model**: Groq `llama3-groq-70b-8192-tool-use-preview` (tool calling optimized)
**Alternative Models**:
- `llama-3.3-70b-versatile` (general purpose)
- `mixtral-8x7b-32768` (structured tasks)

**Prompt Strategy**: Structured extraction with Zod schema validation
**Temperature**: 0.1 (low for consistent structured output)
**Why This Model**: Optimized for function calling and structured JSON extraction, ~20% faster than general models

### Semantic Matcher

**File**: `lib/ai/semantic-matcher.ts`

**Model**: Xenova/all-MiniLM-L6-v2 (runs in browser)
**Vector Size**: 384 dimensions
**Similarity**: Cosine similarity (0-1 scale)

**Functions**:
- `generateEmbedding(text)` → number[]
- `calculateJobResumeMatch(job, resume)` → {score, matches, gaps}
- `cosineSimilarity(vecA, vecB)` → number

### Resume Optimizer Agent

**File**: `lib/ai/resume-optimizer.ts`

**Input**: Original LaTeX + Job requirements + Gap analysis
**Output**: Tailored LaTeX + Tracked changes

```typescript
{
  tailoredLatex: "\\documentclass{article}...",
  changes: [
    {
      id: "uuid",
      type: "modified",
      section: "Experience",
      originalContent: "Built web apps",
      newContent: "Architected scalable React applications...",
      reasoning: "Emphasizes React expertise matching job requirement",
      lineNumber: 42
    }
  ],
  summary: "Optimized resume to highlight React and TypeScript...",
  confidenceScore: 87
}
```

**Model**: Groq `llama-3.3-70b-versatile` (reasoning optimized)
**Alternative Models**:
- `llama3-groq-70b-8192-tool-use-preview` (structured output)
- `mixtral-8x7b-32768` (cost-effective)

**Temperature**: 0.2 (low for accurate, structured optimization)
**Why This Model**: Best reasoning capabilities for complex optimization logic and creative reframing
**Constraints**:
- NO fabrication of experience
- NO changing facts/dates
- Focus on reframing existing experience
- Keyword optimization where genuinely applicable

## Local-First Architecture

### Why IndexedDB?

✅ No backend database required
✅ Works fully offline (after initial model load)
✅ Fast read/write performance
✅ Unlimited storage (within browser limits)
✅ Privacy-first (all data stays on device)

### Data Persistence

All data persists across browser sessions:
- Job postings with embeddings
- Resume versions with changes
- User preferences

**Clear data**: DevTools → Application → IndexedDB → Delete `latex-editor-db`

## Performance

### First Run (Cold Start)
- Embedding model download: ~20 MB (one-time)
- First job scan: 2-5 seconds (Groq is 10x faster than Claude)
- First resume optimization: 3-8 seconds

### Subsequent Runs
- Job scanning: 1-3 seconds (Groq ultra-fast inference)
- Semantic matching: 2-5 seconds (client-side)
- Resume optimization: 2-5 seconds

### Optimization Tips
1. Keep browser tab active during AI operations
2. Use Chrome/Edge for best performance
3. Embedding model caches in browser

## Troubleshooting

### Job Scan Fails

**Error**: "Failed to fetch job posting"
- **Cause**: Some sites block scraping or require authentication
- **Fix**: Try different job boards (LinkedIn often works)

**Error**: "Could not extract meaningful content"
- **Cause**: Dynamic JS-loaded content
- **Fix**: Copy/paste job description directly (future feature)

### Resume Optimization Fails

**Error**: "Please open a resume file in the editor first"
- **Fix**: Navigate to main editor (`/`), open a `.tex` file

**Error**: "Failed to optimize resume with AI"
- **Cause**: API key missing or invalid
- **Fix**: Check `.env.local` has valid `GROQ_API_KEY`

### Embedding Model Won't Load

**Error**: "Failed to initialize embedding model"
- **Cause**: Browser cache issues or network problems
- **Fix**:
  1. Clear browser cache
  2. Check internet connection (model downloads on first use)
  3. Try Chrome/Edge instead of Safari

## API Rate Limits

### Groq

**Free Tier**: Generous free limits (14,400 requests/day on free tier)
**Rate Limit**: 30 requests/minute (free tier) / 60+ (paid tier)

**Cost per operation** (Llama-3.3-70B):
- Job scan: ~$0.004-0.01 (5x cheaper than Claude)
- Resume optimization: ~$0.01-0.02 (5x cheaper than Claude)

**Tips**:
- Free tier is very generous for personal use
- Ultra-fast inference (0.5-1s response times)
- Production: Consider paid tier for higher rate limits

## Future Enhancements

### Planned Features
- [ ] Manual job entry (paste description directly)
- [ ] Company research via web search
- [ ] Glassdoor/Levels.fyi integration
- [ ] Cover letter generation
- [ ] Interview prep AI assistant
- [ ] Application tracking (dates, contacts, follow-ups)
- [ ] Export to Notion/Airtable
- [ ] Chrome extension for one-click job scanning

### Advanced Features
- [ ] Multi-resume management (different versions per role type)
- [ ] A/B testing (which resume version performs better)
- [ ] Application success rate analytics
- [ ] Salary negotiation assistant
- [ ] LinkedIn profile optimizer

## Security & Privacy

### Data Storage
✅ All data stored locally in IndexedDB
✅ No backend database
✅ No data sent to third parties (except Anthropic API)

### API Keys
⚠️ Keep `.env.local` private
⚠️ Never commit API keys to git
⚠️ Use environment variables in production

### Groq API
- Job descriptions sent for parsing
- Resumes sent for optimization
- See: https://groq.com/privacy-policy/

## Support & Contribution

### Found a Bug?
Open an issue with:
1. Steps to reproduce
2. Expected vs actual behavior
3. Browser console errors

### Want to Contribute?
1. Add new job board parsers
2. Improve semantic matching algorithms
3. Build UI components
4. Write documentation

## Credits

**AI Models**:
- Llama-3.3-70B-Versatile via Groq (Meta AI + Groq inference)
- all-MiniLM-L6-v2 by Sentence Transformers

**UI Components**:
- React Bits (https://reactbits.dev)

**Built with**:
- Next.js 14
- React 18
- Tailwind CSS
- Zustand
- IndexedDB

---

**Happy job hunting! 🚀**

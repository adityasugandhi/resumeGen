# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A local-first **AI-powered resume optimization platform** built with Next.js 14, combining a professional LaTeX resume editor with an autonomous AI agent system for job discovery, resume tailoring, and career automation.

**Core Features**: LaTeX Resume Editor (Docker + Monaco), AI Agent System (Claude Sonnet + 11 tools), Career Automation (5 ATS providers), Vector Career Memory (LanceDB), Semantic Matching, Resume Optimization (track changes), MCP Server, Local-First (IndexedDB + PostgreSQL).

## Development Commands

```bash
npm install                 # Install dependencies
npm run dev                # Start dev server (http://localhost:3000)
npm run build              # Production build
npm run lint               # ESLint check
npm run dev:all            # Run Next.js + MCP server concurrently
```

### Docker (LaTeX compilation)
```bash
npm run docker:pull        # Pull texlive/texlive:latest (~4GB, one-time)
npm run docker:check       # Check Docker image availability
```

### Database (PostgreSQL + Drizzle)
```bash
npm run db:generate        # Generate Drizzle migrations
npm run db:migrate         # Run migrations
npm run db:push            # Push schema changes directly
npm run db:seed            # Seed initial data
npm run db:studio          # Open Drizzle Studio GUI
npm run db:migrate-data    # Run data migration script
```

### MCP Server
```bash
npm run mcp:dev            # MCP server in watch mode (tsx watch)
npm run mcp:start          # Start MCP server
npm run mcp:inspect        # Open MCP inspector at localhost:3001/mcp
```

### Career Automation
```bash
npm run cron:start         # Start cron job scheduler
npm run cron:once          # Run cron job once
npm run queue:list         # List application queue
npm run queue:approve      # Approve queued applications
npm run queue:reject       # Reject queued applications
npm run queue:submit       # Submit approved applications
npm run queue:submit:dry   # Dry run submission
```

## Prerequisites

- **Required**: Node.js 20+, Groq API Key (`GROQ_API_KEY` in `.env.local`)
- **Recommended**: Docker Desktop + `texlive/texlive:latest` for local LaTeX compilation
- **For career automation**: PostgreSQL + `DATABASE_URL`, Anthropic API Key or AWS Bedrock token
- **Optional**: SuperMemory API Key, Perplexity API Key, Logo.dev token

Without Docker, falls back to online LaTeX compilation with limited package support.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API for job parsing |
| `GROQ_JOB_PARSER_MODEL` | No | Default: `llama3-groq-70b-8192-tool-use-preview` |
| `GROQ_OPTIMIZER_MODEL` | No | Default: `llama-3.3-70b-versatile` |
| `DATABASE_URL` | For automation | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | For agent | Claude API key |
| `AWS_BEARER_TOKEN_BEDROCK` | For agent | AWS Bedrock token (alternative to Anthropic) |
| `BEDROCK_AWS_REGION` | No | Default: `us-east-1` |
| `PERPLEXITY_API_KEY` | No | Perplexity AI web search |
| `SUPERMEMORY_API_KEY` | No | Persistent career memory |
| `NEXT_PUBLIC_LOGO_DEV_TOKEN` | No | Company logo API |

## Master LaTeX Template

Template: `master-template.tex`. ALL generated resumes MUST use this formatting:
- **Blue section rules**: `\color{metablue}\titlerule` (not darkgray)
- **Blue bordered box** around Projects section using `tcolorbox`
- **Charter font**, 10pt, letterpaper, 0.225in margins
- **Section headings**: Blue (`metablue` RGB 24,119,242), ALL CAPS via `\scshape`
- **Contact format**: Phone | blue location | email | GitHub | website
- Placeholder markers (`%%% CONTENT HERE %%%`) for the resume generator
- Education and Publications & Awards sections pre-filled with personal details

When generating a new resume, copy `master-template.tex` and replace placeholder sections.

## Architecture

### Data Flow

```
User query → Agent loop (Claude Sonnet) → Tool execution → Memory storage (LanceDB)
                  ↓                              ↓                    ↓
           Self-healing on failure    IndexedDB + PostgreSQL    Frontend display (SSE)
```

1. Load master resume from disk (22+ tailored resumes indexed)
2. Check career memory for past searches
3. Scan H1B data → Cross-reference company registry → Explore engineering roles
4. Search jobs → Fetch details → Match resume (semantic + vector)
5. Optimize resume with best bullets from memory
6. Save `.tex` + compile PDF to `Job_Applications/Companies/{Company}/`
7. Store learnings for future searches

### AI Agent System (`lib/ai/agent/`)

Three agents orchestrated by Claude Sonnet (via Anthropic API or AWS Bedrock):

- **Job Search Agent** (`job-search-agent.ts`) — Main orchestrator for H1B job discovery with 11 tools
- **Code Agent** (`code-agent.ts`) — Self-healing code fixes for tool failures
- **Memory Health Agent** (`memory-health-agent.ts`) — Career memory maintenance

**Job Search Tools** (defined in `tools.ts`):
`scan_h1b_sponsors`, `list_available_companies`, `search_company_jobs`, `explore_engineering_roles`, `fetch_job_details`, `match_resume`, `optimize_resume`, `web_search`, `recall_past_searches`, `recall_best_bullets`, `store_learning`

**Code Agent Tools** (`code-tools.ts`):
`read_file`, `write_file` (restricted to `lib/careers/providers/` and `lib/ai/`), `list_files`, `web_search`, `run_fetch`, `get_error`

Types in `lib/ai/agent/types.ts`. SSE streaming to frontend. Auto-saves `.tex` + compiles PDF.

### Career Automation (`lib/careers/`)

**ATS Providers** (`lib/careers/providers/`):
| Provider | API |
|----------|-----|
| Greenhouse | `boards.greenhouse.io` |
| Lever | `jobs.lever.co` |
| Ashby | `jobs.ashbyhq.com` |
| Stripe | `stripe.com/jobs` |
| Cloudflare | `cloudflare.com/careers` |

**Auto-Apply Engine** (`lib/careers/auto-apply/engine.ts`):
- `JobApplicationEngine` class — `apply()`, `bulkApply()`, `getFormSchema()`
- Playwright browser automation providers for Greenhouse, Lever, Ashby
- Anti-bot: CAPTCHA detection, configurable delays
- Supporting: `tracker.ts`, `resume-selector.ts`, `applicant-profile.ts`, `browser/browser-manager.ts`

**Company Registry** (`lib/careers/company-registry.ts`):
- 26 companies (Stripe, Anthropic, Figma, Cloudflare, Datadog, Scale AI, etc.)
- DB-backed with fallback to static registry
- `getCompanyConfig()`, `detectPlatform()`, `getAllCompanies()`

**Career Search** (`lib/careers/career-search.ts`):
- Routes to correct ATS provider based on company platform

### Vector Career Memory (`lib/vector-db/`)

LanceDB at `~/.lancedb/career-memory` with `all-MiniLM-L6-v2` embeddings (384-dim via `@xenova/transformers`).

**5 Career Memory Tables** (`career-memory.ts`):
1. `career_resume_components` — Resume bullets, skills, projects from 22+ tailored resumes
2. `career_job_searches` — Past search metadata (titles, companies, scores)
3. `career_job_matches` — Job matches with gaps/strengths
4. `career_optimized_resumes` — Tailored resume metadata
5. `career_learnings` — Insights (strengths, gaps, patterns, recommendations)

**Project Knowledge Base** (`lancedb-client.ts`):
- Table: `project_documents` at `~/.lancedb/resume-projects`
- RAG for resume tailoring from project history

Key functions: `searchResumeComponents()`, `searchPastSearches()`, `storeJobSearch()`, `storeJobMatch()`, `storeLearning()`, `getMemoryStats()`

### Database Layer (`lib/db/`)

PostgreSQL + Drizzle ORM. Config: `drizzle.config.ts`. Schema: `lib/db/schema.ts`.

**Tables** (5):
1. `companies` — Company registry (name, platform, boardToken, careersUrl, isActive)
2. `application_queue` — Pending/approved applications (shortId, matchScore, status, gaps, strengths)
3. `application_tracker` — Submitted application logs (trackId, platform, confirmationId)
4. `job_postings` — Job posting cache with embeddings and match scores
5. `resume_versions` — Resume version history (originalLatex, tailoredLatex, changes)

**Enums**: `career_platform` (greenhouse, lever, ashby, workday, stripe, cloudflare, unknown), `queue_status`, `tracker_status`, `job_posting_status`

Queries: `lib/db/queries/companies.ts`

### MCP Server (`mcp-server/`)

HTTP server on port 3001 (configurable via `MCP_PORT`) with `StreamableHTTPServerTransport`.

**Tool categories** (~20 tools):
- `file-operations.ts` — File CRUD, rename, pin, list
- `latex-operations.ts` — Compile, validate, export LaTeX
- `ai-operations.ts` — Resume review, optimization, tailoring, job analysis
- `knowledge-operations.ts` — RAG search, index resumes, career memory queries

Resources (`resources/index.ts`): templates, file access, system status.
Prompts (`prompts/index.ts`): resume review, section improvement, error fixing.
Integrations: `file-system-client.ts` (local files), `api-client.ts` (Next.js API proxy).

### Diff Engine (`lib/diff/`)

LaTeX-aware diff using `diff-match-patch`:
- `diff-engine.ts` — `computeDiff(original, modified)`, `getCleanDiff()`, `getDiffSummary()`
- `latex-tokenizer.ts` — `tokenizeLatex()`, `diffLatexAware()` for semantic LaTeX diffs
- `diff-types.ts` — `LineDiffState`, `HunkConfig` types

### State Management (Zustand Stores)

**Core Editor Stores**:
- `store/fileSystemStore.ts` — File/folder CRUD, file tree structure
- `store/editorStore.ts` — Current file content, compilation status, errors
- `store/uiStore.ts` — Theme (light/dark), sidebar, layout preferences

**AI & Career Stores**:
- `store/jobStore.ts` — Job CRUD, filtering, scanning state, match stats
- `store/resumeStore.ts` — Master resume, versions, change tracking
- `store/companyStore.ts` — Company registry UI state, logo URLs
- `store/diffEditorStore.ts` — Diff editor state
- `store/supermemoryStore.ts` — SuperMemory API integration state

All stores persist to IndexedDB via `zustand/middleware`.

### Storage Layer (IndexedDB)

Database: `latex-editor-db` (version 4)
- `files` — FileSystemNode objects (indexed by `parentId`, `companyId`)
- `settings` — User preferences and UI state
- `jobs` — Job postings with 384-dim vector embeddings (indexed by `status`, `createdAt`)
- `resumeVersions` — Tailored resumes per job (indexed by `jobId`, `createdAt`)
- `masterResume` — User's master resume with component embeddings
- `companies` — Company objects (indexed by `name`)
- `applications` — TrackedApplication objects (indexed by `company`, `platform`, `submittedAt`)

Access via `lib/indexeddb.ts` wrapper functions.

### Component Structure

- **LaTeX Editor** (`app/page.tsx`): Three-pane layout — Sidebar (FolderTree, QuickAccess) | Editor (Monaco) | Preview (react-pdf)
- **Jobs Dashboard** (`app/jobs/page.tsx`): JobCard (spotlight + match scores), PreviewModal (track changes)
- **AI Agents** (`lib/ai/`): job-parser.ts, semantic-matcher.ts, resume-optimizer.ts

### File System Model

FileSystemNode objects: `id` (UUID), `parentId`, `type` (file/folder), `isPinned`. Full path via parent chain traversal.

### Next.js Configuration

Path alias: `@/*` maps to project root. TypeScript strict mode.

**Server external packages** (native modules excluded from client bundle):
- `@lancedb/lancedb`, `onnxruntime-node`, `@xenova/transformers`

Webpack: excludes `.node` files, disables canvas/encoding fallbacks, IgnorePlugin for native modules on client.

Images: remote pattern for `img.logo.dev` (Logo.dev API).

### Cron System (`lib/cron/`)

- `lib/cron/orchestrator.ts` — Job search orchestrator
- `lib/cron/cron-config.ts` — Cron configuration
- `scripts/daily-cron.ts` — Entry point (supports `--once` flag)
- Daily application limits, Slack notifications

### Scripts (`scripts/`)

- `daily-cron.ts` — Scheduled job search automation
- `approve-queue.ts` — CLI for reviewing application queue
- `submit-approved.ts` — Bulk submit approved applications

## Contact Details

- Email: adityasugandhi.dev.ai@gmail.com
- Phone: +1 448 500 6857
- GitHub: https://github.com/adityasugandhi
- Website: https://adityasugandhi.com

## Important Notes

- **Go**: NOT yet used in production — frame as transferable skill
- **Spring Boot**: Used at Aspire long ago — say "Java" or "event-driven services" generically
- **AI tools**: Actively using Claude Code, Copilot — mention when relevant
- **Tailwind CSS**: Always use Tailwind, never inline CSS
- **Resume generator**: Activated when user provides a job posting — see [Resume Generator Prompt](docs/RESUME_GENERATOR_PROMPT.md)
- **Job Applications**: Output saved to `Job_Applications/Companies/{Company}/` (25+ companies)

## Reference Documentation

| Topic | File |
|-------|------|
| AI Job Scanning & Optimization | [docs/AI_SYSTEM.md](docs/AI_SYSTEM.md) |
| LaTeX Compilation System | [docs/LATEX_COMPILATION.md](docs/LATEX_COMPILATION.md) |
| Debugging Guide | [docs/DEBUGGING.md](docs/DEBUGGING.md) |
| Performance Benchmarks | [docs/PERFORMANCE.md](docs/PERFORMANCE.md) |
| Feature Implementation | [docs/FEATURES.md](docs/FEATURES.md) |
| Template Customization | [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) |
| Resume Context (FSU, BookedFlow, Building Portal) | [docs/RESUME_CONTEXT.md](docs/RESUME_CONTEXT.md) |
| Job Application Tracker | [docs/JOB_TRACKER.md](docs/JOB_TRACKER.md) |
| AI Resume Generator Prompt | [docs/RESUME_GENERATOR_PROMPT.md](docs/RESUME_GENERATOR_PROMPT.md) |
| SuperMemory Setup | [docs/SUPERMEMORY_SETUP.md](docs/SUPERMEMORY_SETUP.md) |

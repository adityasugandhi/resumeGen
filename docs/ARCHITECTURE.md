# Architecture

Deep architecture guide for contributors to the AI-powered resume optimization platform.

---

## System Overview

```
+------------------+
|     Browser      |
|  (React 18 SPA)  |
+--------+---------+
         |
         | HTTP / SSE
         v
+--------+---------+
|   Next.js 14     |
|   App Router     |
|  (42 API routes) |
+--------+---------+
         |
    +----+----+--------------------+-------------------+
    |         |                    |                   |
    v         v                    v                   v
+-------+ +--------+      +-------------+    +----------------+
|  AI   | | Career | | LaTeX Compiler|    |   MCP Server   |
| Agents| |Providers|      | (Docker /   |    | (port 3001)    |
| Claude| | (5 ATS)|      |  online)    |    | ~20 tools      |
+---+---+ +---+----+      +------+------+    +-------+--------+
    |         |                   |                   |
    +----+----+-------------------+-------------------+
         |
    +----+----+--------------------+-------------------+
    |         |                    |                   |
    v         v                    v                   v
+-------+ +--------+      +-------------+    +----------------+
|LanceDB| |PostgreSQL|     |  IndexedDB  |    |  File System   |
|Vector | | Drizzle|      | (client)    |    | Job_Applications/|
|Memory | | ORM    |      | latex-editor|    | Companies/       |
+-------+ +--------+      +-------------+    +----------------+
```

All AI inference routes through OpenRouter (Llama 3.3 70B for parsing/exploration)
or Anthropic API / AWS Bedrock (Claude Sonnet for the agent loop).

---

## Data Flow

A typical end-to-end flow from user query to compiled PDF:

```
1. User enters job search query in the browser
         |
2. POST /api/agent/job-search
         |
3. Job Search Agent starts (Claude Sonnet)
         |
4. Phase 1 — Discovery
   |-- recall_past_searches (LanceDB)
   |-- scan_h1b_sponsors (H1B dataset)
   |-- list_available_companies (company registry)
   |-- explore_engineering_roles (ATS APIs)
         |
5. Phase 2 — Processing (parallel)
   |-- search_company_jobs (per company)
   |-- fetch_job_details (per job)
   |-- match_resume (semantic scoring)
   |-- optimize_resume (tailored LaTeX)
         |
6. Phase 3 — Output
   |-- Save .tex to Job_Applications/Companies/{Company}/
   |-- POST /api/compile (Docker texlive → PDF)
   |-- store_learning (LanceDB)
   |-- SSE events → frontend updates
         |
7. User sees tailored resume with track changes in the editor
```

---

## AI Agent Pipeline

### Three Phases

**Phase 1: Discovery**
- Recall past searches from LanceDB career memory
- Scan H1B sponsor database for visa-friendly companies
- Query company registry (DB-backed, 26 companies)
- Explore engineering roles via ATS provider APIs

**Phase 2: Processing**
- Parallel company workers bounded by a semaphore (prevents API flooding)
- Each company worker spawns job processors for individual postings
- Job processors: fetch details, compute match score, optimize resume
- Write queue batches file operations to avoid disk thrashing

**Phase 3: Summarize**
- Aggregate results across all companies
- Store learnings (strengths, gaps, patterns) in LanceDB
- Stream final summary to frontend via SSE

### Three Agents

| Agent | File | Role |
|-------|------|------|
| Job Search Agent | `lib/ai/agent/job-search-agent.ts` | Main orchestrator. Runs the 3-phase pipeline with 11 tools. |
| Code Agent | `lib/ai/agent/code-agent.ts` | Self-healing. Triggered on tool failures to read errors and patch code. |
| Memory Health Agent | `lib/ai/agent/memory-health-agent.ts` | Maintenance. Prunes stale memory, reindexes career data. |

### Sub-Agents

Located in `lib/ai/agent/sub-agents/`:

| File | Responsibility |
|------|---------------|
| `discovery-agent.ts` | Discovers companies and their open roles across ATS platforms |
| `company-worker.ts` | Processes a single company: list jobs, filter by relevance, hand off to job processor |
| `job-processor.ts` | Processes a single job posting: fetch, match, optimize, write |
| `write-queue.ts` | Batched file write operations with deduplication |
| `types.ts` | Shared types for sub-agent communication |

```
Job Search Agent
  |
  +-- Discovery Agent
  |     |-- scan_h1b_sponsors
  |     |-- list_available_companies
  |     |-- recall_past_searches
  |
  +-- Company Worker (x N, semaphore-bounded)
  |     |-- search_company_jobs
  |     |-- explore_engineering_roles
  |     |
  |     +-- Job Processor (per job)
  |           |-- fetch_job_details
  |           |-- match_resume
  |           |-- optimize_resume
  |           |-- write_queue.enqueue()
  |
  +-- store_learning (post-processing)
```

---

## Tool Registry

### Job Search Tools (`lib/ai/agent/tools.ts`)

| Tool | Description |
|------|-------------|
| `scan_h1b_sponsors` | Query H1B sponsor dataset by company name, state, or NAICS code |
| `list_available_companies` | List all companies in the registry with their ATS platform info |
| `search_company_jobs` | Search open positions at a specific company via its ATS API |
| `explore_engineering_roles` | Broader role discovery across multiple companies |
| `fetch_job_details` | Fetch full job description, requirements, and metadata |
| `match_resume` | Semantic + keyword matching between resume and job description |
| `optimize_resume` | Generate tailored LaTeX resume for a specific job posting |
| `web_search` | General web search via Perplexity API |
| `recall_past_searches` | Query LanceDB for past job search history |
| `recall_best_bullets` | Retrieve highest-scoring resume bullets from career memory |
| `store_learning` | Persist insights (gaps, strengths, patterns) to LanceDB |

### Code Agent Tools (`lib/ai/agent/code-tools.ts`)

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents (unrestricted) |
| `write_file` | Write file (restricted to `lib/careers/providers/` and `lib/ai/`) |
| `list_files` | List directory contents |
| `web_search` | Web search for documentation / error solutions |
| `run_fetch` | HTTP fetch for testing API endpoints |
| `get_error` | Retrieve error context from the failed tool execution |

The tool registry is defined in `lib/ai/agent/tool-registry.ts` and tools are
injected into the agent loop as Claude function-calling definitions.

---

## Career Automation

### ATS Providers

| Provider | Domain | API Pattern |
|----------|--------|-------------|
| Greenhouse | `boards.greenhouse.io` | REST JSON API with board tokens |
| Lever | `jobs.lever.co` | Public JSON API |
| Ashby | `jobs.ashbyhq.com` | GraphQL API |
| Stripe | `stripe.com/jobs` | Custom scraper |
| Cloudflare | `cloudflare.com/careers` | Custom scraper |

Provider implementations live in `lib/careers/providers/`. Each provider
implements a common interface for `listJobs()`, `getJobDetails()`, and
`getApplicationUrl()`.

### Auto-Apply Engine

```
lib/careers/auto-apply/
  engine.ts              -- JobApplicationEngine class
  applicant-profile.ts   -- User profile data for form filling
  browser/
    ai-browser-agent.ts  -- AI-guided browser automation
    browser-manager.ts   -- Playwright instance management
    captcha-handler.ts   -- CAPTCHA detection and handling
```

- `JobApplicationEngine.apply(job)` — single application submission
- `JobApplicationEngine.bulkApply(jobs)` — batch with rate limiting
- `JobApplicationEngine.getFormSchema(url)` — extract form fields before applying
- Anti-bot measures: randomized delays, CAPTCHA detection, human-like interactions

### Company Registry

`lib/careers/company-registry.ts` — 26 companies including Stripe, Anthropic,
Figma, Cloudflare, Datadog, Scale AI, and others.

- DB-backed with automatic fallback to static registry
- `getCompanyConfig(name)` — returns platform, board token, careers URL
- `detectPlatform(url)` — auto-detect ATS platform from careers URL
- `getAllCompanies()` — list with active/inactive filtering

---

## Storage Architecture

### IndexedDB (Client-Side)

Database: `latex-editor-db` (version 4)

| Store | Key Fields | Indexes |
|-------|-----------|---------|
| `files` | id, name, content, parentId, type | parentId, companyId |
| `settings` | key, value | — |
| `jobs` | id, title, company, embeddings (384-dim) | status, createdAt |
| `resumeVersions` | id, jobId, originalLatex, tailoredLatex | jobId, createdAt |
| `masterResume` | id, latex, componentEmbeddings | — |
| `companies` | id, name, platform | name |
| `applications` | id, company, status, submittedAt | company, platform, submittedAt |

Access layer: `lib/indexeddb.ts` provides typed wrapper functions over raw IDB.

### PostgreSQL (Server-Side)

Schema: `lib/db/schema.ts` | Config: `drizzle.config.ts` | ORM: Drizzle

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `companies` | Company registry | name, platform, boardToken, careersUrl, isActive |
| `application_queue` | Pending/approved apps | shortId, matchScore, status, gaps, strengths |
| `application_tracker` | Submitted app logs | trackId, platform, confirmationId, submittedAt |
| `job_postings` | Job cache + embeddings | title, company, embedding, matchScore, status |
| `resume_versions` | Resume history | originalLatex, tailoredLatex, changes, jobId |

Enums:
- `career_platform`: greenhouse, lever, ashby, workday, stripe, cloudflare, unknown
- `queue_status`: pending, approved, rejected, submitted, failed
- `tracker_status`: submitted, confirmed, rejected, interviewing, offered
- `job_posting_status`: new, matched, applied, expired

Queries: `lib/db/queries/companies.ts`

### LanceDB (Vector Memory)

Path: `~/.lancedb/career-memory`
Embeddings: `all-MiniLM-L6-v2` (384 dimensions via `@xenova/transformers`)

| Table | Contents |
|-------|----------|
| `career_resume_components` | Resume bullets, skills, projects from 22+ tailored resumes |
| `career_job_searches` | Past search metadata (titles, companies, scores) |
| `career_job_matches` | Job matches with gap/strength analysis |
| `career_optimized_resumes` | Tailored resume metadata and scores |
| `career_learnings` | Insights: strengths, gaps, patterns, recommendations |

Additional table for RAG:
- `project_documents` at `~/.lancedb/resume-projects` — project knowledge base for resume tailoring

Key functions in `lib/vector-db/career-memory.ts`:
`searchResumeComponents()`, `searchPastSearches()`, `storeJobSearch()`,
`storeJobMatch()`, `storeLearning()`, `getMemoryStats()`

---

## MCP Server

Located in `mcp-server/`. HTTP transport on port 3001 (configurable via `MCP_PORT`).
Uses `StreamableHTTPServerTransport` from the MCP SDK.

### Tool Categories

| Category | File | Tools |
|----------|------|-------|
| File Operations | `file-operations.ts` | File CRUD, rename, pin, list directory |
| LaTeX Operations | `latex-operations.ts` | Compile, validate, export LaTeX documents |
| AI Operations | `ai-operations.ts` | Resume review, optimization, tailoring, job analysis |
| Knowledge Operations | `knowledge-operations.ts` | RAG search, index resumes, career memory queries |

~20 tools total exposed via MCP protocol.

### Resources and Prompts

- `resources/index.ts` — Templates, file access, system status as MCP resources
- `prompts/index.ts` — Pre-built prompts for resume review, section improvement, error fixing
- `file-system-client.ts` — Local file system integration
- `api-client.ts` — Proxies to Next.js API routes

---

## State Management

12 Zustand stores, most persisted to IndexedDB via `zustand/middleware`:

| Store | File | Responsibility |
|-------|------|---------------|
| `fileSystemStore` | `store/fileSystemStore.ts` | File/folder CRUD, tree structure |
| `editorStore` | `store/editorStore.ts` | Current file content, compilation status, errors |
| `uiStore` | `store/uiStore.ts` | Theme, sidebar visibility, layout prefs |
| `jobStore` | `store/jobStore.ts` | Job CRUD, filtering, scan state, match stats |
| `resumeStore` | `store/resumeStore.ts` | Master resume, versions, change tracking |
| `companyStore` | `store/companyStore.ts` | Company registry UI state, logo URLs |
| `diffEditorStore` | `store/diffEditorStore.ts` | Diff editor state for track changes |
| `supermemoryStore` | `store/supermemoryStore.ts` | SuperMemory API integration |
| `agentRunStore` | `store/agentRunStore.ts` | Active agent run tracking, SSE connection |
| `campaignStore` | `store/campaignStore.ts` | Campaign management state |
| `monitorStore` | `store/monitorStore.ts` | Agent monitoring dashboard state |
| `settingsStore` | `store/settingsStore.ts` | Application settings and preferences |

---

## API Routes Reference

### Agent & AI (`/api/agent/`, `/api/jobs/`, `/api/resume/`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/agent/job-search` | Start job search agent |
| POST | `/api/agent/job-search/intervene` | Intervene in running agent |
| POST | `/api/agent/memory/init` | Initialize career memory |
| GET | `/api/agent/memory/status` | Career memory stats |
| GET/POST | `/api/agent/prompts` | Manage agent prompts |
| POST | `/api/agent/prompts/suggest` | AI prompt suggestions |
| POST | `/api/jobs/analyze` | Analyze job posting |
| POST | `/api/jobs/scan` | Scan for jobs |
| POST | `/api/resume/optimize` | Optimize resume for job |
| GET | `/api/resume/preview/[id]` | Preview resume version |

### Career Automation (`/api/careers/`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/careers/apply` | Submit job application |
| GET | `/api/careers/companies` | List registered companies |
| POST | `/api/careers/form-schema` | Get application form schema |
| POST | `/api/careers/search` | Search company job listings |

### H1B Data (`/api/h1b/`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/h1b/route` | Search H1B sponsor data |
| GET | `/api/h1b/company` | H1B company details |
| GET | `/api/h1b/market` | H1B market analytics |
| GET | `/api/h1b/salary` | H1B salary data |

### Knowledge Base (`/api/knowledge/`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/knowledge/index` | Index resume knowledge |
| POST | `/api/knowledge/search` | Search knowledge base |
| GET | `/api/knowledge/status` | Knowledge base stats |
| POST | `/api/knowledge/tailor` | Tailor resume with RAG |

### LaTeX & Files

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/compile` | Compile LaTeX to PDF |
| GET | `/api/latex-check` | Check LaTeX availability |
| POST | `/api/resumes/sync` | Sync resume files |

### Authentication & Gmail (`/api/auth/`, `/api/gmail/`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/callback/google` | Google OAuth callback |
| GET | `/api/auth/google` | Start Google OAuth flow |
| POST | `/api/auth/google/disconnect` | Disconnect Google account |
| GET | `/api/auth/google/status` | Google auth status |
| GET | `/api/gmail/labels` | List Gmail labels |
| POST | `/api/gmail/search` | Search Gmail messages |
| POST | `/api/gmail/send` | Send email via Gmail |

### Settings & System (`/api/settings/`, `/api/health`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET/POST | `/api/settings/companies` | Company settings |
| POST | `/api/settings/companies/discover` | Auto-discover companies |
| POST | `/api/settings/companies/register-urls` | Register company URLs |
| GET/POST | `/api/settings/database` | Database settings |
| GET | `/api/settings/docker` | Docker status |
| GET/POST | `/api/settings/env` | Environment variables |
| GET/POST | `/api/settings/profile` | User profile settings |

### Integrations

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/linkedin/notes` | LinkedIn note management |
| POST | `/api/supermemory/sync` | Sync with SuperMemory |

---

## Event Streaming (SSE)

The agent system streams real-time updates to the frontend via Server-Sent Events.

```
Agent Loop                    API Route                   Frontend
   |                            |                           |
   |-- AgentStepEvent --------->|                           |
   |   { type, data, ts }      |-- SSE write ------------->|
   |                            |   data: JSON\n\n         |-- agentRunStore
   |                            |                           |   updates UI
   |-- tool_start ------------->|-------------------------->|
   |-- tool_result ------------->|-------------------------->|
   |-- thinking ---------------->|-------------------------->|
   |-- error ------------------->|-------------------------->|
   |-- complete ---------------->|-- close connection ----->|
```

Event types defined in `lib/ai/agent/types.ts` and utilities in
`lib/agent-event-utils.ts`:

| Event Type | Payload | Purpose |
|-----------|---------|---------|
| `thinking` | reasoning text | Show agent's current reasoning |
| `tool_start` | tool name, args | Indicate which tool is executing |
| `tool_result` | tool output | Show tool execution results |
| `job_found` | job metadata | New job discovered |
| `match_result` | score, gaps | Resume match score computed |
| `resume_optimized` | file path | Tailored resume generated |
| `error` | error message | Tool or agent failure |
| `complete` | summary | Agent run finished |

---

## Error Handling and Self-Healing

When a tool execution fails during the agent loop:

```
1. Tool throws error
     |
2. Job Search Agent catches the error
     |
3. If retryable: retry with backoff (max 3 attempts)
     |
4. If code-fixable: spawn Code Agent
     |   |-- get_error (retrieve error context)
     |   |-- read_file (inspect failing code)
     |   |-- web_search (find solution if needed)
     |   |-- write_file (apply fix — restricted to lib/careers/providers/ and lib/ai/)
     |   |-- retry original tool
     |
5. If unfixable: log error, skip tool, continue agent loop
     |
6. Self-heal issue tracking: lib/ai/agent/self-heal-issue.ts
```

The Code Agent's write access is intentionally restricted to provider
implementations and AI modules to prevent uncontrolled modifications.

---

## Key Files Reference

| File | Responsibility |
|------|---------------|
| `app/page.tsx` | Main editor: three-pane layout (sidebar, Monaco editor, PDF preview) |
| `app/jobs/page.tsx` | Jobs dashboard with match scores and spotlight cards |
| `app/monitor/page.tsx` | Agent monitoring dashboard |
| `lib/ai/agent/job-search-agent.ts` | Main AI agent orchestrator |
| `lib/ai/agent/tools.ts` | 11 job search tool definitions |
| `lib/ai/agent/code-agent.ts` | Self-healing code agent |
| `lib/ai/agent/code-tools.ts` | 6 code agent tool definitions |
| `lib/ai/agent/tool-registry.ts` | Tool registration and injection |
| `lib/ai/agent/types.ts` | Agent types and SSE event definitions |
| `lib/ai/resume-optimizer.ts` | Resume tailoring with LaTeX output |
| `lib/ai/job-parser.ts` | Job description parsing and extraction |
| `lib/ai/semantic-matcher.ts` | Semantic matching between resume and jobs |
| `lib/careers/company-registry.ts` | 26-company registry with ATS platform detection |
| `lib/careers/auto-apply/engine.ts` | Auto-apply engine with Playwright |
| `lib/vector-db/career-memory.ts` | LanceDB career memory (5 tables) |
| `lib/db/schema.ts` | PostgreSQL schema (Drizzle ORM) |
| `lib/indexeddb.ts` | Client-side IndexedDB wrapper |
| `lib/latex-utils.ts` | LaTeX compilation utilities |
| `lib/agent-event-utils.ts` | SSE event streaming utilities |
| `mcp-server/` | MCP server entry point and tool definitions |
| `Job_Applications/Templates/master-template.tex` | Master LaTeX resume template |
| `next.config.js` | Next.js config with native module exclusions |
| `drizzle.config.ts` | Drizzle ORM configuration |

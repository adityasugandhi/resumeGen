# CareerForge

![Next.js 14](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8) ![Docker](https://img.shields.io/badge/Docker-texlive-2496ED) ![License](https://img.shields.io/badge/License-MIT-green)

> AI-powered resume optimization platform — LaTeX editor meets autonomous career agent.

## What is this?

CareerForge combines a professional LaTeX resume editor with an autonomous AI agent system that discovers jobs, tailors resumes, and automates applications. It's local-first, privacy-focused, and designed for software engineers navigating the job market.

## Key Features

### LaTeX Editor
- Monaco editor with LaTeX syntax highlighting
- Real-time PDF preview with Docker-based compilation (texlive)
- File management with folders, pinning, and quick access
- Auto-save with IndexedDB persistence

### AI Agent System
- 3-phase pipeline: Discovery, Processing, Summarization
- 11 specialized tools (H1B scan, job matching, resume optimization)
- Self-healing code agent for automatic error recovery
- Claude Sonnet orchestration with SSE streaming

### Career Automation
- 5 ATS provider integrations (Greenhouse, Lever, Ashby, Stripe, Cloudflare)
- Auto-apply engine with Playwright browser automation
- H1B sponsor data cross-referencing
- Application queue with approve/reject workflow

### Developer Experience
- MCP server for AI tool integration
- Vector career memory (LanceDB + embeddings)
- PostgreSQL + Drizzle ORM for persistent data
- Cron-based job search automation

## Quick Start

Prerequisites: Node.js 20+, at least one AI API key

```bash
git clone <repo-url>
cd resume
npm install
cp .env.example .env.local
# Edit .env.local — add OPENROUTER_API_KEY or GROQ_API_KEY (minimum required)
npm run dev
```

Open http://localhost:3000

### Optional Setup

| Feature | Requirement | Setup |
|---------|-------------|-------|
| LaTeX compilation | Docker Desktop | `npm run docker:pull` |
| Career automation | PostgreSQL | Set `DATABASE_URL`, run `npm run db:push && npm run db:seed` |
| MCP server | — | `npm run dev:all` |

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser    │────>│  Next.js App  │────>│   AI Agents     │
│  (React UI)  │<────│  (API Routes) │<────│  (Claude Sonnet)│
└─────────────┘     └──────┬───────┘     └────────┬────────┘
                           │                       │
                    ┌──────┴───────┐        ┌─────┴──────┐
                    │   Storage    │        │   Tools    │
                    ├──────────────┤        ├────────────┤
                    │ IndexedDB    │        │ H1B Scan   │
                    │ PostgreSQL   │        │ Job Match  │
                    │ LanceDB     │        │ Resume Opt │
                    │ File System  │        │ Web Search │
                    └──────────────┘        └────────────┘
```

For detailed architecture, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Editor | Monaco Editor, react-pdf, pdfjs-dist |
| AI/ML | Claude Sonnet (Anthropic/Bedrock), LanceDB, Transformers.js |
| Storage | IndexedDB, PostgreSQL (Drizzle ORM), LanceDB |
| Automation | Playwright, Stagehand, node-cron |
| DevTools | MCP Server, Docker (texlive) |

## Project Structure

```
├── app/                    # Next.js pages + API routes
│   ├── api/               # 42 API endpoints
│   ├── editor/            # LaTeX editor page
│   ├── jobs/              # Job dashboard
│   ├── monitor/           # Agent monitoring
│   ├── h1b/               # H1B sponsor explorer
│   ├── campaigns/         # Application campaigns
│   └── settings/          # Configuration
├── components/            # React components (~105)
├── lib/                   # Business logic (~118 files)
│   ├── ai/               # AI agents, parsers, optimizers
│   ├── careers/           # ATS providers, auto-apply
│   ├── db/               # PostgreSQL schema + queries
│   ├── vector-db/        # LanceDB career memory
│   └── browser-scraper   # Web scraping utilities
├── store/                 # Zustand state stores (12)
├── mcp-server/           # MCP server implementation
├── scripts/              # Automation scripts
├── Job_Applications/     # Generated resume output
└── docs/                 # Documentation
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, agent pipeline |
| [AI System](docs/AI_SYSTEM.md) | Job scanning and optimization details |
| [LaTeX Compilation](docs/LATEX_COMPILATION.md) | Docker and compilation setup |
| [Debugging](docs/DEBUGGING.md) | Troubleshooting guide |
| [Features](docs/FEATURES.md) | Feature documentation |

## Environment Variables

See [`.env.example`](.env.example) for all available variables. Minimum required:

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Job parsing + career exploration (recommended) |
| `GROQ_API_KEY` | Alternative job parser |
| `ANTHROPIC_API_KEY` | AI agent orchestration |
| `DATABASE_URL` | Career automation (PostgreSQL) |

## Contributing

Contributions are welcome! Areas where help is especially welcome:

- Test coverage (unit + integration)
- New ATS provider integrations
- CI/CD pipeline
- Accessibility improvements
- Documentation

## License

[MIT](LICENSE) - Aditya Sugandhi

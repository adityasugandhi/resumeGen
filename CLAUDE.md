# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A local-first **AI-powered resume optimization platform** built with Next.js 14, combining a professional LaTeX resume editor with intelligent job tracking and resume tailoring capabilities.

**Core Features**: LaTeX Resume Editor (Docker + Monaco), AI Job Scanning (Groq), Semantic Matching (vector-based), Resume Optimization (track changes), Local-First (IndexedDB), Docker Compilation.

## Development Commands

```bash
npm install                 # Install dependencies
npm run dev                # Start dev server (http://localhost:3000)
npm run build              # Production build
npm run lint               # ESLint check
docker pull texlive/texlive:latest  # Pull LaTeX image (~4GB, one-time)
npm run docker:pull        # Alternative pull via npm
npm run docker:check       # Check Docker image availability
```

## Prerequisites

- **Required**: Node.js 20+, modern browser, Groq API Key (`GROQ_API_KEY=gsk-xxxxx` in `.env.local`)
- **Recommended**: Docker Desktop/Engine + `texlive/texlive:latest` image (~4GB) for local LaTeX compilation
- **Optional**: SuperMemory API Key for persistent career memory — see [SuperMemory Setup](docs/SUPERMEMORY_SETUP.md)

Without Docker, falls back to online LaTeX compilation with limited package support.

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

### State Management (Zustand Stores)

**Core Editor Stores**:
- `store/fileSystemStore.ts` — File/folder CRUD, file tree structure
- `store/editorStore.ts` — Current file content, compilation status, errors
- `store/uiStore.ts` — Theme (light/dark), sidebar, layout preferences

**AI Job Tracking Stores**:
- `store/jobStore.ts` — Job CRUD, filtering, scanning state, match stats
- `store/resumeStore.ts` — Master resume, versions, change tracking

All stores persist to IndexedDB for local-first experience.

### Storage Layer (IndexedDB)

Database: `latex-editor-db` (version 2)
- `files` — FileSystemNode objects (indexed by parent)
- `settings` — User preferences and UI state
- `jobs` — Job postings with 384-dim vector embeddings (indexed by status, createdAt)
- `resumeVersions` — Tailored resumes per job (indexed by jobId, createdAt)
- `masterResume` — User's master resume with component embeddings

Access via `lib/indexeddb.ts` wrapper functions.

### Component Structure

- **LaTeX Editor** (`app/page.tsx`): Three-pane layout — Sidebar (FolderTree, QuickAccess) | Editor (Monaco) | Preview (react-pdf)
- **Jobs Dashboard** (`app/jobs/page.tsx`): JobCard (spotlight + match scores), PreviewModal (track changes)
- **AI Agents** (`lib/ai/`): job-parser.ts, semantic-matcher.ts, resume-optimizer.ts

### File System Model

FileSystemNode objects: `id` (UUID), `parentId`, `type` (file/folder), `isPinned`. Full path via parent chain traversal.

## TypeScript Configuration

- Strict mode enabled
- Path alias: `@/*` maps to project root
- Example: `import { db } from '@/lib/indexeddb'`

## Security & Privacy

- All data stored locally in IndexedDB (no backend database)
- Keep `.env.local` private (already in `.gitignore`)
- Semantic matching runs entirely in browser (privacy-first)
- Docker compilation is fully local; online fallback sends LaTeX to latex.aslushnikov.com
- Review sensitive info before using AI features (data sent to Groq API)

**Browser Requirements**: Chrome/Edge 90+, Firefox 88+, Safari 14+

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

## Reference Documentation

Detailed docs extracted for on-demand loading:

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

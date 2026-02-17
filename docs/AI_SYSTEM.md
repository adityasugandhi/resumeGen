# AI Job Scanning & Resume Optimization System

## Overview

The application includes a complete AI-powered job tracking system that scans job postings, performs semantic matching, and generates optimized resume versions.

**Access**: Navigate to `/jobs` route (Jobs Dashboard)

## Architecture

```
User pastes job URL
    ↓
/api/jobs/scan (Groq AI extraction)
    ↓
IndexedDB jobs store
    ↓
Semantic matching (Xenova embeddings)
    ↓
User clicks "Optimize Resume"
    ↓
/api/resume/optimize (Groq AI tailoring)
    ↓
Preview modal (track changes)
    ↓
Export optimized LaTeX → Compile PDF
```

## Groq Model Configuration

Two specialized models for optimal performance:

| Task | Model | Why |
|------|-------|-----|
| **Job Parsing** | `llama3-groq-70b-8192-tool-use-preview` | Optimized for structured extraction, 20% faster |
| **Resume Optimization** | `llama-3.3-70b-versatile` | Better reasoning for complex optimization |

**Environment Variables** (`.env.local`):
```bash
# Required
GROQ_API_KEY=gsk-xxxxx

# Optional (override defaults)
GROQ_JOB_PARSER_MODEL=llama3-groq-70b-8192-tool-use-preview
GROQ_OPTIMIZER_MODEL=llama-3.3-70b-versatile
```

## Key Components

**AI Agents** (`lib/ai/`):
- `job-parser.ts` - Extracts structured data from job URLs using Groq
- `semantic-matcher.ts` - Vector embeddings and cosine similarity matching
- `resume-optimizer.ts` - Generates tailored resumes with tracked changes

**API Routes** (`app/api/`):
- `POST /api/jobs/scan` - Scan job URL, extract with AI, save to IndexedDB
- `POST /api/jobs/analyze` - Calculate semantic job-resume match
- `POST /api/resume/optimize` - Generate optimized resume with changes
- `GET /api/resume/preview/[id]` - Fetch resume version details

**UI Components**:
- `app/jobs/page.tsx` - Jobs dashboard with animated UI
- `components/jobs/JobCard.tsx` - Spotlight card with match scores
- `components/jobs/PreviewModal.tsx` - Track changes preview (overlay + detailed views)

## Workflow Example

1. User pastes LinkedIn job URL
2. AI extracts: title, company, requirements, responsibilities
3. System generates vector embeddings for semantic search
4. Job saved to IndexedDB with 0-100% match score
5. User opens resume file in editor
6. Clicks "Optimize Resume" on job card
7. AI analyzes job requirements vs resume
8. Generates tailored resume with tracked changes
9. Preview modal shows changes with reasoning
10. User accepts/rejects changes granularly
11. Exports optimized LaTeX back to editor
12. Compiles and downloads PDF

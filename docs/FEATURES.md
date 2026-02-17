# Key Features Implementation

## LaTeX Editor Features

**Auto-save**:
- Debounced at 2 seconds in editor component
- Manual save: Ctrl+S (Cmd+S on Mac)
- Updates IndexedDB through `fileSystemStore`

**Dark Mode**:
- Tailwind CSS `dark:` class strategy
- Applied to document element on mount
- Persisted in `uiStore` → IndexedDB

**PDF Preview**:
- Uses `react-pdf` with `pdfjs-dist` 3.11.174
- PDF data passed as base64 data URL from compilation API
- Worker configuration in component to avoid CORS issues

## AI Job Tracking Features

**Job URL Scanning**:
- Paste any job URL (LinkedIn, Indeed, company career pages)
- Groq AI extracts: title, company, location, salary, requirements
- Cheerio parses HTML, removes noise (nav, footer, scripts)
- Generates 384-dim vector embeddings for semantic search
- Saves to IndexedDB with metadata
- Typical scan time: 1-5 seconds

**Semantic Matching**:
- Client-side embeddings using Xenova Transformers (all-MiniLM-L6-v2)
- Runs entirely in browser (privacy-first)
- Calculates cosine similarity between job requirements and resume
- Returns 0-100% match score
- Identifies gaps (missing qualifications)
- Suggests improvements

**Resume Optimization**:
- Analyzes job requirements vs current resume
- Groq AI generates tailored version
- Tracks all changes (added/modified/deleted)
- Provides reasoning for each change
- NO fabrication of experience
- Focus on reframing existing qualifications

**Track Changes Preview**:
- Overlay View: Clean resume with color highlights
  - Green: Added content
  - Yellow: Modified content
  - Red: Deleted content
- Detailed View: Side-by-side comparison
  - Accept/reject changes granularly
  - View AI reasoning for each change
- Export optimized LaTeX back to editor

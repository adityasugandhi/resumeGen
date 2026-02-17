# Performance Characteristics

## LaTeX Editor Performance

- **First Docker compilation**: 5-10 seconds (image layer loading, package initialization)
- **Subsequent Docker compilations**: 3-5 seconds (cached layers)
- **Online compilation**: 3-5 seconds (network dependent)
- **Docker image download**: One-time ~4GB download (~10-30 minutes depending on connection)
- **Auto-save debounce**: 2 seconds
- **IndexedDB operations**: < 100ms for typical file sizes
- **Monaco editor initialization**: ~1 second
- **Temp file cleanup**: < 100ms (automatic after each compilation)

## AI Features Performance

**Job Scanning**:
- **First run** (cold start): 2-5 seconds
  - Groq API call: 0.5-1s (10x faster than Claude)
  - HTML parsing: 0.2-0.5s
  - Embedding generation: 1-3s (first time model loads)
- **Subsequent scans**: 1-3 seconds
  - Groq API: 0.3-0.8s
  - Embeddings: 0.5-1s (model cached)

**Semantic Matching**:
- **First run**: 3-5 seconds (model download ~20 MB)
- **Subsequent runs**: 2-5 seconds
- **Per-job comparison**: 100-200ms
- **Batch processing** (10 jobs): 2-3 seconds

**Resume Optimization**:
- **Analysis + generation**: 3-8 seconds
  - Groq reasoning: 2-6s
  - Change tracking: 0.5-1s
  - LaTeX formatting: 0.2-0.5s
- **Complex resumes** (>5 pages): 5-10 seconds
- **Simple resumes** (1-2 pages): 2-4 seconds

**Embedding Model**:
- **Download**: 20 MB (one-time, ~5-15 seconds)
- **Initialization**: 1-2 seconds (first use)
- **Caching**: Browser cache (persistent)
- **Per-text embedding**: 50-200ms (depending on text length)

**API Response Times** (Groq):
- **Job parsing**: 300-800ms (llama3-tool-use model)
- **Resume optimization**: 2-6 seconds (llama-3.3-versatile model)
- **Cover letter**: 1-3 seconds
- **Inference speed**: ~100-300 tokens/second

**Comparison to Alternatives**:
- **Groq vs Claude**: 5-10x faster inference, 5x cheaper
- **Groq vs GPT-4**: 3-5x faster, similar quality
- **Client-side embeddings**: No API calls, privacy-first, 100% offline after download

**Optimization Tips**:
1. Keep browser tab active during AI operations (prevents throttling)
2. Use Chrome/Edge for best embedding model performance
3. Embedding model caches automatically in browser
4. Rate limit: 30 requests/min (free tier), plan accordingly for batch operations

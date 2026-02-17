# Resume Editor MCP Server

A comprehensive Model Context Protocol (MCP) server for AI-powered LaTeX resume editing. This server exposes tools, resources, and prompts that allow Claude and other AI assistants to help you create, edit, compile, and optimize professional LaTeX resumes.

## Features

### 🛠️ **Tools** (12 AI-Powered Operations)

#### File Operations
- **`create-file`** - Create new LaTeX files with optional templates
- **`update-file`** - Update file content
- **`delete-file`** - Delete files
- **`rename-file`** - Rename files
- **`toggle-pin`** - Pin/unpin files for quick access
- **`list-files`** - List all files or pinned files

#### LaTeX Operations
- **`compile-latex`** - Compile LaTeX to PDF (local → online fallback)
- **`validate-latex`** - Validate LaTeX syntax before compilation
- **`check-latex-installation`** - Check system LaTeX installation
- **`export-pdf`** - Export compiled PDF to file system

#### AI-Powered Analysis
- **`analyze-resume`** - Comprehensive AI resume analysis with ATS optimization
- **`optimize-latex-formatting`** - AI suggestions for LaTeX code improvements
- **`tailor-resume`** - Tailor resume for specific job opportunities

### 📚 **Resources** (8 Data Sources)

- `resume://templates/default` - Professional resume template
- `resume://templates/simple` - Simple document template
- `resume://files/all` - List all LaTeX files
- `resume://files/pinned` - List pinned files
- `resume://files/{fileId}` - Access specific file content
- `resume://system/latex-status` - LaTeX installation status
- `resume://packages/recommended` - Recommended LaTeX packages
- `resume://system/info` - System information

### 💬 **Prompts** (8 Reusable Workflows)

- **`/review-resume`** - Comprehensive resume review
- **`/improve-section`** - Section-specific improvement suggestions
- **`/fix-latex-error`** - Debug LaTeX compilation errors
- **`/optimize-formatting`** - Formatting optimization
- **`/check-grammar`** - Grammar and clarity check
- **`/tailor-resume`** - Tailor for specific job
- **`/add-experience`** - Guide for adding work experience
- **`/convert-to-latex`** - Convert plain text to LaTeX

---

## Quick Start

### Prerequisites

- Node.js 18+
- Next.js development server running (port 3000)
- npm or yarn

### Installation

```bash
# Install dependencies (already done if you ran npm install)
npm install

# Create necessary directories
mkdir -p resume-files mcp-server/logs mcp-server/temp
```

### Running the Server

#### Option 1: MCP Server Only
```bash
npm run mcp:start
```

#### Option 2: Next.js + MCP Server (Recommended)
```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: MCP server
npm run mcp:dev
```

#### Option 3: Both with Concurrently
```bash
# Install concurrently first
npm install -D concurrently

# Run both servers
npm run dev:all
```

The MCP server will start on **http://localhost:3001**

---

## Usage

### With Claude Code

```bash
# Add the MCP server to Claude Code
claude mcp add --transport http resume-mcp http://localhost:3001/mcp

# List available tools
claude mcp list

# Use a tool
claude "Create a new resume file called 'tech-resume.tex'"
claude "Compile my resume and check for errors"
claude "Analyze my resume for ATS optimization"
```

### With Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "resume-editor": {
      "command": "node",
      "args": [
        "/Users/stranzersweb/Projects/resume/mcp-server/index.js"
      ],
      "env": {
        "MCP_PORT": "3001",
        "NEXT_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

Or for development with auto-reload:

```json
{
  "mcpServers": {
    "resume-editor": {
      "command": "npx",
      "args": [
        "tsx",
        "/Users/stranzersweb/Projects/resume/mcp-server/index.ts"
      ],
      "env": {
        "MCP_PORT": "3001"
      }
    }
  }
}
```

### With MCP Inspector

```bash
# Test the server with MCP Inspector
npm run mcp:inspect

# Or manually
npx @modelcontextprotocol/inspector http://localhost:3001/mcp
```

---

## Configuration

### Environment Variables

Create a `.env.local` file:

```bash
# MCP Server Port
MCP_PORT=3001

# MCP Server Host
MCP_HOST=localhost

# Next.js API URL (for LaTeX compilation)
NEXT_API_URL=http://localhost:3000
```

### File Storage

By default, LaTeX files are stored in `./resume-files/`. You can customize this in `mcp-server/config.ts`:

```typescript
export const MCPConfig = {
  // ... other config
  paths: {
    // Custom base directory for LaTeX files
    resumeFiles: '/path/to/your/resumes'
  }
};
```

---

## Usage Examples

### Example 1: Create and Compile a Resume

**User:** "Create a new resume using the default template and compile it"

**Claude's Workflow:**
1. Calls `create-file` tool with template='default'
2. Calls `compile-latex` tool
3. Returns PDF or error feedback

### Example 2: AI-Powered Resume Review

**User:** "Review my resume and suggest improvements for ATS optimization"

**Claude's Workflow:**
1. Reads `resume://files/all` resource to find resumes
2. Executes `/review-resume` prompt with focus on ATS
3. Calls `analyze-resume` tool for detailed analysis
4. Presents structured feedback with severity levels

### Example 3: Fix Compilation Errors

**User:** "My resume won't compile, help me fix it"

**Claude's Workflow:**
1. Attempts `compile-latex` tool
2. Reads error logs from compilation result
3. Executes `/fix-latex-error` prompt with error details
4. Calls `validate-latex` to check syntax
5. Suggests fixes and can apply them with `update-file`

### Example 4: Tailor Resume for Job Application

**User:** "Tailor my resume for a Senior Software Engineer position at Google"

**Claude's Workflow:**
1. Executes `/tailor-resume` prompt with job details
2. Calls `analyze-resume` with current content
3. Provides specific suggestions for:
   - Keywords to emphasize
   - Experiences to highlight
   - Skills to feature prominently
4. Can apply changes with `update-file` tool

---

## API Reference

### Tools

#### `create-file`

Create a new LaTeX file.

**Parameters:**
```json
{
  "name": "my-resume",           // File name (auto-adds .tex)
  "content": "...",              // Optional initial content
  "template": "default"          // default | simple | empty
}
```

**Returns:**
```json
{
  "success": true,
  "fileId": "file-123...",
  "fileName": "my-resume.tex",
  "path": "/my-resume.tex"
}
```

#### `compile-latex`

Compile LaTeX to PDF with intelligent fallback (local → online).

**Parameters:**
```json
{
  "fileId": "file-123...",       // Optional: File ID to compile
  "fileName": "resume.tex",      // Optional: File name to compile
  "content": "...",              // Optional: Direct LaTeX content
  "outputFileName": "resume.pdf",// Optional: Output PDF name
  "useOnline": false             // Force online compilation
}
```

**Returns:**
```json
{
  "success": true,
  "pdfUrl": "data:application/pdf;base64,...",
  "compilationMethod": "local (pdfTeX 3.141592653)",
  "fileName": "resume.pdf"
}
```

#### `analyze-resume`

AI-powered resume analysis.

**Parameters:**
```json
{
  "fileId": "file-123...",       // Optional: File to analyze
  "content": "...",              // Optional: Direct content
  "focusAreas": [                // Optional focus areas
    "ats-optimization",
    "clarity",
    "impact"
  ]
}
```

**Returns:**
```json
{
  "success": true,
  "analysis": "Detailed AI analysis...",
  "suggestions": [
    {
      "section": "Work Experience",
      "severity": "important",
      "issue": "Lacking quantified achievements",
      "recommendation": "Add metrics and numbers..."
    }
  ],
  "overallScore": 78
}
```

### Resources

#### `resume://files/{fileId}`

Access specific file content and metadata.

**Example:**
```bash
# In Claude or MCP Inspector
Read resource: resume://files/file-123abc
```

**Returns:**
```json
{
  "id": "file-123abc",
  "name": "resume.tex",
  "path": "/resume.tex",
  "content": "\\documentclass{article}...",
  "createdAt": "2025-10-18T00:00:00.000Z",
  "modifiedAt": "2025-10-18T05:00:00.000Z",
  "isPinned": true
}
```

### Prompts

#### `/review-resume`

Comprehensive resume review.

**Arguments:**
```json
{
  "fileId": "file-123...",       // Optional: File to review
  "focusOn": "ats-optimization"  // overall | technical-skills | work-experience | ...
}
```

---

## Architecture

### System Diagram

```
┌─────────────────────────┐
│   Claude / AI Client    │
└───────────┬─────────────┘
            │ MCP Protocol
            ↓
┌─────────────────────────┐
│   MCP Server (3001)     │
│  ├─ Tools               │
│  ├─ Resources           │
│  └─ Prompts             │
└───────────┬─────────────┘
            │
    ┌───────┴────────┐
    │                │
    ↓                ↓
┌──────────┐  ┌────────────┐
│ File     │  │ Next.js    │
│ System   │  │ API (3000) │
│          │  │ /api/      │
│ resume-  │  │ compile    │
│ files/   │  │ latex-check│
└──────────┘  └────────────┘
```

### File Structure

```
/resume
├── mcp-server/
│   ├── index.ts              # Main MCP server entry
│   ├── config.ts             # Server configuration
│   ├── tools/
│   │   ├── file-operations.ts    # File CRUD tools
│   │   ├── latex-operations.ts   # Compile, validate
│   │   ├── ai-operations.ts      # AI analysis
│   │   └── index.ts
│   ├── resources/
│   │   └── index.ts          # Templates, files, system info
│   ├── prompts/
│   │   └── index.ts          # Resume review, LaTeX help
│   └── integrations/
│       ├── file-system-client.ts # File operations
│       ├── api-client.ts         # Next.js API calls
│       └── index.ts
├── resume-files/             # LaTeX file storage
├── app/api/
│   ├── compile/              # LaTeX compilation endpoint
│   └── latex-check/          # LaTeX installation check
└── package.json
```

---

## Troubleshooting

### Server Won't Start

**Error:** Port 3001 already in use

**Solution:**
```bash
# Use different port
MCP_PORT=3002 npm run mcp:start

# Or kill process using port 3001
lsof -ti:3001 | xargs kill -9
```

### LaTeX Compilation Fails

**Error:** "Cannot connect to Next.js server"

**Solution:**
```bash
# Ensure Next.js is running
npm run dev

# Check if it's accessible
curl http://localhost:3000/api/latex-check
```

### File Operations Not Working

**Error:** "File not found"

**Solution:**
```bash
# Check resume-files directory exists
ls -la resume-files/

# Check file metadata
cat resume-files/.metadata.json
```

---

## Development

### Running Tests

```bash
# Test with MCP Inspector
npm run mcp:inspect

# Health check
curl http://localhost:3001/health

# Test specific tool
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'
```

### Adding New Tools

1. Create tool in appropriate file under `mcp-server/tools/`
2. Register tool in the registration function
3. Restart MCP server
4. Test with MCP Inspector

Example:
```typescript
// In mcp-server/tools/file-operations.ts
server.registerTool(
  'my-new-tool',
  {
    title: 'My New Tool',
    description: 'Does something cool',
    inputSchema: { param: z.string() },
    outputSchema: { result: z.string() }
  },
  async ({ param }) => {
    // Implementation
    return {
      content: [{ type: 'text', text: 'Result' }],
      structuredContent: { result: 'value' }
    };
  }
);
```

---

## Performance

- **File Operations:** < 50ms
- **Local LaTeX Compilation:** 2-5 seconds (first compile), < 2 seconds (subsequent)
- **Online LaTeX Compilation:** 3-7 seconds
- **AI Analysis:** 5-15 seconds (depends on content length)
- **Resource Access:** < 100ms

---

## Security

- MCP server runs locally (localhost only by default)
- No authentication required for local development
- For production deployment:
  - Enable authentication middleware
  - Use HTTPS
  - Restrict CORS origins
  - Validate all inputs

---

## License

Same as the parent project.

---

## Contributing

1. Add new tools/resources/prompts to appropriate modules
2. Update this README
3. Test with MCP Inspector
4. Submit PR

---

## Support

- GitHub Issues: [Project Repository]
- MCP Documentation: https://modelcontextprotocol.io
- Claude Code Docs: https://docs.claude.com/claude-code

---

**Built with ❤️ using the Model Context Protocol**

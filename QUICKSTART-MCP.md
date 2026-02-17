# 🚀 Quick Start: Resume MCP Server

## What You Just Built

A complete MCP (Model Context Protocol) server that gives Claude AI-powered superpowers for editing your LaTeX resume!

### 📊 Stats
- **12 Tools** - File operations, LaTeX compilation, AI analysis
- **8 Resources** - Templates, file access, system info
- **8 Prompts** - Pre-configured AI workflows
- **100% Functional** - Tested and ready to use!

---

## ⚡ Get Started in 60 Seconds

### Step 1: Start the Servers

```bash
# Terminal 1: Start Next.js (for LaTeX compilation)
npm run dev

# Terminal 2: Start MCP Server
npm run mcp:start
```

You should see:
```
✓ File system initialized at: /Users/stranzersweb/Projects/resume/resume-files
✓ Connected to Next.js API at: http://localhost:3000
✓ Tools registered
✓ Resources registered
✓ Prompts registered

Server Running at http://localhost:3001/mcp
```

### Step 2: Test with MCP Inspector

```bash
# In Terminal 3
npm run mcp:inspect
```

This opens the MCP Inspector web interface where you can:
- ✅ View all available tools
- ✅ Test tools interactively
- ✅ Browse resources
- ✅ Try prompts

### Step 3: Connect to Claude Code

```bash
claude mcp add --transport http resume-mcp http://localhost:3001/mcp
```

Now you can chat with Claude and ask things like:

> "Create a new resume file called 'tech-resume.tex' using the default template"

> "Compile my resume and check for any errors"

> "Analyze my resume for ATS optimization and suggest improvements"

> "Help me fix this LaTeX compilation error: [error message]"

---

## 🎯 Try These Cool Examples

### Example 1: Create Your First Resume

**Ask Claude:**
```
"Create a new resume file called 'my-resume.tex' with the professional template,
then compile it and show me the result"
```

**What Claude Does:**
1. Calls `create-file` tool with template='default'
2. Calls `compile-latex` tool
3. Returns the compiled PDF or any errors

---

### Example 2: AI Resume Review

**Ask Claude:**
```
"Review my resume and give me specific suggestions for improving ATS optimization
and impact. Focus on my work experience section."
```

**What Claude Does:**
1. Reads your resume files using `resume://files/all` resource
2. Executes `/review-resume` prompt with ATS focus
3. Calls `analyze-resume` tool for detailed analysis
4. Provides structured feedback with:
   - Overall score (0-100)
   - Critical issues
   - Important improvements
   - Suggestions
   - Specific examples

---

### Example 3: Tailor for a Job

**Ask Claude:**
```
"I'm applying for a Senior Software Engineer position at Google working on
distributed systems. Tailor my resume to highlight relevant experience
and add appropriate keywords."
```

**What Claude Does:**
1. Calls `tailor-resume` tool with job details
2. Analyzes your current resume content
3. Suggests specific changes:
   - Keywords to add
   - Experiences to emphasize
   - Skills to highlight
   - Achievements to expand
4. Can apply changes with `update-file` tool

---

### Example 4: Fix Compilation Errors

**Ask Claude:**
```
"My resume won't compile. The error says 'Undefined control sequence \\resumeItem'.
Help me fix it."
```

**What Claude Does:**
1. Executes `/fix-latex-error` prompt
2. Calls `validate-latex` to check syntax
3. Identifies the issue (missing macro definition)
4. Provides the fix with explanation
5. Can apply the fix using `update-file`

---

## 📚 Available Commands

### File Operations
```
"Create a new file called X"
"Update file X with this content: [content]"
"Delete file X"
"Rename file X to Y"
"Pin file X for quick access"
"List all my resume files"
```

### LaTeX Operations
```
"Compile my resume"
"Compile file X to PDF"
"Validate the LaTeX syntax in file X"
"Check if LaTeX is installed on my system"
"Export my resume as PDF to [path]"
```

### AI Analysis
```
"Analyze my resume for [ats-optimization/clarity/impact]"
"Review my resume focusing on [technical-skills/work-experience/projects]"
"Optimize the LaTeX formatting in my resume"
"Tailor my resume for [job title] at [company]"
"Help me improve the [section name] section"
"Check my resume for grammar and clarity"
```

### Resources (Read-Only)
```
"Show me the default resume template"
"List all my LaTeX files"
"What files do I have pinned?"
"Show me the content of file [fileId]"
"Check my LaTeX installation status"
"What LaTeX packages are recommended for resumes?"
```

---

## 🔧 Useful Commands

### Health Check
```bash
curl http://localhost:3001/health
```

### List All Tools
In Claude or MCP Inspector, ask:
```
"What tools are available?"
```

### View File Storage
```bash
ls -la resume-files/
cat resume-files/.metadata.json
```

---

## 💡 Pro Tips

### 1. Keep Both Servers Running
The MCP server needs Next.js API for LaTeX compilation:
```bash
# Use this to run both at once
npm install -D concurrently
npm run dev:all
```

### 2. File Storage Location
Files are stored in `./resume-files/` directory. You can:
- Edit them directly in your favorite editor
- Access them from the MCP server
- Version control them with git

### 3. Template System
Three templates available:
- **`default`** - Professional resume with custom formatting (recommended)
- **`simple`** - Basic LaTeX document
- **`empty`** - Blank file

### 4. AI Analysis Best Practices
For best AI analysis results:
- Provide context (job title, industry)
- Specify focus areas (ATS, technical skills, etc.)
- Ask for specific improvements
- Iterate with follow-up questions

---

## 🐛 Troubleshooting

### "Cannot connect to Next.js server"
```bash
# Make sure Next.js is running
npm run dev

# Check it's accessible
curl http://localhost:3000/api/latex-check
```

### "Port 3001 already in use"
```bash
# Use a different port
MCP_PORT=3002 npm run mcp:start

# Or kill the process
lsof -ti:3001 | xargs kill -9
```

### "LaTeX compilation failed"
Two options:
1. **Local:** Install LaTeX (brew install basictex on macOS)
2. **Online:** The server automatically falls back to online compilation

---

## 📖 Full Documentation

See [`README-MCP.md`](./README-MCP.md) for:
- Complete API reference
- Architecture details
- All tool parameters
- Advanced configuration
- Development guide

---

## 🎉 What's Next?

1. **Try the examples above** - Get familiar with the tools
2. **Create your resume** - Use the default template
3. **Get AI feedback** - Ask Claude to review it
4. **Compile to PDF** - Export your polished resume
5. **Iterate** - Keep improving with AI assistance!

---

**🤖 Powered by MCP + Claude + LaTeX**

*Your AI-powered resume editing assistant is ready!*

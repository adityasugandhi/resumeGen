# Quick Start Guide

Get your LaTeX Resume Editor up and running in 5 minutes!

## Step 1: Prerequisites Check

Before starting, verify you have:

### Node.js (Required)
```bash
node --version
# Should show v18.0.0 or higher
```

### LaTeX Distribution (Required for compilation)
```bash
pdflatex --version
# Should show version information
```

**Don't have LaTeX?** Install it:
- **macOS**: `brew install --cask mactex-no-gui` (faster than full MacTeX)
- **Linux**: `sudo apt-get install texlive-latex-base texlive-latex-extra`
- **Windows**: Download and install [MiKTeX](https://miktex.org/download)

## Step 2: Installation

```bash
# Navigate to the project directory
cd /path/to/resume

# Install dependencies (this will take 1-2 minutes)
npm install

# Start the development server
npm run dev
```

## Step 3: Open the Application

Open your browser and go to:
```
http://localhost:3000
```

You should see the LaTeX Resume Editor interface with a sample resume file already loaded!

## Step 4: Your First Edit

1. Click on `resume.tex` in the sidebar (it should already be selected)
2. Edit the name and contact information in the editor
3. Click the **"Compile"** button in the toolbar
4. Wait 2-5 seconds
5. See your PDF preview on the right!

## Step 5: Create a New Resume

1. Click the **"File"** button in the sidebar
2. Name it `cover-letter.tex`
3. Edit the LaTeX content
4. Compile and preview
5. Click **"Download"** to save the PDF

## Troubleshooting

### "LaTeX compilation failed"
- **Cause**: LaTeX is not installed or not in your PATH
- **Fix**: Install a LaTeX distribution (see Step 1)

### "Module not found" errors
- **Cause**: Dependencies not installed
- **Fix**: Run `npm install` again

### Page won't load
- **Cause**: Port 3000 might be in use
- **Fix**: Kill the process using port 3000 or change the port:
  ```bash
  npm run dev -- -p 3001
  ```

### PDF preview is blank
- **Cause**: Compilation hasn't run yet or failed
- **Fix**: Click the "Compile" button and check for errors in the toolbar

## What's Next?

- **Organize**: Create folders to organize multiple resume versions
- **Pin Files**: Right-click files and select "Pin" for quick access
- **Dark Mode**: Click the moon icon in the sidebar
- **Keyboard Shortcuts**: Use Ctrl+S (Cmd+S on Mac) to save

## Need Help?

Check the main [README.md](./README.md) for:
- Complete feature list
- Detailed troubleshooting
- Configuration options
- Project structure

---

**Tip**: The application auto-saves your changes every 2 seconds, so you won't lose your work!

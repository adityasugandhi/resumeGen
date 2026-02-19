# Installation Guide - LaTeX Resume Editor

## Quick Start (Without LaTeX)

The application now supports **online LaTeX compilation** as a fallback! You can start using it immediately:

```bash
npm run dev
```

Then open http://localhost:3000 and click **Compile**. The app will automatically use online compilation if LaTeX is not installed locally.

**Note**: Online compilation automatically simplifies your resume to use standard fonts (removes CormorantGaramond, Charter, and FontAwesome5). For the full design with custom fonts, install LaTeX locally.

## Installing LaTeX (Recommended for Best Performance)

For faster compilation and offline usage, install LaTeX locally:

### macOS Installation

**Option 1: BasicTeX (Recommended - Faster)**
```bash
# Install BasicTeX (~100MB download, ~500MB installed)
brew install --cask basictex

# Update PATH (run in your current terminal)
eval "$(/usr/libexec/path_helper)"

# Update TeX Live Manager
sudo tlmgr update --self

# Install required packages for the resume template
sudo tlmgr install collection-fontsrecommended
sudo tlmgr install cormorantgaramond charter fontawesome5 enumitem titlesec hyperref xcolor geometry tabularx

# Restart your terminal or development server
```

**Option 2: Full MacTeX (Complete - Slower)**
```bash
# Install full MacTeX distribution (~4.5GB)
brew install --cask mactex-no-gui

# Install custom fonts
sudo tlmgr install cormorantgaramond charter fontawesome5

# Restart terminal
```

### Linux Installation

**Ubuntu/Debian:**
```bash
# Full installation (recommended)
sudo apt-get update
sudo apt-get install texlive-full

# Or minimal installation
sudo apt-get install texlive-latex-base texlive-fonts-recommended texlive-fonts-extra
sudo apt-get install texlive-latex-extra
```

**Fedora/RHEL:**
```bash
sudo dnf install texlive-scheme-full
```

### Windows Installation

1. Download **MiKTeX** from https://miktex.org/download
2. Run the installer (choose "Install for all users" if you have admin rights)
3. During installation, select "Always install missing packages on-the-fly"
4. Restart your computer after installation

## Verification

### Check LaTeX Installation

```bash
# Check if pdflatex is available
pdflatex --version

# Should output something like:
# pdfTeX 3.141592653-2.6-1.40.25 (TeX Live 2024)
```

### Using the Diagnostic Endpoint

Start your dev server and visit:
```
http://localhost:3000/api/latex-check
```

This will show:
- Whether LaTeX is installed
- LaTeX version
- Available packages
- Recommendations for missing components

## How Compilation Works

The application uses a **smart fallback system**:

1. **Try Local First**: If LaTeX is installed locally, use it (faster, works offline)
2. **Fallback to Online**: If local compilation fails or LaTeX isn't installed, automatically use the online LaTeX.Online API
3. **Clear Error Messages**: If both fail, you'll see helpful installation instructions

## Troubleshooting

### Error: "pdflatex: command not found"

**Cause**: LaTeX is not in your PATH

**Solution (macOS)**:
```bash
# Add to your ~/.zshrc or ~/.bash_profile
export PATH="/Library/TeX/texbin:$PATH"
export PATH="/usr/local/texlive/2024/bin/universal-darwin:$PATH"

# Reload shell
source ~/.zshrc  # or source ~/.bash_profile
```

### Error: "Font not found"

**Cause**: Missing font packages (CormorantGaramond, Charter, FontAwesome5)

**Solution**:
```bash
# Install missing packages
sudo tlmgr install cormorantgaramond charter fontawesome5

# Or use online compilation (no local packages needed)
```

### Compilation is Slow

**Local compilation**: First time may take 5-10 seconds as packages load. Subsequent compilations are faster (2-3 seconds).

**Online compilation**: Usually takes 3-5 seconds. Depends on internet speed and server load.

**Recommendation**: Install LaTeX locally for best performance.

### Permission Denied Errors

**macOS/Linux**:
```bash
# Make sure you have sudo access
sudo tlmgr update --self

# If still failing, check ownership
ls -la /usr/local/texlive/
```

## After Installation

1. **Restart your terminal** to apply PATH changes
2. **Restart the development server**:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```
3. **Try compiling** your resume
4. Check the status indicator - it should show "local" instead of "online (no local LaTeX)"

## Online Compilation Mode

If you prefer to use online compilation even with LaTeX installed:

```typescript
// In your code, pass useOnline: true
fetch('/api/compile', {
  method: 'POST',
  body: JSON.stringify({
    content: latexContent,
    filename: 'resume.tex',
    useOnline: true  // Force online compilation
  })
})
```

## System Requirements

### Disk Space
- **BasicTeX**: ~500MB
- **Full MacTeX**: ~5GB
- **TeX Live (Linux)**: ~5-7GB
- **MiKTeX (Windows)**: ~2-4GB

### RAM
- Compilation uses ~200-500MB RAM
- More complex documents may use up to 1GB

### Network
- **Local**: Works completely offline after installation
- **Online fallback**: Requires internet connection (3-5MB per compilation)

## Getting Help

If you encounter issues:

1. Check the diagnostic endpoint: `/api/latex-check`
2. Review error messages in the UI (now includes installation instructions)
3. Check if the online fallback is working
4. Verify your LaTeX installation: `pdflatex --version`

## Performance Comparison

| Method | Speed | Offline | Package Support |
|--------|-------|---------|-----------------|
| Local LaTeX | 2-3s | ✅ Yes | ✅ All packages |
| Online Fallback | 3-5s | ❌ No | ⚠️ Common packages |

**Recommendation**: Install BasicTeX for the best balance of speed, size, and features.

# LaTeX Package Requirements

This resume uses several LaTeX packages. Most are included in standard LaTeX distributions, but some may require additional installation.

## Standard Packages (Included by Default)

These packages are included in most LaTeX distributions:

- `xcolor` - Color support
- `ragged2e` - Text alignment
- `latexsym` - LaTeX symbols
- `enumitem` - List formatting
- `graphicx` - Graphics support
- `titlesec` - Section title formatting
- `marvosym` - Symbol fonts
- `hyperref` - Hyperlinks and URLs
- `babel` - Language support
- `tabularx` - Enhanced tables
- `multicol` - Multiple columns
- `geometry` - Page layout

## Font Packages (May Require Installation)

These font packages might need to be installed separately:

### CormorantGaramond
A serif font family. Install with:
```bash
# TeX Live
sudo tlmgr install cormorantgaramond

# MiKTeX (Windows)
# Will auto-install when compiling, or use:
mpm --install=cormorantgaramond
```

### Charter
A serif font. Install with:
```bash
# TeX Live
sudo tlmgr install charter

# MiKTeX
mpm --install=charter
```

### FontAwesome5
Icons and symbols. Install with:
```bash
# TeX Live
sudo tlmgr install fontawesome5

# MiKTeX
mpm --install=fontawesome5
```

## Quick Installation (All Packages)

### macOS (TeX Live via MacTeX)
```bash
# Install missing packages
sudo tlmgr install cormorantgaramond charter fontawesome5
```

### Linux (TeX Live)
```bash
# Ubuntu/Debian
sudo apt-get install texlive-fonts-extra

# Or using tlmgr
sudo tlmgr install cormorantgaramond charter fontawesome5
```

### Windows (MiKTeX)
MiKTeX will automatically prompt to install missing packages during compilation. Alternatively:
```powershell
mpm --install=cormorantgaramond
mpm --install=charter
mpm --install=fontawesome5
```

## Full LaTeX Distribution (Recommended)

To avoid package issues, install the complete LaTeX distribution:

### macOS
```bash
brew install --cask mactex
# Full distribution: ~4.5GB
```

### Linux
```bash
sudo apt-get install texlive-full
# Full distribution: ~5GB
```

### Windows
Download and install the full [MiKTeX distribution](https://miktex.org/download).

## Troubleshooting Compilation Errors

### Error: "Font CormorantGaramond not found"
**Solution**: Install the font package (see above) or replace with a standard font:
```latex
% Replace this line:
\usepackage{CormorantGaramond,charter}

% With:
\usepackage{times}  % Or another standard font
```

### Error: "File fontawesome5.sty not found"
**Solution**: Install fontawesome5 package or comment out the line:
```latex
% \usepackage{fontawesome5}
```

### Error: "Undefined control sequence"
**Solution**: This usually means a package is missing. Check the compilation log for the package name and install it.

## Alternative: Use Standard Fonts

If you want to avoid installing extra packages, replace the font setup with standard fonts:

```latex
% Replace:
\usepackage{CormorantGaramond,charter}

% With:
\usepackage{times}        % Times Roman font
% or
\usepackage{helvet}       % Helvetica font
% or
\usepackage{palatino}     % Palatino font
```

## Verifying Your Installation

Check which packages are installed:

```bash
# TeX Live
tlmgr list --only-installed | grep -E "cormorant|charter|fontawesome"

# Check if pdflatex can find packages
kpsewhich cormorantgaramond.sty
kpsewhich charter.sty
kpsewhich fontawesome5.sty
```

## Notes

- The application will display LaTeX compilation errors if packages are missing
- Font packages are cosmetic - the resume will compile with standard fonts if needed
- For production use, install the full LaTeX distribution to avoid issues

# LaTeX Resume Editor

A lightweight, local-first LaTeX editor built with Next.js, designed specifically for creating and managing resumes and documents. Features real-time compilation, PDF preview, and a clean, modern interface.

![LaTeX Resume Editor](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8)

## Features

- **Real-time LaTeX Editing**: Monaco editor with syntax highlighting and auto-completion
- **Live PDF Preview**: Compile and preview your LaTeX documents instantly
- **File Management**: Create, organize, and manage multiple LaTeX files with folder support
- **Local-First**: All files stored locally in IndexedDB for privacy and offline access
- **Quick Access**: Pin frequently used resume variants for easy switching
- **Dark Mode**: Toggle between light and dark themes
- **Download PDF**: Export compiled documents directly to PDF
- **Auto-save**: Automatic saving of changes every 2 seconds

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **LaTeX distribution** (required for compilation):
  - **macOS**: Install MacTeX - `brew install --cask mactex`
  - **Linux**: Install TeX Live - `sudo apt-get install texlive-full`
  - **Windows**: Install MiKTeX - [Download here](https://miktex.org/download)

### LaTeX Package Requirements

The default resume template uses custom fonts and packages. See [LATEX_PACKAGES.md](./docs/LATEX_PACKAGES.md) for detailed package requirements and installation instructions.

**Quick install for required fonts:**
```bash
# macOS/Linux (TeX Live)
sudo tlmgr install cormorantgaramond charter fontawesome5

# Windows (MiKTeX)
# Packages auto-install during compilation, or use:
mpm --install=cormorantgaramond charter fontawesome5
```

**Note**: If you encounter font-related compilation errors, you can either install the packages above or edit `lib/latex-utils.ts` to use standard fonts.

## Installation

1. **Clone or navigate to the project directory**:
   ```bash
   cd /path/to/resume
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify LaTeX installation**:
   ```bash
   pdflatex --version
   ```
   You should see version information. If not, install a LaTeX distribution (see Prerequisites).

## Usage

### Development Mode

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

Build the application for production:

```bash
npm run build
npm start
```

## Quick Start Guide

1. **Create Your First File**:
   - Click the "File" button in the sidebar
   - Name your file (e.g., `resume.tex`)
   - A default resume template will be loaded

2. **Edit Your Resume**:
   - Edit the LaTeX content in the Monaco editor
   - Changes are auto-saved every 2 seconds
   - Use Ctrl+S (Cmd+S on Mac) to manually save

3. **Compile and Preview**:
   - Click the "Compile" button in the editor toolbar
   - Wait for compilation (usually 2-5 seconds)
   - View the PDF preview on the right panel

4. **Download PDF**:
   - Click the "Download" button to export your PDF
   - The file will be saved to your Downloads folder

5. **Organize Files**:
   - Create folders to organize multiple resume versions
   - Right-click files to rename, delete, or pin them
   - Pinned files appear in the "Quick Access" section

## Project Structure

```
resume/
├── app/
│   ├── api/
│   │   └── compile/          # LaTeX compilation API route
│   │       └── route.ts
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Main application page
│   └── globals.css           # Global styles
├── components/
│   ├── Sidebar/              # File tree and navigation
│   │   ├── Sidebar.tsx
│   │   ├── FolderTree.tsx
│   │   └── QuickAccess.tsx
│   ├── Editor/               # Monaco editor components
│   │   ├── Editor.tsx
│   │   └── EditorToolbar.tsx
│   ├── Preview/              # PDF viewer components
│   │   ├── Preview.tsx
│   │   └── PDFViewer.tsx
│   └── FileManager/          # File operation modals
│       ├── FileUpload.tsx
│       ├── NewFileModal.tsx
│       └── DeleteConfirm.tsx
├── store/                    # Zustand state management
│   ├── fileSystemStore.ts    # File system operations
│   ├── editorStore.ts        # Editor state
│   └── uiStore.ts            # UI preferences
├── lib/                      # Utilities
│   ├── indexeddb.ts          # IndexedDB operations
│   ├── latex-utils.ts        # LaTeX helpers
│   └── utils.ts              # General utilities
├── types/
│   └── index.ts              # TypeScript definitions
└── package.json
```

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3
- **Editor**: Monaco Editor (@monaco-editor/react)
- **PDF Rendering**: react-pdf + pdfjs-dist
- **State Management**: Zustand
- **Storage**: IndexedDB (via idb)
- **LaTeX Compilation**: node-latex
- **Icons**: Lucide React

## Configuration

### Environment Variables

Create a `.env.local` file for custom configuration (optional):

```env
# API timeout for LaTeX compilation (milliseconds)
COMPILATION_TIMEOUT=30000
```

### Customizing Templates

Edit the default template in `lib/latex-utils.ts`:

```typescript
export const DEFAULT_RESUME_TEMPLATE = `
\\documentclass[11pt,a4paper]{article}
// ... your custom template
`;
```

## Keyboard Shortcuts

- **Ctrl+S** (Cmd+S): Save current file
- **Escape**: Close modals/dialogs
- **Enter**: Confirm modal actions

## Troubleshooting

### LaTeX Compilation Fails

**Problem**: "Compilation failed" error appears.

**Solutions**:
1. Ensure LaTeX is installed: `pdflatex --version`
2. Check your LaTeX syntax for errors
3. Review the error message in the editor toolbar
4. Verify all required packages are installed

### PDF Preview Not Loading

**Problem**: PDF viewer shows loading spinner indefinitely.

**Solutions**:
1. Check browser console for errors
2. Ensure the compilation succeeded first
3. Try refreshing the page
4. Clear browser cache and IndexedDB

### Files Not Persisting

**Problem**: Files disappear after page refresh.

**Solutions**:
1. Check if IndexedDB is enabled in your browser
2. Ensure you're not in private/incognito mode
3. Check browser storage permissions
4. Clear IndexedDB and restart: Open DevTools → Application → IndexedDB

### Slow Compilation

**Problem**: LaTeX compilation takes more than 10 seconds.

**Solutions**:
1. Simplify your LaTeX document
2. Remove unnecessary packages
3. Reduce the number of compilation passes in `app/api/compile/route.ts`
4. Increase the timeout in the API route

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Note**: Internet Explorer is not supported.

## Performance Tips

1. **Auto-save**: Files are auto-saved every 2 seconds. Manual save is instant.
2. **Compilation**: First compilation may take longer as LaTeX packages load.
3. **Storage**: IndexedDB has no practical limit for document storage.
4. **Large Documents**: For documents > 50 pages, compilation may take 10-15 seconds.

## Contributing

This is a standalone project. To modify:

1. Fork or clone the repository
2. Make your changes
3. Test thoroughly with `npm run dev`
4. Build for production with `npm run build`

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review LaTeX documentation: [Overleaf Docs](https://www.overleaf.com/learn)
3. Verify your LaTeX installation is working independently

## Acknowledgments

- **Monaco Editor** - Powerful code editor from VS Code
- **react-pdf** - PDF rendering for React
- **node-latex** - LaTeX compilation for Node.js
- **Zustand** - Lightweight state management
- **Tailwind CSS** - Utility-first CSS framework

---

Built with ❤️ using Next.js and TypeScript

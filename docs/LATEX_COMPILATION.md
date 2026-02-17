# LaTeX Compilation System

## Docker-Based Compilation with Intelligent Fallback

The application uses a two-tier compilation strategy in `app/api/compile/route.ts`:

1. **Docker Compilation (Primary)**: Uses `texlive/texlive:latest` Docker image
   - Provides consistent LaTeX environment across all platforms
   - Includes ALL LaTeX packages (no manual package installation needed)
   - Works offline (after initial image download)
   - Compilation time: 3-5 seconds for typical resumes
   - Automatic cleanup of temporary files
   - Full support for custom fonts and packages

2. **Online Compilation (Fallback)**: Uses LaTeX.Online API (https://latex.aslushnikov.com)
   - Activates when Docker is unavailable or Docker compilation fails
   - Auto-simplifies LaTeX by removing unsupported packages (CormorantGaramond, charter, fontawesome5)
   - Requires internet connection
   - Limited package support
   - 3-5 second compilation time

## Compilation Flow

```
User clicks "Compile"
    ↓
Check Docker installation
    ↓
Docker running? ──No──> Try online compilation
    ↓ Yes                       ↓
Check texlive image        Online success? ──Yes──> Return PDF
    ↓                           ↓ No
Image available? ──No──> Try online compilation ──> Show error + install instructions
    ↓ Yes
Run Docker compilation
    ↓
Success? ──Yes──> Return PDF
    ↓ No
Try online fallback
    ↓
Return PDF or error
```

## Docker Implementation Details

- **Image**: `texlive/texlive:latest` (~4GB, includes full TeX Live distribution)
- **Container**: Temporary, auto-removed after compilation (`--rm` flag)
- **Volume Mount**: LaTeX files written to temporary directory, mounted to `/workspace`
- **Compilation**: 2-pass pdflatex with `-interaction=nonstopmode`
- **Error Parsing**: Reads `.log` files for detailed error information
- **Timeout**: 30 seconds per pass (configurable in `route.ts`)

## Changing Docker Image Tag

To use a specific TeX Live version, update `TEXLIVE_IMAGE_TAG` in `app/api/compile/route.ts`:

```typescript
const TEXLIVE_IMAGE_TAG = 'latest';  // or 'TL2024', 'TL2023', etc.
```

## Docker Image Information

The `texlive/texlive:latest` Docker image includes:

- Full TeX Live distribution with ALL packages
- Size: ~4GB compressed, ~8GB uncompressed
- Includes: pdflatex, xelatex, lualatex, and all common LaTeX packages
- Custom fonts: CormorantGaramond, Charter, FontAwesome5, and 1000+ more
- No manual package installation needed (unlike system TeX Live)
- Updated regularly to latest TeX Live version

### Alternative Images

For smaller image size, you can use:
- `texlive/texlive:TL2024-historic` - Specific frozen version
- `texlive/texlive:latest-minimal` - Minimal installation (~500MB) - may not support all templates

Update `TEXLIVE_IMAGE_TAG` in `app/api/compile/route.ts` to change the image.

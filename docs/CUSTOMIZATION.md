# Customization

## Default Resume Template

Edit `lib/latex-utils.ts` → `DEFAULT_RESUME_TEMPLATE` constant. Current template uses:
- Custom fonts: CormorantGaramond, Charter, FontAwesome5
- Custom macros: `\resumeSubheading`, `\resumeItem`, `\resumeItemsStart/End`
- Colors: metablue, darkgray, azureblue

## LaTeX Package Simplification

For online compilation, packages are simplified in `app/api/compile/route.ts` → `simplifyForOnline()`:
- Removes unsupported custom fonts
- Replaces FontAwesome5 with marvosym
- Automatically retries with simplified version on package errors

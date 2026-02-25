# AGENTS.md

Guidance for agentic coding in this repository.

## Quick commands

- Install: `npm install`
- Dev server (Next.js): `npm run dev` (http://localhost:3000)
- Dev server + MCP: `npm run dev:all`
- Build: `npm run build`
- Start (prod): `npm run start`
- Lint: `npm run lint`

## Tests

- Test runner: not configured.
- Single test: not available (no Jest/Vitest/Playwright config).
- Use targeted scripts for manual runs:
  - Cron once: `npm run cron:once`
  - Queue list: `npm run queue:list`
  - Submit dry run: `npm run queue:submit:dry`
- If you add a test runner, document the command and how to run a single test here.

## Repository constraints

- Framework: Next.js 14 (App Router), TypeScript strict mode.
- Styling: Tailwind CSS only. Never use inline CSS.
- Path alias: `@/*` maps to repo root.
- LaTeX compilation can use Docker; see `npm run docker:pull`.

## Code style and formatting

- TypeScript strict mode; do not weaken types.
- Prefer explicit types for complex objects and return values.
- Avoid `any`. ESLint warns on `@typescript-eslint/no-explicit-any`.
- Unused vars: prefix with `_` to avoid lint warnings.
- Prefer `const` over `let` when possible.
- `no-var` enforced.
- `console` usage: only `console.warn` and `console.error` are allowed.
- JSX: React import not required (`react/react-in-jsx-scope` off).

## Imports

- Import order (enforced by ESLint):
  1. Builtin
  2. External
  3. Internal (`@/**`)
  4. Parent
  5. Sibling
  6. Index
- Keep `react` at the top of external imports.
- Alphabetize within groups (case-insensitive).
- Do not insert blank lines between import groups.

## Naming conventions

- Components: `PascalCase`.
- Hooks: `useSomething`.
- Files: `kebab-case` or `PascalCase` to match surrounding files.
- Constants: `SCREAMING_SNAKE_CASE` for global constants, otherwise `camelCase`.
- Types/Interfaces: `PascalCase`.

## Error handling

- Prefer typed error results and explicit error surfaces in UI.
- For async flows, handle failures and show user feedback (toast, UI state).
- Do not swallow errors; log via `console.error` if needed.

## State management

- Zustand stores live in `store/` and persist to IndexedDB.
- Keep store shape stable and typed; update in one place.

## Tailwind and UI

- Use Tailwind classes for styling; no inline styles.
- Prefer existing design tokens from `tailwind.config.ts`.
- Keep class lists readable and consistent with existing components.

## LaTeX resume generation

- Master template: `master-template.tex`.
- Always preserve required formatting:
  - Blue section rules: `\color{metablue}\titlerule`.
  - Projects section uses a blue `tcolorbox`.
  - Charter font, 10pt, letterpaper, 0.225in margins.
  - Section headings are blue and ALL CAPS via `\scshape`.
  - Contact format: Phone | blue location | email | GitHub | website.
- When generating a new resume, copy `master-template.tex` and replace
  placeholder sections (do not reformat the template).

## AI agents and tools

- Job Search Agent: `lib/ai/agent/job-search-agent.ts`.
- Code Agent: `lib/ai/agent/code-agent.ts`.
- Memory Health Agent: `lib/ai/agent/memory-health-agent.ts`.
- Job search tools live in `lib/ai/agent/tools.ts`.

## Data and storage

- Vector DB: LanceDB at `~/.lancedb/career-memory`.
- IndexedDB wrapper: `lib/indexeddb.ts` (DB name `latex-editor-db`).
- PostgreSQL + Drizzle for automation; see `lib/db/`.

## Scripts and automation

- MCP server:
  - Dev: `npm run mcp:dev`
  - Start: `npm run mcp:start`
  - Inspect: `npm run mcp:inspect`
- Cron and queue commands live in `scripts/` and run via `tsx`.

## Lint rules of note

- React hooks rules are enforced; keep dependency arrays complete.
- `@next/next/no-html-link-for-pages` is enforced.

## Cursor/Copilot rules

- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md`
  found in this repo.

## Where to look

- App entry: `app/page.tsx` and `app/layout.tsx`.
- LaTeX compile route: `app/api/compile/route.ts`.
- Editor components: `components/Editor/`.
- Stores: `store/`.
- Diff engine: `lib/diff/`.

## Development environment

- Required: Node.js 20+ and `GROQ_API_KEY` in `.env.local`.
- Optional: Docker for local LaTeX compilation.
- Additional APIs (Anthropic/AWS/Perplexity/SuperMemory) enable
  advanced features; see `CLAUDE.md`.

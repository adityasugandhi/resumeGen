# Contributing to CareerForge

Thanks for your interest in contributing! This guide will help you get set up and familiar with the codebase.

## Development Setup

### Prerequisites
- Node.js 20+
- npm
- Git
- (Optional) Docker Desktop — for local LaTeX compilation
- (Optional) PostgreSQL — for career automation features

### Getting Started

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/<your-username>/resume.git
   cd resume
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env.local
   ```
   At minimum, set one of:
   - `OPENROUTER_API_KEY` — recommended for job parsing (~4x cheaper)
   - `GROQ_API_KEY` — alternative parser

4. **(Optional) Set up LaTeX compilation**:
   ```bash
   npm run docker:pull    # Downloads texlive/texlive:latest (~4GB)
   ```

5. **(Optional) Set up career automation**:
   ```bash
   # Set DATABASE_URL in .env.local
   npm run db:push        # Create tables
   npm run db:seed        # Seed company registry
   ```

6. **Start the dev server**:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

### Running with MCP Server

```bash
npm run dev:all    # Starts Next.js + MCP server concurrently
```

## Project Structure

```
app/           → Pages and API routes (Next.js App Router)
components/    → React UI components
lib/           → Core business logic
  ├── ai/      → AI agents, parsers, optimizers
  ├── careers/ → ATS providers, auto-apply engine
  ├── db/      → PostgreSQL schema (Drizzle ORM)
  └── vector-db/ → LanceDB career memory
store/         → Zustand state management (12 stores)
mcp-server/    → MCP server implementation
scripts/       → Automation and CLI scripts
docs/          → Technical documentation
```

## Code Style

### General Rules
- **TypeScript strict mode** — no `any` types
- **Tailwind CSS only** — never use inline styles
- **ESLint** — run `npm run lint` before submitting
- **Imports** — use `@/` path alias (maps to project root)

### Naming Conventions
- Files: `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- Variables/functions: `camelCase`
- Types/interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

### Component Patterns
- Use functional components with hooks
- Colocate component-specific logic
- Zustand for client state, API routes for server state
- Lucide React for icons

## How to Add...

### A New ATS Provider
1. Create `lib/careers/auto-apply/providers/<provider-name>.ts`
2. Extend `BaseApplicationProvider` with `apply()` and `getFormSchema()` methods
3. Register the provider in `lib/careers/auto-apply/engine.ts`
4. Add the platform to the `career_platform` enum in `lib/db/schema.ts`

### A New Agent Tool
1. Add the tool definition to `createAgentTools()` in `lib/ai/agent/tools.ts`
2. Define the Anthropic tool schema (name, description, input_schema)
3. Implement the handler in the tool execution switch
4. Add the tool name to the `AgentToolName` type in `lib/ai/agent/types.ts`

### A New API Route
1. Create `app/api/<name>/route.ts`
2. Export async handler functions (`GET`, `POST`, etc.)
3. Follow existing patterns for error handling and response format
4. Add to the API reference in `docs/ARCHITECTURE.md`

### A New Page
1. Create `app/<name>/page.tsx`
2. Add navigation link in `components/AppNavbar.tsx`
3. Use existing layout patterns from other pages

### A New Zustand Store
1. Create `store/<name>Store.ts`
2. Follow existing patterns (create + persist middleware)
3. IndexedDB persistence is handled automatically via zustand middleware

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make your changes** and ensure lint passes:
   ```bash
   npm run lint
   ```

3. **Test manually** — there's no comprehensive test suite yet, so describe what you tested

4. **Submit a PR** using the [PR template](.github/pull_request_template.md)

5. **Include in your PR description**:
   - What you changed and why
   - What you tested
   - Any new environment variables needed
   - Screenshots for UI changes

### Commit Message Convention

Use type prefixes:
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring
- `docs:` — documentation only
- `chore:` — tooling, dependencies, configs

Example: `feat: add Workday ATS provider integration`

## Areas Where Help Is Welcome

- **Test coverage** — unit tests with Vitest, integration tests
- **New ATS providers** — Workday, iCIMS, Taleo, SmartRecruiters
- **CI/CD pipeline** — GitHub Actions for lint, build, test
- **Accessibility** — screen reader support, keyboard navigation
- **Documentation** — API examples, tutorials, video walkthroughs
- **Performance** — bundle size optimization, lazy loading

## Questions?

Open an issue with the `question` label or start a discussion. We're happy to help you get oriented in the codebase.

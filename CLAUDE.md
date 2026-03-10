# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

Key choices that affect how code is written:

- **Electron 37** + **electron-vite 5** — multi-process desktop app, not a web app
- **React 19** + **TypeScript 5.8** (strict mode)
- **Vitest 4** — test framework
- **Arco Design 2** + **UnoCSS 66** — UI and styling
- **Zod** — data validation at boundaries
- **better-sqlite3** — database

## Development Commands

```bash
# Development
bun run start              # Start dev environment
bun run webui              # Start WebUI server (remote access)
bun run webui:remote       # WebUI with remote network access

# Code Quality
bun run lint               # Run ESLint
bun run lint:fix           # Auto-fix lint issues
bun run format             # Format with Prettier

# Testing
bun run test                              # Run all tests (run before every commit)
bun run test:watch                        # Watch mode
bun run test:coverage                     # Coverage report
bun run test:integration                  # Integration tests only
vitest run tests/unit/path/to/test.ts     # Run single test file

# Build & Distribution
bun run package            # Build for production (electron-vite)
bun run dist:mac           # Build macOS installer
bun run dist:win           # Build Windows installer
bun run dist:linux         # Build Linux package

# Debug
bun run debug:mcp          # Debug MCP server connections
bun run debug:mcp:list     # List configured MCP servers
```

## Code Conventions

### Naming

- **Components**: PascalCase (`Button.tsx`, `Modal.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE
- **Unused params**: prefix with `_`

### TypeScript

- Strict mode enabled
- Use path aliases: `@/*`, `@process/*`, `@renderer/*`, `@worker/*`
- Prefer `type` over `interface` (per ESLint config)

### React

- Functional components only
- Hooks: `use*` prefix
- Event handlers: `on*` prefix
- Props type: `${ComponentName}Props`

### Styling

- UnoCSS atomic classes preferred
- CSS modules for component-specific styles: `*.module.css`
- Use Arco Design semantic colors

### Comments

- English for code comments
- JSDoc for function documentation

## Testing

**Framework**: Vitest 4 with two environments:
- `node` (default) — for main process, utilities, services
- `jsdom` — for React components (name files `*.dom.test.ts`)

**Structure**:
- `tests/unit/` — Individual functions, utilities, components
- `tests/integration/` — IPC, database, service interactions
- `tests/regression/` — Regression test cases

**Workflow**:
- Run `bun run test` before every commit
- New source files in feature areas must be added to `vitest.config.ts` → `coverage.include`

## Git Conventions

### Commit Messages

- **Language**: English
- **Format**: `<type>(<scope>): <subject>`
- **Types**: feat, fix, refactor, chore, docs, test, style, perf

Examples:

```
feat(cron): implement scheduled task system
fix(webui): correct modal z-index issue
chore: remove debug console.log statements
```

### No AI Signature (MANDATORY)

**NEVER add any AI-related signatures to commits.** This includes:

- `Co-Authored-By: Claude` or any AI attribution
- `Generated with Claude` or similar markers

This is a strict rule. Violating this will pollute the git history.

## Architecture

### Multi-Process Model

Three process types with strict API boundaries:

| Process | Location | APIs Available | Purpose |
|---------|----------|----------------|---------|
| **Main** | `src/process/` | Node.js only (no DOM) | Database, IPC handling, services |
| **Renderer** | `src/renderer/` | DOM only (no Node.js) | React UI, pages, components |
| **Worker** | `src/worker/` | Node.js only | Background AI tasks |

**Critical**: Cross-process communication must go through the IPC bridge (`src/preload.ts`).

### IPC Bridge Pattern

1. Define message types in `src/renderer/messages/`
2. Create bridge in `src/process/bridge/` (e.g., `fooBridge.ts`)
3. Register in `src/process/bridge/index.ts`
4. Call from renderer via `window.electronAPI.emit('bridgeName.methodName', args)`

### Key Directories

- `src/process/bridge/` — IPC bridges (26 bridges for different features)
- `src/process/database/` — SQLite database layer with migrations
- `src/process/services/` — Background services (cron, MCP, etc.)
- `src/agent/` — AI agent implementations (acp, codex, gemini, nanobot, openclaw)
- `src/channels/` — External channel integrations (dingtalk, lark, telegram)
- `src/renderer/pages/` — Page components
- `src/renderer/components/` — Reusable UI components

### Agent Architecture

The app supports multiple AI agents that can work in parallel:
- **ACP Agent** — Built-in agent with full capabilities
- **Codex** — OpenAI Codex CLI integration
- **Gemini** — Google Gemini CLI integration
- **Nanobot/OpenClaw** — Additional agent implementations

Workers in `src/worker/` handle agent communication as child processes.

See [docs/tech/architecture.md](docs/tech/architecture.md) for more details.

## Internationalization

When adding user-facing text or creating components with text, use the **i18n** skill. Translation files: `src/renderer/i18n/locales/*.json`.

# Plan Assistant

SvelteKit web UI + Node CLI for reviewing implementation plans in the browser with live reload.

## Plane Rules
- Taakbeheer gaat via Plane. Gebruik altijd de `mcp__plane__*` MCP tools.
- project_id: `5856874d-207a-44d6-a88e-88aa5169468d`
- State UUIDs — Todo: `ca77a67d-3eee-4705-b3aa-4faae7b92a07` | In Progress: `d780fd29-153f-47a9-9412-636e7475d537` | Done: `306d06ab-c698-4c7b-8d1e-a1bca772df19`
- Volgende taak: `mcp__plane__list_work_items` → filter op Todo/In Progress → sorteer op priority (urgent→high→medium→low).
- Taak starten: `mcp__plane__update_work_item(issue_id=..., state="d780fd29-153f-47a9-9412-636e7475d537")`.
- Taak afronden: `mcp__plane__update_work_item(issue_id=..., state="306d06ab-c698-4c7b-8d1e-a1bca772df19")`.
- Nieuwe taak: `mcp__plane__create_work_item(project_id=..., name=..., priority=..., state="ca77a67d-3eee-4705-b3aa-4faae7b92a07")`.
- Nooit `task-master` CLI aanroepen — dat is verwijderd.

## Tech Stack

- **Framework**: SvelteKit (Svelte 5 with runes), adapter-node
- **Language**: TypeScript (strict)
- **Styling**: Tailwind v4 with `@theme` block in `src/app.css`
- **Parser**: `marked` library for markdown tokenization
- **Tests**: Vitest (`npm test`)
- **Package manager**: npm

## Key Directories

- `src/cli/` — CLI entry point, commands, markdown parser
- `src/lib/components/` — Svelte components (plan/, feedback/)
- `src/lib/stores/` — Svelte 5 rune-based stores
- `src/lib/server/` — Session manager, file watcher, SSE
- `src/routes/` — SvelteKit pages and API routes
- `playgrounds/` — Standalone HTML files for design exploration

## Commands

- `npm run dev` — Dev server on port 5199
- `npm run build` — Build CLI + server
- `npm run build:cli` — CLI only (tsconfig.cli.json -> bin/)
- `npm test` — Vitest run
- `npm run check` — svelte-check + TypeScript

## Publishing

Use the `/publish` skill for versioning and releases.

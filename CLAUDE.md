# Plan Assistant

SvelteKit web UI + Node CLI for reviewing implementation plans in the browser with live reload.

## Betonning Rules

- Taakbeheer gaat via Betonning, met de `mcp__betonning__*` MCP tools. Plane
  bestaat niet meer en de `bt` CLI is verwijderd.
- Project-key: `PLANASSIST`.
- States (hoofdlettergevoelig in spelling, niet in casing): `Backlog`, `Todo`,
  `In Progress`, `Done`, `Cancelled`. `Backlog` = nog niet oppakken,
  `Todo` = mag opgepakt worden.
- Volgende taak: `list_items(project="PLANASSIST", state="Todo")` → sorteer op
  priority (urgent → high → medium → low).
- Taak starten: `set_state(ref, "In Progress")`. Afronden: `set_state(ref, "Done")`
  plus een afsluit-comment via `comment_item` (wat je deed, welke bestanden
  wijzigden, of de tests groen zijn).
- Nieuwe taak: `create_item(project="PLANASSIST", ...)`, gevolgd door
  `update_item(ref, plan_md=...)` met het werkplan — zet dat vóór er een comment
  staat, want daarna ligt het vast.
- Fallback als de MCP-server eruit ligt: de REST API op de `base_url` uit
  `~/.config/betonning/config.json`, header `Authorization: Bearer <api_key>`.

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

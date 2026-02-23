# Plan Assistant — Project Overview

## Purpose
A browser-based tool for reviewing Claude Code implementation plans. Instead of copy/pasting JSON plans, Claude Code feeds plans to a local web server which renders them with live reload.

## Tech Stack
- **Frontend**: SvelteKit 2 + Svelte 5 (runes), Tailwind CSS 4, TypeScript
- **Backend**: SvelteKit server routes (Node adapter), SSE for live updates, chokidar for file watching
- **Build**: Vite 6, pnpm workspace
- **CLI**: TypeScript compiled separately via `tsconfig.cli.json` → `dist/`, entry point `bin/cli.js`
- **Rendering**: Marked (Markdown), Mermaid (diagrams), highlight.js (code blocks)

## Architecture
- `src/cli/` — CLI entry point: parses markdown plans, generates mermaid diagrams, starts the server
- `src/lib/server/` — Server-side: session manager, file watcher, SSE manager
- `src/lib/components/` — Svelte components: plan display, feedback, approval
- `src/lib/stores/` — Svelte 5 rune-based stores for plan & feedback state
- `src/lib/types/` — TypeScript types: plan, session, feedback
- `src/routes/` — SvelteKit routes: pages + API endpoints
- `src/routes/api/` — REST API: sessions, versions, feedback, approval, SSE, health

## Repository
- GitHub: `sanderdatema/plan_assistant`
- License: MIT
- Author: Sander Datema

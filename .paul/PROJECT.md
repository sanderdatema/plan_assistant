# plan-assistant

## What This Is

A SvelteKit web UI + Node CLI that lets AI coding agents have their markdown implementation plans reviewed by humans in the browser, with live reload, per-phase feedback, and machine-readable JSON output.

## Core Value

AI coding agents kunnen gestructureerde menselijke feedback krijgen op implementatieplannen voordat ze gaan coderen, via een visuele browser-review met live reload.

## Current State

| Attribute | Value |
|-----------|-------|
| Version | 1.4.5 |
| Status | Production |
| Last Updated | 2026-03-22 |

**Published:** npm package `plan-assistant`

## Requirements

### Validated (Shipped)

- [x] Markdown parsing with flexible format support -- v1.0
- [x] Browser-based plan review UI with SSE live reload -- v1.0
- [x] Per-phase and per-element feedback with comments -- v1.0
- [x] Machine-readable JSON output + exit codes for AI agents -- v1.0
- [x] File watching with auto-update on plan changes -- v1.0
- [x] Version history and diff view -- v1.2
- [x] HTML export -- v1.3
- [x] Session management (list, clean, stop) -- v1.3
- [x] Cross-project server reuse (--reuse) -- v1.4
- [x] Idle timer with auto-shutdown -- v1.4

### Active (In Progress)

- [ ] Code quality improvements from deep review (this milestone)
- [x] Unit test coverage for all pure functions -- Phase 1 complete

### Out of Scope

- Multi-user / remote deployment -- this is a local dev tool
- Authentication / authorization -- localhost only
- Database storage -- filesystem-based sessions are sufficient

## Target Users

**Primary:** AI coding agents (Claude Code, Codex, Cursor)
- Call CLI programmatically
- Consume JSON output + exit codes
- Need blocking wait for human feedback

**Secondary:** Human developers reviewing AI plans
- Visual browser UI
- Per-phase approve/reject with comments
- Live reload when plan updates

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | SvelteKit (Svelte 5 runes) | adapter-node |
| Language | TypeScript (strict) | |
| Styling | Tailwind v4 | @theme in app.css |
| Parser | marked | Markdown tokenization |
| Tests | Vitest | npm test |
| Package manager | npm | |

## Plane

- **Project ID:** 5856874d-207a-44d6-a88e-88aa5169468d
- **Linked items:** None yet

## Key Decisions

| Decision | Rationale | Date | Status |
|----------|-----------|------|--------|
| Filesystem as integration layer | CLI writes JSON, server watches via chokidar -- loose coupling, crash-resistant | 2025 | Active |
| JSON to stdout, human text to stderr | Dual-audience CLI: machines parse stdout, humans read stderr | 2025 | Active |
| Local-only, no auth | Dev tool running on localhost -- security is not the primary concern | 2025 | Active |

---
*Created: 2026-03-22*
*Last updated: 2026-03-22 after Phase 1*

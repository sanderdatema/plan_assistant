---
phase: 07-dead-code-dedup
plan: 01
subsystem: cli
tags: [dead-code, dedup, session-guard, fetch-timeout, refactor]

requires:
  - phase: 06-test-coverage
    provides: 160 tests as safety net for refactoring
provides:
  - requireSession helpers (CLI + routes) eliminating duplicated guard patterns
  - fetchWithTimeout utility replacing 4 inline AbortController patterns
  - clean codebase with no unused exports or unreachable branches
affects: [08-type-cleanup]

tech-stack:
  added: []
  patterns:
    - requireSession pattern for CLI commands (throws CliError)
    - requireSession pattern for route handlers (throws SvelteKit error)
    - fetchWithTimeout for timed HTTP requests

key-files:
  modified:
    - src/cli/session-resolver.ts
    - src/cli/server-client.ts
    - src/lib/server/session-manager.ts
    - src/cli/commands/feedback.ts
    - src/cli/commands/export.ts
    - src/cli/commands/stop.ts
    - src/cli/commands/status.ts
    - src/routes/api/sessions/[sessionId]/+server.ts
    - src/routes/api/sessions/[sessionId]/feedback/+server.ts
    - src/routes/api/sessions/[sessionId]/versions/+server.ts
    - src/routes/api/sessions/[sessionId]/versions/[version]/+server.ts
    - src/routes/plan/[sessionId]/+page.server.ts
    - src/lib/components/plan/MarkdownBlock.svelte
    - src/lib/components/plan/IdleTimer.svelte
    - src/lib/server/idle-timer.ts
    - src/cli/markdown-parser.ts

key-decisions: []
patterns-established:
  - "CLI requireSession: resolve + guard + CliError in one call"
  - "Route requireSession: getSession + 404 in one call"
  - "fetchWithTimeout: AbortController + setTimeout + cleanup in one utility"

duration: 15min
started: 2026-03-22T15:25:00Z
completed: 2026-03-22T15:40:00Z
---

# Phase 7 Plan 01: Dead Code & Deduplication Summary

**Removed 5 dead code items, deduplicated 11 session guard blocks into 2 shared helpers, extracted fetchWithTimeout utility, and simplified getVersion.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Tasks | 2 completed |
| Files modified | 16 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Dead code removed | Pass | D1 (onMount), D2 (getPackageDir), D3 (getRemaining), D5 (H3 branch), D7 (isShutdown) |
| AC-2: CLI session guard deduped | Pass | 4 commands now use requireSession from session-resolver |
| AC-3: Route session guard deduped | Pass | 7 route handlers now use requireSession from session-manager |
| AC-4: fetchWithTimeout extracted | Pass | 4 inline patterns replaced (3 in server-client, 1 in stop.ts) |
| AC-5: getVersion uses readJsonFile | Pass | 8-line function reduced to 1 call |

## Accomplishments

- Removed 5 dead code items across components, CLI, and server
- Extracted CLI `requireSession()` — eliminates 4 duplicated resolve+guard blocks with consistent error messages
- Extracted route `requireSession()` — eliminates 7 duplicated getSession+404 blocks
- Extracted `fetchWithTimeout()` — eliminates 4 AbortController+setTimeout+clearTimeout patterns
- Simplified `getVersion` to use existing `readJsonFile` helper
- Net: -120 lines removed, +329 lines (including PAUL metadata)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Codebase clean, 160 tests passing
- Phase 8 (Type & Constant Cleanup) can proceed

**Blockers:**
- None

---
*Phase: 07-dead-code-dedup, Plan: 01*
*Completed: 2026-03-22*

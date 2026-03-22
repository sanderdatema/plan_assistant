---
phase: 02-cli-testability
plan: 01
subsystem: cli
tags: [error-handling, testability, validation, stderr]

requires:
  - phase: 01-test-foundation
    provides: exported pure functions + test safety net
provides:
  - CliError/CliExitCode pattern for testable CLI commands
  - Single process.exit() point in main()
  - Clean stdout for AI agent JSON consumption
  - SessionId validation against path traversal
affects: [03-consolidation, 04-structural-refactoring]

tech-stack:
  added: []
  patterns: [CliError throw pattern, CliExitCode for intentional exits, reject in Promise for async exits]

key-files:
  created:
    - src/cli/errors.ts
    - tests/cli-error.test.ts
  modified:
    - src/cli/index.ts
    - src/cli/commands/review.ts
    - src/cli/commands/status.ts
    - src/cli/commands/feedback.ts
    - src/cli/commands/export.ts
    - src/cli/commands/init.ts
    - src/cli/commands/clean.ts
    - src/cli/commands/stop.ts
    - src/cli/server-client.ts
    - src/cli/session-reader.ts
    - src/lib/server/session-manager.ts

key-decisions:
  - "SIGINT handlers keep process.exit(0) — need immediate termination"
  - "CliExitCode is not an Error — intentional exits are not errors"
  - "Promise reject for async exit codes in file-watcher callbacks"

patterns-established:
  - "CliError for error exits, CliExitCode for intentional non-error exits"
  - "main() is the single process.exit() point for the entire CLI"
  - "All human-readable output to stderr, JSON to stdout"

duration: ~15min
completed: 2026-03-22T00:00:00Z
---

# Phase 2 Plan 01: CLI Testability Refactor Summary

**CliError pattern replaces 28 process.exit() calls, launchServer output moved to stderr, sessionId validated — 120 tests passing.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Tasks | 3 completed |
| Files modified | 13 (2 new + 11 changed) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: CliError with exitCode | Pass | CliError extends Error, caught in main() |
| AC-2: CliExitCode for intentional exits | Pass | Not an Error, silent exit in main() |
| AC-3: No process.exit() outside main | Pass | Only SIGINT handlers + main() remain |
| AC-4: launchServer stderr not stdout | Pass | process.stderr.write + console.error |
| AC-5: SessionId validation | Pass | /^[a-f0-9]{1,16}$/ in getSessionDir() |
| AC-6: Existing tests pass | Pass | 9 files, 120 tests, 0 failures |

## Accomplishments

- Created CliError/CliExitCode classes in src/cli/errors.ts
- Replaced 28 process.exit() calls across 10 files with throw patterns
- Fixed stdout pollution in launchServer (AI agents get clean JSON now)
- Added sessionId validation preventing path traversal in session-manager.ts
- 16 new tests for CliError, CliExitCode, and validateSessionId

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/cli/errors.ts` | Created | CliError + CliExitCode classes |
| `tests/cli-error.test.ts` | Created | Tests for errors + sessionId validation |
| `src/cli/index.ts` | Modified | main() as single exit point with try/catch |
| `src/cli/commands/review.ts` | Modified | 6 process.exit → CliError throws |
| `src/cli/commands/status.ts` | Modified | 7 process.exit → CliError/CliExitCode throws |
| `src/cli/commands/feedback.ts` | Modified | 3 process.exit → CliError throws |
| `src/cli/commands/export.ts` | Modified | 3 process.exit → CliError throws |
| `src/cli/commands/init.ts` | Modified | 1 process.exit → CliError throw |
| `src/cli/commands/clean.ts` | Modified | 2 process.exit → CliError/CliExitCode throws |
| `src/cli/commands/stop.ts` | Modified | 1 process.exit → CliError throw |
| `src/cli/server-client.ts` | Modified | process.exit → throw Error, stdout → stderr |
| `src/cli/session-reader.ts` | Modified | process.exit → CliExitCode throw |
| `src/lib/server/session-manager.ts` | Modified | validateSessionId added to getSessionDir |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| SIGINT handlers keep process.exit(0) | Signal handlers need immediate termination, can't rely on throw propagation | 2 locations exempt from the pattern |
| CliExitCode is not an Error subclass | Intentional exits (status code 3 = needs-work) are not errors | Cleaner separation in main() catch |
| Promise reject for async watchers | Throws don't propagate from callbacks inside Promises | Used reject(new CliExitCode()) in status.ts watcher |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | None — server-client.ts startServer used throw Error instead of CliError (server-side, not CLI) |

**Total impact:** Minimal. Plan executed as written.

## Next Phase Readiness

**Ready:**
- All CLI commands are now testable without process.exit()
- Integration tests can import and call command functions directly
- SessionId is validated at the server boundary
- stdout is clean for AI agent consumption

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 02-cli-testability, Plan: 01*
*Completed: 2026-03-22*

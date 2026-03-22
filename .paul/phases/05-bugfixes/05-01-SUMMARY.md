---
phase: 05-bugfixes
plan: 01
subsystem: cli
tags: [bugfix, session, diff, idle-timer, promise]

requires:
  - phase: 04-structural-refactoring
    provides: stable codebase with 120 passing tests
provides:
  - 6 bug fixes for CLI reliability and data integrity
  - subItems included in version diffs
  - clean type surface (additionalSections removed)
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/cli/commands/stop.ts
    - src/cli/server-client.ts
    - src/cli/session-reader.ts
    - src/cli/commands/status.ts
    - src/lib/utils/diff.ts
    - src/lib/server/idle-timer.ts
    - src/lib/types/plan.ts
    - src/cli/markdown-to-plan.ts
    - tests/diff.test.ts

key-decisions:
  - "Remove additionalSections rather than render — dead code removal over feature creep"

patterns-established: []

duration: 15min
started: 2026-03-22T14:19:00Z
completed: 2026-03-22T14:35:00Z
---

# Phase 5 Plan 01: Bug Fixes Summary

**Fixed 6 bugs from codebase health scan: stale lock files, SIGINT handler leak, promise semantics, missing subItems in diffs, dead additionalSections code, and lying idle timer log.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Started | 2026-03-22T14:19Z |
| Completed | 2026-03-22T14:35Z |
| Tasks | 3 completed |
| Files modified | 9 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: stop command clears lock files | Pass | `clearLock()` called in port-scan path after shutdown/SIGTERM |
| AC-2: SIGINT handler does not leak | Pass | Named handler registered and removed via `process.removeListener` on cleanup |
| AC-3: pollFeedbackStatus correct promise semantics | Pass | Changed from `reject(CliExitCode)` to `resolve(exitCode)`, caller throws |
| AC-4: subItems included in version diffs | Pass | Added to `phaseToString` serialization, new test confirms detection |
| AC-5: additionalSections resolved | Pass | Removed dead parsing code and type field |
| AC-6: idle timer log derives from constant | Pass | Log message now computes minutes from `IDLE_TIMEOUT_MS` |

## Accomplishments

- Fixed lock file leak in `stop` command's port-scan path (B1)
- Eliminated SIGINT handler accumulation with proper cleanup function (B2)
- Corrected promise semantics: `resolve(exitCode)` instead of `reject(CliExitCode)` (B3)
- SubItem changes now visible in version diffs (B4)
- Removed 45 lines of dead `additionalSections` parsing code + cleaned unused type imports (B5)
- Idle timer log message now derives from the `IDLE_TIMEOUT_MS` constant (B6)

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/cli/commands/stop.ts` | Modified | B1: Import and call `clearLock()` in port-scan shutdown path |
| `src/cli/server-client.ts` | Modified | Export `clearLock` (was private) |
| `src/cli/session-reader.ts` | Modified | B2: Named SIGINT handler with cleanup function, replace `process.exit(0)` with `CliExitCode(0)` |
| `src/cli/commands/status.ts` | Modified | B3: `pollFeedbackStatus` returns `Promise<number>`, caller throws `CliExitCode` |
| `src/lib/utils/diff.ts` | Modified | B4: Include `subItems` in `phaseToString` serialization |
| `src/lib/server/idle-timer.ts` | Modified | B6: Compute minutes from constant for log message |
| `src/lib/types/plan.ts` | Modified | B5: Remove `additionalSections` field from `PlanJson` |
| `src/cli/markdown-to-plan.ts` | Modified | B5: Remove additionalSections parsing code + unused type imports |
| `tests/diff.test.ts` | Modified | New test: detects changed subItems within a phase |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Remove additionalSections (not render) | Dead code since v1.0; no user has reported missing sections; adding rendering would be scope creep | Clean type surface, 45 fewer lines |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- All 6 bugs fixed, 121 tests passing, build clean
- v1.5.1 milestone ready for release

**Concerns:**
- `review.ts:197` still uses `process.exit(0)` in --no-wait SIGINT handler (deferred to v1.6.0)

**Blockers:**
- None

---
*Phase: 05-bugfixes, Plan: 01*
*Completed: 2026-03-22*

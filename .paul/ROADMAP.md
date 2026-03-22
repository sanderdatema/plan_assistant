# Roadmap: plan-assistant

## Overview

Implement the recommendations from a deep 9-analyst code review. Focus on code quality, testability, and structural improvements. Not security-focused (local-only tool).

## Current Milestone

**v1.5.0 Code Quality** (v1.5.0)
Status: Complete
Phases: 4 of 4 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Test Foundation | 1 | Complete | 2026-03-22 |
| 2 | CLI Testability Refactor | 1 | Complete | 2026-03-22 |
| 3 | Consolidation & Cleanup | 2 | Complete | 2026-03-22 |
| 4 | Structural Refactoring | 1 | Complete | 2026-03-22 |

## Phase Details

### Phase 1: Test Foundation

**Goal:** Write tests for all untested pure functions to establish a safety net before refactoring.
**Depends on:** Nothing (first phase)
**Research:** Unlikely (established Vitest patterns)

**Scope:**
- Tests for `parseDuration` (src/cli/utils.ts)
- Tests for `diffPlans` (src/lib/utils/diff.ts)
- Tests for `computeStatus` + `computeSummary` (src/cli/commands/status.ts -- export first)
- Tests for `generatePhaseFlowDiagram` (src/cli/mermaid-gen.ts)
- Tests for `escapeHtml` (src/cli/export-html.ts)
- Tests for `parseArgs` (src/cli/index.ts)
- Tests for `statusLabel` + `statusBadgeClass` (src/lib/utils/status.ts)
- Tests for `sessionIdFromPath` (if not already covered)

**Plans:**
- [x] 01-01: Export private pure functions and write unit tests

### Phase 2: CLI Testability Refactor

**Goal:** Replace process.exit() with throwable errors and fix stdout pollution, enabling integration tests.
**Depends on:** Phase 1 (tests as safety net)
**Research:** Unlikely (standard pattern)

**Scope:**
- Create CliError class with exit code
- Replace process.exit() in all CLI commands with throw CliError
- Single process.exit() in src/cli/index.ts main()
- Fix launchServer stdout -> stderr ("Starting..." message)
- Add sessionId validation (/^[a-f0-9]{8}$/)

**Plans:**
- [x] 02-01: CliError pattern + process.exit() removal + stdout fix + sessionId validation

### Phase 3: Consolidation & Cleanup

**Goal:** Eliminate duplication and consolidate divergent implementations.
**Depends on:** Phase 2 (testable CLI)
**Research:** Unlikely (internal refactoring)

**Scope:**
- Merge two waitForFeedback implementations into one with options
- Consolidate session I/O (session-reader.ts + session-manager.ts -> shared module)
- Unify KNOWN_SECTION_PATTERNS (single source of truth)
- Remove redundant approve endpoint
- Export exit code constants from shared location

**Plans:**
- [x] 03-01: Unify patterns, remove approve endpoint, share exit codes
- [x] 03-02: Consolidate session I/O, rename waitForFeedback

### Phase 4: Structural Refactoring

**Goal:** Break up god-functions into testable, single-responsibility modules.
**Depends on:** Phase 3 (clean foundation)
**Research:** Unlikely (internal restructuring)

**Scope:**
- Split review.ts into: session setup, server lifecycle, file watching, feedback polling
- Split parsePhases into: heading detection, content extraction, criteria parsing
- Add integration tests for the refactored modules

**Plans:**
- [x] 04-01: Refactor review.ts + parsePhases (combined into single plan)

## Next Milestone

**v1.5.1 Bug Fixes** (v1.5.1)
Status: Complete
Phases: 1 of 1

## v1.5.1 Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 5 | Bug Fixes | 1 | Complete | 2026-03-22 |

### Phase 5: Bug Fixes

**Goal:** Fix 6 bugs found during codebase health scan.
**Depends on:** Nothing (v1.5.0 complete)
**Research:** None

**Scope:**
- B1: stop command doesn't call clearLock() — stale lock files
- B2: SIGINT handler leak in awaitReviewFeedback
- B3: pollFeedbackStatus uses reject() for success path
- B4: phaseToString omits subItems in version diffs
- B5: additionalSections parsed but never rendered (remove dead code)
- B6: idle timer log hardcodes "5 minutes" independent of constant

**Plans:**
- [x] 05-01: Fix all 6 bugs (single plan, all independent fixes)

## Next Milestone

**v1.6.0 Refactoring & Test Coverage** (v1.6.0)
Status: Complete
Phases: 3 of 3 complete

## v1.6.0 Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 6 | Test Coverage | 1 | Complete | 2026-03-22 |
| 7 | Dead Code & Deduplication | 1 | Complete | 2026-03-22 |
| 8 | Type & Constant Cleanup | 1 | Complete | 2026-03-22 |

### Phase 6: Test Coverage

**Goal:** Add tests for untested modules to create a safety net before refactoring.
**Depends on:** Nothing (first phase of milestone)
**Plane items:** PA-62, PA-63, PA-64, PA-65, PA-66

**Scope:**
- Tests for session-manager.ts core persistence functions (PA-62)
- Tests for session-resolver.ts (PA-63)
- Tests for renderPlanToHtml in export-html.ts (PA-64)
- Tests for clean command session filtering logic (PA-65)
- Fix vitest config to include colocated test files (PA-66)

### Phase 7: Dead Code & Deduplication

**Goal:** Remove dead code, deduplicate patterns, and consolidate shared helpers.
**Depends on:** Phase 6 (tests as safety net)
**Plane items:** PA-56, PA-57, PA-58, PA-61

**Scope:**
- Remove dead code: unused imports, exports, unreachable branches (PA-56)
- Deduplicate session guard pattern in routes and CLI commands (PA-57)
- Extract fetchWithTimeout helper (PA-58)
- Use readJsonFile in getVersion (PA-61)

### Phase 8: Type & Constant Cleanup

**Goal:** Consolidate magic numbers and use consistent types.
**Depends on:** Phase 7 (clean foundation)
**Plane items:** PA-59, PA-60

**Scope:**
- Consolidate magic numbers into named constants (PA-59)
- Use PhaseStatus type consistently instead of inline string unions (PA-60)

---
*Roadmap created: 2026-03-22*

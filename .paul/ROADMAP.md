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

---
*Roadmap created: 2026-03-22*

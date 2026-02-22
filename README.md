# Plan Assistant

Review implementation plans in the browser with live reload. Designed for AI coding assistants (Claude Code, Cursor, Codex, and others) that write markdown plans.

## Quick Start

```bash
npx plan-assistant@alpha review path/to/plan.md
```

This will:
1. Parse the markdown into a structured plan with phases, changes, and success criteria
2. Start a local review server (port 5181+)
3. Open the browser to the plan review page
4. Watch the markdown file for changes and auto-update the browser

## CLI Commands

| Command | Description |
|---------|-------------|
| `plan-assistant review <file>` | Parse and open plan for review |
| `plan-assistant status <file-or-id>` | Check review status (exit codes: 0=approved, 3=needs-work, 4=reviewing, 5=no feedback) |
| `plan-assistant feedback <file-or-id>` | Output feedback JSON |
| `plan-assistant list` | List all sessions |
| `plan-assistant init` | Generate a plan template |
| `plan-assistant clean` | Remove orphaned sessions |
| `plan-assistant export <file-or-id>` | Export as self-contained HTML |
| `plan-assistant help` | Show help |

### Common flags

- `--pretty` — Human-readable output (default: JSON for AI parsing)
- `--port <N>` — Specific port for review server
- `--wait` — Block until feedback is submitted (status command)
- `--unresolved` — Only show unresolved comments (feedback command)
- `--phase <id>` — Filter to a specific phase (feedback command)
- `--dry-run` — Preview what would be removed (clean command)
- `--output <file>` — Write to file instead of stdout (init, export commands)

## Features

- **Markdown parsing** — extracts phases, changes, success criteria, testing strategy, and more
- **Flexible format** — accepts variations from Claude Code, Cursor, Codex, and other AI tools
- **Syntax highlighting** — code blocks rendered with highlight.js (github-dark theme)
- **Mermaid diagrams** — auto-generated phase flow diagrams
- **Live reload** — edit the markdown file, browser updates instantly via SSE
- **Inline feedback** — select text to add comments, set phase statuses
- **Version history** — automatic snapshots on each update with diff view
- **Machine-readable output** — all commands output JSON by default
- **HTML export** — generate self-contained HTML reports for sharing
- **Accessible** — keyboard navigation, ARIA attributes, screen reader support

## Integration with AI Coding Assistants

### Workflow

The AI integration workflow is the same regardless of which tool you use:

```
1. AI writes plan markdown (use `npx plan-assistant init` for template)
2. AI runs `npx plan-assistant review plan.md` (opens browser)
3. User reviews, comments, approves/rejects in the browser
4. AI runs `npx plan-assistant status plan.md` (check status + exit code)
5. AI runs `npx plan-assistant feedback plan.md` (read feedback)
6. If needs-work: update plan, goto 2. If approved: implement.
```

The `review` command outputs a JSON line when the server is ready:

```json
{"event":"ready","sessionId":"a1b2c3d4","url":"http://localhost:5183/plan/a1b2c3d4","feedbackPath":"/abs/.plan-sessions/a1b2c3d4/feedback.json"}
```

The `status` command uses **distinct exit codes** so shell scripts can branch without parsing JSON:
- `0` = approved
- `3` = needs-work
- `4` = still reviewing
- `5` = no feedback yet

### Claude Code

Add to your project's `CLAUDE.md` or `~/.claude/CLAUDE.md`:

```markdown
## Plan Review

When creating implementation plans, use Plan Assistant for review:
1. Write the plan as markdown
2. Run `npx plan-assistant review <plan-file>` in the background
3. Tell the user to review the plan in the browser
4. After they submit feedback, run `npx plan-assistant status <plan-file>`
5. If exit code is 3 (needs-work), run `npx plan-assistant feedback <plan-file>` to read comments
6. Update the plan based on feedback and repeat
7. If exit code is 0 (approved), proceed with implementation
```

Optionally, create a slash command at `.claude/commands/review_plan.md`:

````markdown
---
description: Review a plan in the browser
---

Run `npx plan-assistant review $ARGUMENTS` in the background.

Tell the user to review the plan in the browser. When they've submitted feedback, run:
- `npx plan-assistant status $ARGUMENTS` to check the result
- `npx plan-assistant feedback $ARGUMENTS --unresolved` to read unresolved comments

If `status` exits with code 3, update the plan based on feedback.
If `status` exits with code 0, proceed with implementation.
````

### Cursor

Add to your `.cursor/rules/plan-review.mdc` or `.cursorrules`:

```markdown
## Plan Review Workflow

When creating implementation plans:
1. Write the plan as a markdown file
2. Run: `npx plan-assistant review <plan-file>`
3. Ask the user to review in the browser
4. Check status: `npx plan-assistant status <plan-file>`
   - Exit code 0 = approved, proceed with implementation
   - Exit code 3 = needs work, read feedback and update plan
5. Read feedback: `npx plan-assistant feedback <plan-file> --unresolved`
6. Update the plan and repeat until approved
```

### Codex

Add to your `codex.md` or `AGENTS.md`:

```markdown
## Plan Review

For implementation plans, use Plan Assistant for human review:
- Generate plan template: `npx plan-assistant init --output plan.md`
- Open for review: `npx plan-assistant review plan.md`
- Check status: `npx plan-assistant status plan.md` (exit code 0=approved, 3=needs-work)
- Read feedback: `npx plan-assistant feedback plan.md --unresolved`
- Update plan based on feedback, repeat until approved
```

### Generic (any AI tool)

Add this to your AI tool's instruction file:

```markdown
## Plan Review

Use Plan Assistant (`npx plan-assistant`) for human review of implementation plans:

Commands:
- `npx plan-assistant init --output plan.md` — generate template
- `npx plan-assistant review plan.md` — open in browser for review
- `npx plan-assistant status plan.md` — check status (exit 0=approved, 3=needs-work, 4=reviewing)
- `npx plan-assistant feedback plan.md` — read structured feedback JSON
- `npx plan-assistant feedback plan.md --unresolved` — only unresolved comments

Workflow: write plan → review → check status → read feedback → update → repeat until approved.
```

## Plan Markdown Format

Plan Assistant parses markdown with this structure. All sections are optional except a title and at least one phase.

```markdown
# Feature Name Implementation Plan

## Overview
What we're building and why.

## Current State
What exists now.

### Key Discoveries
- Finding with `file:line` reference

## What We're NOT Doing
- Out of scope item -- reason

## Implementation Approach
High-level strategy.

## Phase 1: Descriptive Name

### Overview
What this phase accomplishes.

### Changes Required:

#### 1. Component Name
**File**: `path/to/file.ext`

Description of changes.

### Success Criteria:

#### Automated Verification:
- [ ] Tests pass: `npm test`

#### Manual Verification:
- [ ] Feature works in the UI

## Testing Strategy

### Unit Tests
- What to test

### Integration Tests
- End-to-end scenarios

## References
- Related file: `path/to/file.ext`
```

### Format Flexibility

The parser accepts common variations with warnings:
- **Phase headings**: `Phase 1: Name`, `Phase 1 - Name`, `Step 1: Name`, `Task 1: Name`, or unnumbered H2s
- **Changes section**: `Changes Required`, `Changes`, `File Changes`, `Modifications`
- **File paths**: `**File**: \`path\``, `**Path**: \`path\``, `File: \`path\``
- **List-based changes**: `- **path/to/file**: description`
- **Success criteria**: `Success Criteria`, `Criteria`, `Verification`

Use `npx plan-assistant init` to generate a template with all recognized sections.

## Session Files

Sessions are created in `.plan-sessions/` next to the markdown file:

```
project/
  plan.md
  .plan-sessions/
    a1b2c3d4/
      meta.json       # Session metadata
      plan.json       # Parsed plan (structured JSON)
      feedback.json   # Review comments and phase statuses
      versions/
        v1.json       # Snapshot of each plan version
```

Add `.plan-sessions/` to your `.gitignore`.

## Development

```bash
npm install
npm run dev        # SvelteKit dev server on port 5199
npm run build      # Build CLI + server
npm test           # Run parser tests
npm run check      # Type check
```

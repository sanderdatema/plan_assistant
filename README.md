# Plan Assistant

Review implementation plans in the browser with live reload. Designed for AI coding assistants like Claude Code that write markdown plans.

## Usage

```bash
npx plan-assistant@alpha review path/to/plan.md
```

This will:
1. Parse the markdown into a structured plan with phases, changes, and success criteria
2. Start a local review server (port 5181+)
3. Open the browser to the plan review page
4. Watch the markdown file for changes and auto-update the browser

## Features

- **Markdown parsing** — extracts phases, changes, success criteria, testing strategy, and more
- **Syntax highlighting** — code blocks rendered with highlight.js (github-dark theme)
- **Mermaid diagrams** — auto-generated phase flow diagrams
- **Live reload** — edit the markdown file, browser updates instantly via SSE
- **Inline feedback** — select text to add comments, set phase statuses
- **Version history** — automatic snapshots on each update with diff view
- **Feedback file** — submit feedback in the browser, AI reads it from `feedback.json`

## Plan markdown format

Plan Assistant parses markdown with this structure:

```markdown
# Feature Name Implementation Plan

## Overview
What we're building and why.

## Current State Analysis
What exists now.

### Key Discoveries:
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

```language
// code snippet
```

### Success Criteria:

#### Automated Verification:
- [ ] Tests pass: `npm test`

#### Manual Verification:
- [ ] Feature works in the UI

## Testing Strategy

### Unit Tests:
- What to test

### Integration Tests:
- End-to-end scenarios

### Manual Testing Steps:
1. Step to verify

## References
- Related file: `path/to/file.ext`
```

## Integration with Claude Code

### Setup

1. Install in your project:
   ```bash
   npm install -D plan-assistant@alpha
   ```

2. Add a `/review_plan` command to your project or global Claude Code config. Create `.claude/commands/review_plan.md`:

   ````markdown
   ---
   description: Review a plan in the browser
   ---

   Run `npx plan-assistant review $ARGUMENTS` in the background.

   The Plan Assistant parses the markdown into a structured view and opens the browser. It watches for file changes and auto-updates.

   Tell the user:
   - Review the plan in the browser
   - Add inline comments by selecting text
   - Set phase statuses (Pending / Approved / Needs Work)
   - Click "Submit Feedback" when done

   When the user says they've submitted feedback, read the feedback file at `.plan-sessions/<session-id>/feedback.json` next to the markdown file. The session ID is shown in the CLI output.

   If `status` is `"approved"`, proceed with implementation.
   If `status` is `"needs-work"`, apply the comments from the `comments[]` array as changes to the markdown plan. The file watcher will auto-update the browser.
   ````

3. After writing a plan, run:
   ```
   /review_plan thoughts/shared/plans/my-plan.md
   ```

### Feedback loop

The workflow is:

1. AI writes a plan as markdown
2. `npx plan-assistant review` opens it in the browser
3. You review, comment, and submit feedback
4. AI reads `feedback.json` and updates the markdown
5. Browser auto-updates (file watcher + SSE)
6. Repeat until approved

## Session files

Sessions are created in `.plan-sessions/` next to the markdown file:

```
thoughts/shared/plans/
  my-plan.md
  .plan-sessions/
    a1b2c3d4/
      meta.json       # Session metadata
      plan.json       # Parsed plan (structured JSON)
      feedback.json   # Your review comments and phase statuses
      versions/
        v1.json       # Snapshot of each plan version
```

Add `.plan-sessions/` to your `.gitignore`.

## Development

```bash
pnpm install
pnpm run dev        # SvelteKit dev server on port 5199
pnpm run build      # Build CLI + server
```

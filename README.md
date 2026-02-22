# Plan Assistant

Review implementation plans in the browser with live reload.

## Usage

```bash
npx plan-assistant review path/to/plan.md
```

This will:
1. Parse the markdown into a structured plan
2. Start a local review server
3. Open the browser to the plan review page
4. Watch the markdown file for changes and auto-update

## Features

- **Markdown parsing** — extracts phases, changes, success criteria, and more from plan markdown
- **Syntax highlighting** — code blocks rendered with highlight.js (github-dark theme)
- **Mermaid diagrams** — auto-generated phase flow diagrams
- **Live reload** — edit the markdown, browser updates via SSE
- **Inline feedback** — select text to add comments, set phase statuses
- **Version history** — snapshots on each update with diff view

## Integration with Claude Code

The `/create_plan` skill automatically runs `npx plan-assistant review` after writing a plan. Feedback submitted in the browser is written to `.plan-sessions/<id>/feedback.json` which Claude reads to iterate on the plan.

## Session files

Sessions are created next to the markdown file:

```
thoughts/shared/plans/
  my-plan.md
  .plan-sessions/
    a1b2c3d4/
      meta.json
      plan.json
      feedback.json
      versions/
        v1.json
```

## Development

```bash
pnpm install
pnpm run dev        # SvelteKit dev server on port 5199
pnpm run build      # Build CLI + server
```

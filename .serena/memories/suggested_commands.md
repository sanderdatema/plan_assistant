# Suggested Commands

## Development
```bash
pnpm dev              # Start dev server on port 5199
pnpm build            # Build both CLI and server
pnpm build:cli        # Build CLI only (tsc -p tsconfig.cli.json)
pnpm build:server     # Build SvelteKit server (vite build)
pnpm preview          # Preview production build on port 5199
pnpm check            # Type-check with svelte-check
```

## Running the CLI
```bash
node bin/cli.js <args>    # Run CLI locally (after build)
plan-assistant <args>     # Run globally after npm install -g
```

## System Commands (macOS / Darwin)
```bash
git status / git diff / git log   # Git operations
ls / find / grep                  # File navigation
open .                            # Open Finder
```

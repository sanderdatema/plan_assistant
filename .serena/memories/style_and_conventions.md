# Code Style & Conventions

## TypeScript
- Strict mode enabled (`"strict": true`)
- ES modules (`"type": "module"` in package.json)
- Module resolution: `bundler`
- Separate tsconfig for CLI (`tsconfig.cli.json`) and SvelteKit (`tsconfig.json`)

## Svelte
- Svelte 5 with runes (`.svelte.ts` stores)
- SvelteKit 2 with Node adapter
- Components organized under `src/lib/components/` by feature (plan/, feedback/)

## CSS
- Tailwind CSS 4 via Vite plugin (`@tailwindcss/vite`)

## Naming
- Files: kebab-case for utilities, PascalCase for Svelte components
- TypeScript: standard TS conventions (camelCase variables/functions, PascalCase types/interfaces)

## Versioning
- Alpha versioning during development (e.g. `1.0.1-alpha.1`)
- Semver: patch for fixes, minor for features, major for breaking changes
- Publishing via GitHub Actions with npm Trusted Publishing (OIDC)

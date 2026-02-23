# Task Completion Checklist

After completing a task, run the following:

1. **Type check**: `pnpm check` — runs svelte-check for type errors
2. **Build**: `pnpm build` — ensures both CLI and server build correctly
3. **Test locally**: `pnpm dev` and verify in browser at http://localhost:5199
4. **Commit**: commit locally, do NOT push unless user explicitly requests it
5. **Version bump**: if publishing, bump alpha version in package.json

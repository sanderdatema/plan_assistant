---
name: publish
description: Version bumping and publishing workflow for plan-assistant. Handles alpha versioning, stable releases, npm trusted publishing via GitHub Actions.
---

# Publish Plan Assistant

## Versioning

Check the current version in `package.json` and pick the next unreleased version with an `-alpha.N` suffix. Increment the alpha build number on each push (e.g. `alpha.1` -> `alpha.2`). Include the version bump in the same push.

Follow semver strictly:
- **Patch** (1.2.x): bug fixes only — no new features, no UI changes
- **Minor** (1.x.0): new features, UI improvements, behavior changes
- **Major** (x.0.0): breaking changes to the CLI interface or plan JSON schema

If the alpha series started as a patch but new features were added, bump to the next minor for the stable release. Semver ordering handles this fine (e.g. `1.0.1-alpha.5 < 1.1.0`).

## Workflow

1. Run `npm test` and `npm run check` to verify everything passes
2. Bump the version in `package.json` using `npm version <new-version> --no-git-tag-version`
3. Commit with a message like `Bump to <version>`
4. **Do not push or publish unless the user explicitly asks.** Wait for "push", "release", or similar.

## Stable Release

When the user asks for a stable release:
1. Drop the alpha suffix from the version
2. Commit, tag (`git tag v<version>`), and push (including tag)

## How Publishing Works

Publishing happens via GitHub Actions (`.github/workflows/publish.yml`):
- **Alpha**: Every push to `main` automatically publishes with `--tag alpha` dist-tag. Can also be triggered manually via Actions > "Publish to npm" > "Run workflow".
- **Stable**: Push a `v*` tag (e.g. `git tag v1.0.0 && git push origin v1.0.0`). Publishes with the default `latest` dist-tag.

Authentication uses npm Trusted Publishing (OIDC) — no secrets needed. Trusted publishing must be configured on npmjs.com for the `plan-assistant` package.

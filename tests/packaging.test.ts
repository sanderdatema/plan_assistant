import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guards against the v1.6.1 regression: a CLI-reachable module imported
 * @sveltejs/kit (a devDependency), so `npm install plan-assistant` shipped
 * a CLI that crashed with "Cannot find package '@sveltejs/kit'". tsc pulls
 * in any file reachable from the CLI entry points regardless of which
 * tsconfig "include" glob it matches, so this walks the same transitive
 * import graph tsc does and checks every bare import is a real dependency.
 */

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(projectRoot, "src");

const entryFiles = [
  join(srcRoot, "cli", "index.ts"),
  ...listCommandFiles(),
];

function listCommandFiles(): string[] {
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  const dir = join(srcRoot, "cli", "commands");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(dir, f));
}

function collectTransitiveFiles(entries: string[]): Set<string> {
  const visited = new Set<string>();
  const queue = [...entries];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const content = readFileSync(file, "utf-8");
    for (const specifier of extractImportSpecifiers(content)) {
      if (!specifier.startsWith(".")) continue; // only follow relative imports
      const resolved = resolveRelativeImport(dirname(file), specifier);
      if (resolved) queue.push(resolved);
    }
  }

  return visited;
}

function extractImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g,
    /import\(["']([^"']+)["']\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function resolveRelativeImport(fromDir: string, specifier: string): string | null {
  const withoutExt = specifier.replace(/\.js$/, "");
  const asTs = resolve(fromDir, `${withoutExt}.ts`);
  try {
    readFileSync(asTs, "utf-8");
    return asTs;
  } catch {
    return null;
  }
}

function bareImportPackageName(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("node:")) return null;
  if (specifier.includes("://")) return null; // e.g. CDN imports inside an embedded HTML template
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

describe("CLI packaging", () => {
  it("only imports packages listed in dependencies (not devDependencies)", () => {
    const pkg = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf-8"),
    ) as { dependencies?: Record<string, string> };
    const dependencies = new Set(Object.keys(pkg.dependencies ?? {}));

    const files = collectTransitiveFiles(entryFiles);
    const missing: { file: string; pkg: string }[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      for (const specifier of extractImportSpecifiers(content)) {
        const pkgName = bareImportPackageName(specifier);
        if (pkgName && !dependencies.has(pkgName)) {
          missing.push({ file, pkg: pkgName });
        }
      }
    }

    expect(missing).toEqual([]);
  });
});

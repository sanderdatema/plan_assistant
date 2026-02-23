import { existsSync, mkdirSync } from "node:fs";

export function parseDuration(s: string): number | null {
  const match = s.match(/^(\d+)(ms|s|m|h|d|w)$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case "ms": return n;
    case "s": return n * 1000;
    case "m": return n * 60 * 1000;
    case "h": return n * 3600 * 1000;
    case "d": return n * 86400 * 1000;
    case "w": return n * 7 * 86400 * 1000;
    default: return null;
  }
}

export function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

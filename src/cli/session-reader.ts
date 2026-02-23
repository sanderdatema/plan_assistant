/**
 * Pure filesystem functions for reading session data from disk.
 * CLI-side equivalent of the server's session-manager.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import type {
  SessionMeta,
  FeedbackPayload,
  PlanJson,
} from "../lib/types/index.js";

export function readMeta(sessionDir: string): SessionMeta | null {
  const path = join(sessionDir, "meta.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as SessionMeta;
  } catch {
    return null;
  }
}

export function readFeedback(sessionDir: string): FeedbackPayload | null {
  const path = join(sessionDir, "feedback.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as FeedbackPayload;
  } catch {
    return null;
  }
}

export function readPlan(sessionDir: string): PlanJson | null {
  const path = join(sessionDir, "plan.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as PlanJson;
  } catch {
    return null;
  }
}

export interface SessionEntry {
  sessionId: string;
  sessionDir: string;
  meta: SessionMeta;
}

/**
 * Find all session directories under .plan-sessions/ in the given directory
 * and all parent directories.
 */
export function findSessionDirs(startDir: string): SessionEntry[] {
  const entries: SessionEntry[] = [];
  const seen = new Set<string>();
  let dir = startDir;

  while (true) {
    const sessionsRoot = join(dir, ".plan-sessions");
    if (existsSync(sessionsRoot)) {
      try {
        const subdirs = readdirSync(sessionsRoot);
        for (const name of subdirs) {
          if (seen.has(name)) continue;
          const sessionDir = join(sessionsRoot, name);
          try {
            if (!statSync(sessionDir).isDirectory()) continue;
          } catch {
            continue;
          }
          const meta = readMeta(sessionDir);
          if (meta) {
            seen.add(name);
            entries.push({ sessionId: name, sessionDir, meta });
          }
        }
      } catch {
        // ignore unreadable directories
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Sort by updatedAt descending
  entries.sort(
    (a, b) =>
      new Date(b.meta.updatedAt).getTime() -
      new Date(a.meta.updatedAt).getTime(),
  );

  return entries;
}

/**
 * Resolves a <session-id-or-file> argument to a session directory.
 *
 * Two strategies:
 * 1. File path: derive session ID via sessionIdFromPath(), find .plan-sessions/<id>/
 * 2. Session ID (8 hex chars): scan .plan-sessions/ from cwd upward
 */

import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { sessionIdFromPath } from "./markdown-to-plan.js";

export interface ResolvedSession {
  sessionId: string;
  sessionDir: string;
  markdownPath?: string;
}

const SESSION_ID_PATTERN = /^[0-9a-f]{8}$/i;

export function resolveSession(idOrFile: string): ResolvedSession | null {
  // Strategy 1: File path
  if (!SESSION_ID_PATTERN.test(idOrFile)) {
    const absolutePath = resolve(idOrFile);
    if (!existsSync(absolutePath)) return null;

    const sessionId = sessionIdFromPath(absolutePath);
    const sessionDir = join(dirname(absolutePath), ".plan-sessions", sessionId);

    if (!existsSync(sessionDir)) return null;

    return { sessionId, sessionDir, markdownPath: absolutePath };
  }

  // Strategy 2: Session ID — scan .plan-sessions/ from cwd upward
  const sessionId = idOrFile.toLowerCase();
  let dir = process.cwd();

  while (true) {
    const candidate = join(dir, ".plan-sessions", sessionId);
    if (existsSync(candidate)) {
      return { sessionId, sessionDir: candidate };
    }

    const parent = dirname(dir);
    if (parent === dir) break; // reached root
    dir = parent;
  }

  return null;
}

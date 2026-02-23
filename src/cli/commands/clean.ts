import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { findSessionDirs } from "../session-reader.js";
import { outputJson, outputError } from "../output.js";
import { parseDuration } from "../utils.js";
import type { ParsedArgs } from "../index.js";
import * as readline from "node:readline";

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

export async function clean(args: ParsedArgs) {
  const dir =
    typeof args.flags.dir === "string"
      ? resolve(args.flags.dir)
      : process.cwd();

  const all = args.flags.all === true;
  const dryRun = args.flags["dry-run"] === true;
  const force = args.flags.force === true;
  const olderThanStr =
    typeof args.flags["older-than"] === "string"
      ? args.flags["older-than"]
      : undefined;

  let olderThanMs: number | null = null;
  if (olderThanStr) {
    olderThanMs = parseDuration(olderThanStr);
    if (olderThanMs === null) {
      outputError(
        `Invalid duration: ${olderThanStr}. Use format like 7d, 24h, 2w`,
        "INVALID_DURATION",
      );
      process.exit(1);
    }
  }

  const sessions = findSessionDirs(dir);
  const now = Date.now();

  const toRemove: Array<{
    sessionId: string;
    sessionDir: string;
    reason: string;
  }> = [];

  for (const entry of sessions) {
    const meta = entry.meta;
    if (!meta) continue;

    // Orphan detection: markdown file no longer exists
    if (!all && !existsSync(meta.markdownPath)) {
      toRemove.push({
        sessionId: entry.sessionId,
        sessionDir: entry.sessionDir,
        reason: "orphan (markdown file missing)",
      });
      continue;
    }

    // All flag: remove everything
    if (all) {
      if (olderThanMs) {
        const updatedAt = new Date(meta.updatedAt).getTime();
        if (now - updatedAt > olderThanMs) {
          toRemove.push({
            sessionId: entry.sessionId,
            sessionDir: entry.sessionDir,
            reason: `older than ${olderThanStr}`,
          });
        }
      } else {
        toRemove.push({
          sessionId: entry.sessionId,
          sessionDir: entry.sessionDir,
          reason: "all sessions",
        });
      }
      continue;
    }

    // Age-based cleanup
    if (olderThanMs) {
      const updatedAt = new Date(meta.updatedAt).getTime();
      if (now - updatedAt > olderThanMs) {
        toRemove.push({
          sessionId: entry.sessionId,
          sessionDir: entry.sessionDir,
          reason: `older than ${olderThanStr}`,
        });
      }
    }
  }

  if (toRemove.length === 0) {
    outputJson({ removed: 0, sessions: [] }, args.flags.pretty === true);
    return;
  }

  if (dryRun) {
    outputJson(
      {
        dryRun: true,
        wouldRemove: toRemove.length,
        sessions: toRemove.map((s) => ({
          sessionId: s.sessionId,
          reason: s.reason,
        })),
      },
      args.flags.pretty === true,
    );
    return;
  }

  if (!force) {
    console.error(`About to remove ${toRemove.length} session(s):`);
    for (const s of toRemove) {
      console.error(`  ${s.sessionId}: ${s.reason}`);
    }
    const ok = await confirm("Continue?");
    if (!ok) {
      console.error("Aborted.");
      process.exit(0);
    }
  }

  let removed = 0;
  for (const s of toRemove) {
    try {
      rmSync(s.sessionDir, { recursive: true, force: true });
      removed++;
    } catch (err) {
      console.error(`Failed to remove ${s.sessionDir}: ${err}`);
    }
  }

  outputJson(
    {
      removed,
      sessions: toRemove.map((s) => ({
        sessionId: s.sessionId,
        reason: s.reason,
      })),
    },
    args.flags.pretty === true,
  );
}

/**
 * Session data reading and feedback watching.
 * Read functions are imported from session-manager (single implementation).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { watch } from "chokidar";
import { outputJson } from "./output.js";
import { stopServer } from "./server-client.js";
import {
  readMeta,
  readFeedbackByDir as readFeedback,
  readPlanByDir as readPlan,
} from "../lib/server/session-manager.js";
import type {
  SessionMeta,
  FeedbackPayload,
} from "../lib/types/index.js";

export { readMeta, readFeedback, readPlan };

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

// ── Feedback watching ──────────────────────────────────────────────

import { CliExitCode } from "./errors.js";
import { EXIT_APPROVED, EXIT_NEEDS_WORK } from "./commands/status.js";

async function outputFeedbackResult(
  feedback: FeedbackPayload,
  sessionId: string,
  planTitle: string,
  sessionDir: string,
): Promise<never> {
  // Stop the server — review cycle is complete
  const parentDir = dirname(sessionDir);
  const stopped = await stopServer(parentDir);
  if (stopped) {
    console.error("Server stopped.");
  }

  const unresolvedComments = feedback.comments.filter((c) => !c.resolved);
  outputJson({
    event: "feedback",
    sessionId,
    planTitle,
    status: feedback.status,
    comments: unresolvedComments,
    commentCount: unresolvedComments.length,
  });
  throw new CliExitCode(
    feedback.status === "approved" ? EXIT_APPROVED : EXIT_NEEDS_WORK,
  );
}

export async function awaitReviewFeedback(
  feedbackPath: string,
  sessionId: string,
  planTitle: string,
  mdWatcher: ReturnType<typeof watch>,
  sessionDir: string,
): Promise<void> {
  // Check if feedback already submitted
  if (existsSync(feedbackPath)) {
    try {
      const existing = JSON.parse(
        readFileSync(feedbackPath, "utf-8"),
      ) as FeedbackPayload;
      if (existing.status === "approved" || existing.status === "needs-work") {
        mdWatcher.close();
        await outputFeedbackResult(existing, sessionId, planTitle, sessionDir);
        return;
      }
    } catch {
      /* ignore */
    }
  }

  return new Promise((resolve) => {
    const fbWatcher = watch(feedbackPath, {
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    });

    const check = async () => {
      try {
        if (!existsSync(feedbackPath)) return;
        const data = JSON.parse(
          readFileSync(feedbackPath, "utf-8"),
        ) as FeedbackPayload;
        if (data.status === "approved" || data.status === "needs-work") {
          fbWatcher.close();
          mdWatcher.close();
          await outputFeedbackResult(data, sessionId, planTitle, sessionDir);
          resolve();
        }
      } catch {
        /* ignore parse errors during writes */
      }
    };

    fbWatcher.on("change", check);
    fbWatcher.on("add", check);

    process.on("SIGINT", () => {
      fbWatcher.close();
      mdWatcher.close();
      console.error("\nStopped watching.");
      process.exit(0);
    });
  });
}

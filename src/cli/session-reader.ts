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

/**
 * Watch a feedback.json file until a terminal state is reached.
 * Returns the terminal FeedbackPayload, or throws on abort/timeout.
 *
 * @param isTerminal — predicate to determine if feedback is actionable
 *   (e.g., filter out stale plan versions or "reviewing" status)
 * @param signal — AbortSignal for cancellation (timeout, SIGINT, etc.)
 */
export function waitForTerminalFeedback(
  feedbackPath: string,
  isTerminal: (feedback: FeedbackPayload) => boolean,
  signal?: AbortSignal,
): Promise<FeedbackPayload> {
  // Check if feedback already exists
  if (existsSync(feedbackPath)) {
    try {
      const existing = JSON.parse(
        readFileSync(feedbackPath, "utf-8"),
      ) as FeedbackPayload;
      if (isTerminal(existing)) {
        return Promise.resolve(existing);
      }
    } catch {
      /* ignore */
    }
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const fbWatcher = watch(feedbackPath, {
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    });

    const cleanup = () => {
      fbWatcher.close();
      signal?.removeEventListener("abort", onAbort);
    };

    const check = () => {
      try {
        if (!existsSync(feedbackPath)) return;
        const data = JSON.parse(
          readFileSync(feedbackPath, "utf-8"),
        ) as FeedbackPayload;
        if (isTerminal(data)) {
          cleanup();
          resolve(data);
        }
      } catch {
        /* ignore parse errors during writes */
      }
    };

    const onAbort = () => {
      cleanup();
      reject(signal!.reason);
    };

    fbWatcher.on("change", check);
    fbWatcher.on("add", check);
    signal?.addEventListener("abort", onAbort);
  });
}

function isTerminalStatus(feedback: FeedbackPayload): boolean {
  return feedback.status === "approved" || feedback.status === "needs-work";
}

export async function awaitReviewFeedback(
  feedbackPath: string,
  sessionId: string,
  planTitle: string,
  mdWatcher: ReturnType<typeof watch>,
  sessionDir: string,
): Promise<void> {
  const controller = new AbortController();

  const onSigint = () => {
    controller.abort();
    mdWatcher.close();
    console.error("\nStopped watching.");
    throw new CliExitCode(0);
  };

  process.on("SIGINT", onSigint);

  try {
    const feedback = await waitForTerminalFeedback(
      feedbackPath,
      isTerminalStatus,
      controller.signal,
    );

    mdWatcher.close();

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
  } finally {
    process.removeListener("SIGINT", onSigint);
  }
}

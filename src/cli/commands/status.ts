import { resolveSession } from "../session-resolver.js";
import { readMeta, readFeedback } from "../session-reader.js";
import { outputJson, outputError } from "../output.js";
import { parseDuration } from "../utils.js";
import type { ParsedArgs } from "../index.js";
import type { FeedbackPayload } from "../../lib/types/index.js";
import { watch } from "chokidar";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

// Exit codes
const EXIT_APPROVED = 0;
const EXIT_ERROR = 1;
const EXIT_NEEDS_WORK = 3;
const EXIT_REVIEWING = 4;
const EXIT_NO_FEEDBACK = 5;

function computeStatus(feedback: FeedbackPayload | null) {
  if (!feedback)
    return { feedbackStatus: "none" as const, exitCode: EXIT_NO_FEEDBACK };

  switch (feedback.status) {
    case "approved":
      return { feedbackStatus: feedback.status, exitCode: EXIT_APPROVED };
    case "needs-work":
      return { feedbackStatus: feedback.status, exitCode: EXIT_NEEDS_WORK };
    case "reviewing":
    default:
      return { feedbackStatus: feedback.status, exitCode: EXIT_REVIEWING };
  }
}

function computeSummary(feedback: FeedbackPayload | null) {
  const phaseSummary = { total: 0, approved: 0, needsWork: 0, pending: 0 };
  const commentSummary = { total: 0, unresolved: 0 };

  if (feedback) {
    for (const ps of Object.values(feedback.phaseStatuses)) {
      phaseSummary.total++;
      if (ps.status === "approved") phaseSummary.approved++;
      else if (ps.status === "needs-work") phaseSummary.needsWork++;
      else phaseSummary.pending++;
    }

    commentSummary.total = feedback.comments.length;
    commentSummary.unresolved = feedback.comments.filter(
      (c) => !c.resolved,
    ).length;
  }

  return { phaseSummary, commentSummary };
}

export async function status(args: ParsedArgs) {
  const idOrFile = args.positional[0];
  if (!idOrFile) {
    outputError(
      "Please provide a session ID or markdown file path",
      "MISSING_ARG",
    );
    process.exit(EXIT_ERROR);
  }

  const resolved = resolveSession(idOrFile);
  if (!resolved) {
    outputError(`Session not found for: ${idOrFile}`, "NOT_FOUND");
    process.exit(EXIT_ERROR);
  }

  const meta = readMeta(resolved.sessionDir);
  if (!meta) {
    outputError(`Could not read session metadata`, "READ_ERROR");
    process.exit(EXIT_ERROR);
  }

  const shouldWait = args.flags.wait === true;

  if (shouldWait) {
    const timeoutStr = args.flags["wait-timeout"];
    const timeoutMs =
      typeof timeoutStr === "string"
        ? (parseDuration(timeoutStr) ?? 30 * 60 * 1000)
        : 30 * 60 * 1000; // 30 min default

    await waitForFeedback(
      resolved.sessionDir,
      resolved.sessionId,
      meta,
      timeoutMs,
    );
    return;
  }

  const feedback = readFeedback(resolved.sessionDir);
  const { feedbackStatus, exitCode } = computeStatus(feedback);
  const { phaseSummary, commentSummary } = computeSummary(feedback);

  outputJson(
    {
      sessionId: resolved.sessionId,
      planTitle: meta.planTitle,
      status: meta.status,
      feedbackStatus,
      phaseSummary,
      commentSummary,
    },
    args.flags.pretty === true,
  );

  process.exit(exitCode);
}

async function waitForFeedback(
  sessionDir: string,
  sessionId: string,
  meta: ReturnType<typeof readMeta> & {},
  timeoutMs: number,
): Promise<void> {
  // Check current state first
  const current = readFeedback(sessionDir);
  if (current && current.status !== "reviewing") {
    const { feedbackStatus, exitCode } = computeStatus(current);
    const { phaseSummary, commentSummary } = computeSummary(current);
    outputJson({
      sessionId,
      planTitle: meta.planTitle,
      status: meta.status,
      feedbackStatus,
      phaseSummary,
      commentSummary,
    });
    process.exit(exitCode);
  }

  // Watch for changes
  const feedbackPath = join(sessionDir, "feedback.json");
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      watcher.close();
      outputError("Timed out waiting for feedback", "TIMEOUT");
      process.exit(EXIT_ERROR);
    }, timeoutMs);

    const checkFile = () => {
      try {
        if (!existsSync(feedbackPath)) return;
        const data = JSON.parse(
          readFileSync(feedbackPath, "utf-8"),
        ) as FeedbackPayload;
        if (data.status !== "reviewing") {
          clearTimeout(timer);
          watcher.close();
          const { feedbackStatus, exitCode } = computeStatus(data);
          const { phaseSummary, commentSummary } = computeSummary(data);
          outputJson({
            sessionId,
            planTitle: meta.planTitle,
            status: meta.status,
            feedbackStatus,
            phaseSummary,
            commentSummary,
          });
          process.exit(exitCode);
        }
      } catch {
        // ignore parse errors during writes
      }
    };

    const watcher = watch(feedbackPath, {
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    });

    watcher.on("change", checkFile);
    watcher.on("add", checkFile);
  });
}

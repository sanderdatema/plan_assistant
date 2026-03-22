import { requireSession } from "../session-resolver.js";
import { readMeta, readFeedback, waitForTerminalFeedback } from "../session-reader.js";
import { outputJson, outputError } from "../output.js";
import { parseDuration } from "../utils.js";
import { CliError, CliExitCode } from "../errors.js";
import type { ParsedArgs } from "../index.js";
import type { FeedbackPayload } from "../../lib/types/index.js";
import type { SessionMeta } from "../../lib/types/index.js";
import { join } from "node:path";

// Exit codes
export const EXIT_APPROVED = 0;
export const EXIT_ERROR = 1;
export const EXIT_NEEDS_WORK = 3;
export const EXIT_REVIEWING = 4;
export const EXIT_NO_FEEDBACK = 5;

const DEFAULT_WAIT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function computeStatus(feedback: FeedbackPayload | null) {
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

export function computeSummary(feedback: FeedbackPayload | null) {
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
    throw new CliError("Missing session ID or file path");
  }

  const resolved = requireSession(idOrFile);

  const meta = readMeta(resolved.sessionDir);
  if (!meta) {
    outputError(`Could not read session metadata`, "READ_ERROR");
    throw new CliError("Could not read session metadata");
  }

  const shouldWait = args.flags.wait === true;

  if (shouldWait) {
    const timeoutStr = args.flags["wait-timeout"];
    const timeoutMs =
      typeof timeoutStr === "string"
        ? (parseDuration(timeoutStr) ?? DEFAULT_WAIT_TIMEOUT_MS)
        : DEFAULT_WAIT_TIMEOUT_MS;

    const exitCode = await pollFeedbackStatus(
      resolved.sessionDir,
      resolved.sessionId,
      meta,
      timeoutMs,
    );
    throw new CliExitCode(exitCode);
  }

  const rawFeedback = readFeedback(resolved.sessionDir);
  // Discard feedback from a previous plan version (stale cycle)
  const feedback =
    rawFeedback && meta.planVersion && rawFeedback.planVersion < meta.planVersion
      ? null
      : rawFeedback;
  const { feedbackStatus, exitCode } = computeStatus(feedback);
  const { phaseSummary, commentSummary } = computeSummary(feedback);

  outputJson(
    {
      sessionId: resolved.sessionId,
      planTitle: meta.planTitle,
      planVersion: meta.planVersion,
      status: meta.status,
      feedbackStatus,
      phaseSummary,
      commentSummary,
    },
    args.flags.pretty === true,
  );

  throw new CliExitCode(exitCode);
}

function isTerminalForMeta(meta: SessionMeta) {
  return (feedback: FeedbackPayload) =>
    feedback.status !== "reviewing" &&
    !(meta.planVersion && feedback.planVersion < meta.planVersion);
}

async function pollFeedbackStatus(
  sessionDir: string,
  sessionId: string,
  meta: SessionMeta,
  timeoutMs: number,
): Promise<number> {
  const feedbackPath = join(sessionDir, "feedback.json");

  try {
    const feedback = await waitForTerminalFeedback(
      feedbackPath,
      isTerminalForMeta(meta),
      AbortSignal.timeout(timeoutMs),
    );

    const { feedbackStatus, exitCode } = computeStatus(feedback);
    const { phaseSummary, commentSummary } = computeSummary(feedback);
    outputJson({
      sessionId,
      planTitle: meta.planTitle,
      status: meta.status,
      feedbackStatus,
      phaseSummary,
      commentSummary,
    });
    return exitCode;
  } catch {
    outputError("Timed out waiting for feedback", "TIMEOUT");
    throw new CliError("Timed out waiting for feedback");
  }
}

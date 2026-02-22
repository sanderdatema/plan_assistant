import { resolve } from "node:path";
import { findSessionDirs } from "../session-reader.js";
import { readFeedback } from "../session-reader.js";
import { outputJson } from "../output.js";
import type { ParsedArgs } from "../index.js";

export async function list(args: ParsedArgs) {
  const dir =
    typeof args.flags.dir === "string" ? resolve(args.flags.dir) : process.cwd();

  const sessions = findSessionDirs(dir);

  const result = sessions.map((entry) => {
    const feedback = readFeedback(entry.sessionDir);
    return {
      sessionId: entry.sessionId,
      planTitle: entry.meta.planTitle,
      status: entry.meta.status,
      planVersion: entry.meta.planVersion,
      feedbackStatus: feedback?.status ?? "none",
      hasUnresolvedComments:
        feedback?.comments.some((c) => !c.resolved) ?? false,
      markdownPath: entry.meta.markdownPath,
      updatedAt: entry.meta.updatedAt,
    };
  });

  outputJson(result, args.flags.pretty === true);
}

import { resolveSession } from "../session-resolver.js";
import { readFeedback } from "../session-reader.js";
import { outputJson, outputError } from "../output.js";
import type { ParsedArgs } from "../index.js";

export async function feedback(args: ParsedArgs) {
  const idOrFile = args.positional[0];
  if (!idOrFile) {
    outputError(
      "Please provide a session ID or markdown file path",
      "MISSING_ARG",
    );
    process.exit(1);
  }

  const resolved = resolveSession(idOrFile);
  if (!resolved) {
    outputError(`Session not found for: ${idOrFile}`, "NOT_FOUND");
    process.exit(1);
  }

  const feedback = readFeedback(resolved.sessionDir);
  if (!feedback) {
    outputError("No feedback found for this session", "NO_FEEDBACK");
    process.exit(1);
  }

  const phaseFilter =
    typeof args.flags.phase === "string" ? args.flags.phase : undefined;
  const unresolvedOnly = args.flags.unresolved === true;

  let comments = feedback.comments;

  if (phaseFilter) {
    comments = comments.filter((c) => c.phaseId === phaseFilter);
  }

  if (unresolvedOnly) {
    comments = comments.filter((c) => !c.resolved);
  }

  const output =
    phaseFilter || unresolvedOnly
      ? { ...feedback, comments }
      : feedback;

  outputJson(output, args.flags.pretty === true);
}

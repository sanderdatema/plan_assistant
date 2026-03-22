import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { requireSession } from "../session-resolver.js";
import { readPlan, readFeedback } from "../session-reader.js";
import { renderPlanToHtml } from "../export-html.js";
import { outputError } from "../output.js";
import { CliError } from "../errors.js";
import type { ParsedArgs } from "../index.js";

export async function exportCmd(args: ParsedArgs) {
  const idOrFile = args.positional[0];
  if (!idOrFile) {
    outputError(
      "Please provide a session ID or markdown file path",
      "MISSING_ARG",
    );
    throw new CliError("Missing session ID or file path");
  }

  const resolved = requireSession(idOrFile);

  const plan = readPlan(resolved.sessionDir);
  if (!plan) {
    outputError("Could not read plan data", "READ_ERROR");
    throw new CliError("Could not read plan data");
  }

  const feedback = readFeedback(resolved.sessionDir);
  const html = renderPlanToHtml(plan, feedback);

  const outputFile =
    typeof args.flags.output === "string" ? args.flags.output : undefined;

  if (outputFile) {
    const path = resolve(outputFile);
    writeFileSync(path, html, "utf-8");
    console.error(`Exported to ${path}`);
  } else {
    process.stdout.write(html);
  }
}

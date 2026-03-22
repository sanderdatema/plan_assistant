/**
 * Session setup for the review command.
 * Extracted from review.ts to reduce god-function complexity.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { watch } from "chokidar";
import {
  parseMarkdownToPlan,
  sessionIdFromPath,
} from "./markdown-to-plan.js";
import type { SessionMeta } from "../lib/types/index.js";
import type { PlanJson } from "../lib/types/plan.js";
import { CliError } from "./errors.js";

export interface SessionSetupResult {
  sessionId: string;
  sessionPath: string;
  sessionDir: string;
  plan: PlanJson;
  version: number;
  absolutePath: string;
  projectDir: string;
  existingPlanPath: string;
}

/**
 * Parse a markdown file, create/update the session directory, and write session files.
 * Returns all the context needed by the rest of the review command.
 */
export function prepareSession(markdownFile: string): SessionSetupResult {
  const absolutePath = resolve(markdownFile);

  if (!existsSync(absolutePath)) {
    throw new CliError(`File not found: ${absolutePath}`);
  }

  const sessionDir = join(dirname(absolutePath), ".plan-sessions");
  const sessionId = sessionIdFromPath(absolutePath);
  const sessionPath = join(sessionDir, sessionId);
  const projectDir = process.cwd();

  // Determine version
  let version = 1;
  const existingPlanPath = join(sessionPath, "plan.json");
  if (existsSync(existingPlanPath)) {
    try {
      const existing = JSON.parse(readFileSync(existingPlanPath, "utf-8"));
      version = (existing.meta?.version ?? 0) + 1;
    } catch {
      // ignore, start at 1
    }
  }

  // Parse markdown
  const markdown = readFileSync(absolutePath, "utf-8");
  const { plan, warnings } = parseMarkdownToPlan(
    markdown,
    absolutePath,
    projectDir,
    version,
  );

  // Display parser warnings
  for (const warning of warnings) {
    console.error(`Warning: ${warning}`);
  }

  if (plan.phases.length === 0) {
    console.error(`
⚠ No phases found — plan will appear empty in the browser.

Use the correct format for phases:

  ## Phase 1: Phase Name

  ### Changes Required:

  #### 1. Component Name
  **File**: \`path/to/file.ext\`
  Description of what to change.

  ### Success Criteria:
  - [ ] \`npm test\`

Accepted phase keywords: "Phase N:", "Step N:", "Task N:" (H2 headings)
Run \`npx plan-assistant init --output <file>\` to generate a correctly-formatted template.
`);
  }

  // Write session files
  mkdirSync(sessionPath, { recursive: true });
  mkdirSync(join(sessionPath, "versions"), { recursive: true });

  // Clear stale feedback from previous review cycle
  const oldFeedbackPath = join(sessionPath, "feedback.json");
  if (existsSync(oldFeedbackPath)) {
    try {
      unlinkSync(oldFeedbackPath);
    } catch {
      // ignore
    }
  }

  const meta: SessionMeta = {
    id: sessionId,
    planTitle: plan.meta.title,
    markdownPath: absolutePath,
    projectDir,
    status: "active",
    planVersion: version,
    createdAt: plan.meta.createdAt,
    updatedAt: plan.meta.updatedAt,
  };

  writeFileSync(join(sessionPath, "meta.json"), JSON.stringify(meta, null, 2));
  writeFileSync(join(sessionPath, "plan.json"), JSON.stringify(plan, null, 2));
  writeFileSync(
    join(sessionPath, "versions", `v${version}.json`),
    JSON.stringify(plan, null, 2),
  );

  return {
    sessionId,
    sessionPath,
    sessionDir,
    plan,
    version,
    absolutePath,
    projectDir,
    existingPlanPath,
  };
}

/**
 * Create a chokidar watcher on the markdown file that re-parses and
 * updates session files on change.
 */
export function watchMarkdownFile(
  absolutePath: string,
  sessionPath: string,
  projectDir: string,
  existingPlanPath: string,
  ensureServer: () => Promise<void>,
) {
  const mdWatcher = watch(absolutePath, {
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  mdWatcher.on("change", async () => {
    try {
      await ensureServer();
      const updated = readFileSync(absolutePath, "utf-8");
      const existingPlan = JSON.parse(readFileSync(existingPlanPath, "utf-8"));
      const newVersion = (existingPlan.meta?.version ?? 0) + 1;
      const { plan: newPlan, warnings: newWarnings } = parseMarkdownToPlan(
        updated,
        absolutePath,
        projectDir,
        newVersion,
      );

      for (const warning of newWarnings) {
        console.error(`Warning: ${warning}`);
      }

      if (newPlan.phases.length === 0) {
        console.error(
          `⚠ No phases found after reload — check format. Run \`npx plan-assistant init\` for a template.`,
        );
      }

      writeFileSync(
        join(sessionPath, "plan.json"),
        JSON.stringify(newPlan, null, 2),
      );
      writeFileSync(
        join(sessionPath, "versions", `v${newVersion}.json`),
        JSON.stringify(newPlan, null, 2),
      );
      console.error(
        `[${new Date().toLocaleTimeString()}] Plan updated (v${newVersion})`,
      );
    } catch (err) {
      console.error(`Error re-parsing markdown: ${err}`);
    }
  });

  return mdWatcher;
}

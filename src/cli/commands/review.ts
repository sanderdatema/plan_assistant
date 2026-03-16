import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { watch } from "chokidar";
import { parseMarkdownToPlan, sessionIdFromPath } from "../markdown-to-plan.js";
import { outputJson } from "../output.js";
import { waitForFeedback } from "../session-reader.js";
import {
  DEFAULT_BASE_PORT,
  MAX_PORT,
  findExistingServer,
  checkHealth,
  isPortFree,
  findFreePort,
  launchServer,
  openBrowser,
} from "../server-client.js";
import type { SessionMeta } from "../../lib/types/index.js";
import type { ParsedArgs } from "../index.js";

export async function review(args: ParsedArgs) {
  const markdownFile = args.positional[0];
  if (!markdownFile) {
    console.error("Error: Please provide a markdown file path");
    console.error("Usage: plan-assistant review <markdown-file>");
    process.exit(1);
  }

  // Parse host configuration (for Docker/remote sandbox environments)
  const hostFlag = args.flags.host;
  const displayHost =
    (typeof hostFlag === "string" ? hostFlag : null) ??
    process.env.PLAN_ASSISTANT_HOST ??
    "localhost";

  // Parse port configuration
  const portFlag = args.flags.port;
  const envPort = process.env.PLAN_ASSISTANT_PORT;
  let requestedPort: number | undefined;

  if (typeof portFlag === "string") {
    requestedPort = parseInt(portFlag, 10);
    if (isNaN(requestedPort)) {
      console.error(`Error: Invalid port number: ${portFlag}`);
      process.exit(1);
    }
  } else if (envPort) {
    requestedPort = parseInt(envPort, 10);
    if (isNaN(requestedPort)) {
      console.error(`Error: Invalid PLAN_ASSISTANT_PORT: ${envPort}`);
      process.exit(1);
    }
  }

  const absolutePath = resolve(markdownFile);

  if (!existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  const sessionDir = join(dirname(absolutePath), ".plan-sessions");
  const sessionId = sessionIdFromPath(absolutePath);
  const sessionPath = join(sessionDir, sessionId);

  // Parse markdown
  const markdown = readFileSync(absolutePath, "utf-8");
  const projectDir = process.cwd();

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

  const { plan, warnings } = parseMarkdownToPlan(
    markdown,
    absolutePath,
    projectDir,
    version,
  );

  // Display any parser warnings
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

  // Find existing server for this session dir or start a new one
  const reuse = args.flags.reuse === true;
  const basePort = requestedPort ?? DEFAULT_BASE_PORT;
  let port = await findExistingServer(sessionDir, basePort);

  if (!port && reuse) {
    // --reuse: find any running plan-assistant server and reuse it
    for (let p = basePort; p <= MAX_PORT; p++) {
      const health = await checkHealth(p);
      if (health) {
        port = p;
        console.error(`Reusing existing server on port ${p}.`);
        break;
      }
    }
  }

  if (!port) {
    if (requestedPort) {
      if (!(await isPortFree(requestedPort))) {
        // Check if it's a plan-assistant server for a better error message
        const health = await checkHealth(requestedPort);
        if (health) {
          console.error(
            `Error: Port ${requestedPort} is already used by Plan Assistant (session dir: ${health.sessionDir}).` +
              `\nUse \`plan-assistant stop\` to stop it, or add --reuse to share the server.`,
          );
        } else {
          console.error(
            `Error: Port ${requestedPort} is already in use by another process.`,
          );
        }
        process.exit(1);
      }
      port = requestedPort;
    } else {
      port = await findFreePort(basePort);
    }
    await launchServer(sessionDir, port);
  }

  const url = `http://${displayHost}:${port}/plan/${sessionId}`;
  const feedbackPath = join(sessionPath, "feedback.json");

  // Machine-readable ready event on first line
  outputJson({
    event: "ready",
    sessionId,
    planVersion: version,
    freshCycle: true,
    url,
    feedbackPath,
  });

  if (displayHost === "localhost") {
    openBrowser(url);
  }

  const noWait = args.flags["no-wait"] === true;

  console.error(`\nPlan Assistant`);
  console.error(`  Review:   ${url}`);
  console.error(`  Session:  ${sessionPath}`);
  console.error(`  Feedback: ${feedbackPath}`);
  if (noWait) {
    console.error(`\nWatching ${absolutePath} for changes...`);
    console.error(
      `Run \`plan-assistant status --wait ${markdownFile}\` to wait for feedback.`,
    );
  } else {
    console.error(
      `\nWatching for changes and waiting for your feedback (Approve / Request Changes)...`,
    );
    console.error(`Press Ctrl+C to stop without waiting.`);
  }

  // Watch markdown file for changes
  const mdWatcher = watch(absolutePath, {
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  mdWatcher.on("change", () => {
    try {
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

  // Wait for feedback unless --no-wait
  if (!noWait) {
    await waitForFeedback(
      feedbackPath,
      sessionId,
      plan.meta.title,
      mdWatcher,
      sessionPath,
    );
    return;
  }

  // Keep process alive (--no-wait mode)
  process.on("SIGINT", () => {
    mdWatcher.close();
    console.error("\nStopped watching.");
    process.exit(0);
  });
}

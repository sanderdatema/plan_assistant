import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { outputJson } from "../output.js";
import { awaitReviewFeedback } from "../session-reader.js";
import { prepareSession, watchMarkdownFile } from "../review-session.js";
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
import type { ParsedArgs } from "../index.js";
import { CliError } from "../errors.js";

const KEEPALIVE_MS = 2 * 60 * 1000;

export async function review(args: ParsedArgs) {
  const markdownFile = args.positional[0];
  if (!markdownFile) {
    console.error("Error: Please provide a markdown file path");
    console.error("Usage: plan-assistant review <markdown-file>");
    throw new CliError("Missing markdown file path");
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
      throw new CliError(`Invalid port number: ${portFlag}`);
    }
  } else if (envPort) {
    requestedPort = parseInt(envPort, 10);
    if (isNaN(requestedPort)) {
      throw new CliError(`Invalid PLAN_ASSISTANT_PORT: ${envPort}`);
    }
  }

  // --- Session setup (extracted to review-session.ts) ---
  const session = prepareSession(markdownFile);
  const {
    sessionId,
    sessionPath,
    sessionDir,
    plan,
    version,
    absolutePath,
    existingPlanPath,
  } = session;

  // --- Server lifecycle ---
  const reuse = args.flags.reuse === true;
  const basePort = requestedPort ?? DEFAULT_BASE_PORT;
  let port = await findExistingServer(sessionDir, basePort);

  if (!port && reuse) {
    for (let p = basePort; p <= MAX_PORT; p++) {
      const health = await checkHealth(p);
      if (health) {
        port = p;
        if (health.sessionDir !== sessionDir) {
          const linkPath = join(health.sessionDir, sessionId);
          if (!existsSync(linkPath)) {
            mkdirSync(health.sessionDir, { recursive: true });
            symlinkSync(sessionPath, linkPath);
            console.error(
              `Linked session into server at ${health.sessionDir}.`,
            );
          }
        }
        console.error(`Reusing existing server on port ${p}.`);
        break;
      }
    }
  }

  if (!port) {
    if (requestedPort) {
      if (!(await isPortFree(requestedPort))) {
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
        throw new CliError(`Port ${requestedPort} is already in use`);
      }
      port = requestedPort;
    } else {
      port = await findFreePort(basePort);
    }
    await launchServer(sessionDir, port);
  }

  const serverPort = port!;

  async function ensureServer(): Promise<void> {
    const health = await checkHealth(serverPort);
    if (!health) {
      console.error(
        `[${new Date().toLocaleTimeString()}] Server on port ${serverPort} is gone, restarting...`,
      );
      await launchServer(sessionDir, serverPort);
    }
  }

  const keepaliveInterval = setInterval(async () => {
    try {
      await ensureServer();
    } catch {
      // restart failed — will retry next interval
    }
  }, KEEPALIVE_MS);

  const url = `http://${displayHost}:${serverPort}/plan/${sessionId}`;
  const feedbackPath = join(sessionPath, "feedback.json");

  // Machine-readable ready event
  outputJson({
    event: "ready",
    sessionId,
    planVersion: version,
    freshCycle: true,
    url,
    feedbackPath,
    nextStep: `IMPORTANT: Now run \`npx plan-assistant status --wait ${markdownFile}\` in the FOREGROUND and wait for it to exit. Do NOT proceed until the user submits feedback. Exit codes: 0=approved, 3=needs-work.`,
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
      `\nIMPORTANT: Run \`npx plan-assistant status --wait ${markdownFile}\` in the foreground to block until user submits feedback. Do NOT proceed without it.`,
    );
  } else {
    console.error(
      `\nWatching for changes and waiting for your feedback (Approve / Request Changes)...`,
    );
    console.error(`Press Ctrl+C to stop without waiting.`);
  }

  // --- File watching (extracted to review-session.ts) ---
  const mdWatcher = watchMarkdownFile(
    absolutePath,
    sessionPath,
    session.projectDir,
    existingPlanPath,
    ensureServer,
  );

  // Wait for feedback unless --no-wait
  if (!noWait) {
    await awaitReviewFeedback(
      feedbackPath,
      sessionId,
      plan.meta.title,
      mdWatcher,
      sessionPath,
    );
    clearInterval(keepaliveInterval);
    return;
  }

  // Keep process alive (--no-wait mode)
  process.on("SIGINT", () => {
    clearInterval(keepaliveInterval);
    mdWatcher.close();
    console.error("\nStopped watching.");
    process.exit(0);
  });
}

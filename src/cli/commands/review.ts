import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import { createServer } from "node:net";
import { watch } from "chokidar";
import { parseMarkdownToPlan, sessionIdFromPath } from "../markdown-to-plan.js";
import { outputJson } from "../output.js";
import type { SessionMeta } from "../../lib/types/index.js";
import { ensureDir } from "../utils.js";
import type { ParsedArgs } from "../index.js";

const DEFAULT_BASE_PORT = 5181;
const MAX_PORT = 5199;

function getPackageDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // dist/cli/commands/review.js -> package root
  return resolve(dirname(thisFile), "../../..");
}

async function checkHealth(
  port: number,
): Promise<{ sessionDir: string; pid: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);
    const res = await fetch(`http://localhost:${port}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as { sessionDir: string; pid: number };
  } catch {
    return null;
  }
}

async function findExistingServer(
  sessionDir: string,
  basePort: number,
): Promise<number | null> {
  for (let port = basePort; port <= MAX_PORT; port++) {
    const health = await checkHealth(port);
    if (health && health.sessionDir === sessionDir) {
      return port;
    }
  }
  return null;
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort(basePort: number): Promise<number> {
  for (let port = basePort; port <= MAX_PORT; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${basePort}-${MAX_PORT}`);
}

function startServer(sessionDir: string, port: number): Promise<void> {
  const packageDir = getPackageDir();
  const buildEntry = join(packageDir, "build", "index.js");

  if (!existsSync(buildEntry)) {
    console.error(
      `Error: Server build not found at ${buildEntry}\nRun 'npm run build:server' in the plan-assistant package first.`,
    );
    process.exit(1);
  }

  return new Promise((resolvePromise, reject) => {
    const child = spawn("node", [buildEntry], {
      env: {
        ...process.env,
        SESSION_DIR: sessionDir,
        PORT: String(port),
      },
      stdio: "ignore",
      detached: true,
    });

    child.unref();

    let attempts = 0;
    const maxAttempts = 30;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);
        const res = await fetch(`http://localhost:${port}/api/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          clearInterval(interval);
          resolvePromise();
        }
      } catch {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error("Server failed to start within 15 seconds"));
        }
      }
    }, 500);
  });
}

function openBrowser(url: string) {
  try {
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    execSync(`${cmd} "${url}"`, { stdio: "ignore" });
  } catch {
    console.log(`Open in browser: ${url}`);
  }
}

export async function review(args: ParsedArgs) {
  const markdownFile = args.positional[0];
  if (!markdownFile) {
    console.error("Error: Please provide a markdown file path");
    console.error("Usage: plan-assistant review <markdown-file>");
    process.exit(1);
  }

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

  // Write session files
  ensureDir(sessionPath);
  ensureDir(join(sessionPath, "versions"));

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
  const basePort = requestedPort ?? DEFAULT_BASE_PORT;
  let port = await findExistingServer(sessionDir, basePort);

  if (port) {
    // Server already running for this session dir
  } else if (requestedPort) {
    // Specific port requested
    if (!(await isPortFree(requestedPort))) {
      console.error(`Error: Port ${requestedPort} is already in use`);
      process.exit(1);
    }
    port = requestedPort;
    process.stdout.write(`Starting Plan Assistant server on port ${port}...`);
    try {
      await startServer(sessionDir, port);
      console.log(" ready.");
    } catch (err) {
      console.error(` failed: ${err}`);
      process.exit(1);
    }
  } else {
    port = await findFreePort(basePort);
    process.stdout.write(`Starting Plan Assistant server on port ${port}...`);
    try {
      await startServer(sessionDir, port);
      console.log(" ready.");
    } catch (err) {
      console.error(` failed: ${err}`);
      process.exit(1);
    }
  }

  const url = `http://localhost:${port}/plan/${sessionId}`;
  const feedbackPath = join(sessionPath, "feedback.json");

  // Machine-readable ready event on first line
  outputJson({
    event: "ready",
    sessionId,
    url,
    feedbackPath,
  });

  openBrowser(url);

  console.error(`\nPlan Assistant`);
  console.error(`  Review:   ${url}`);
  console.error(`  Session:  ${sessionPath}`);
  console.error(`  Feedback: ${feedbackPath}`);
  console.error(`\nWatching ${absolutePath} for changes...`);

  // Watch markdown file for changes
  const watcher = watch(absolutePath, {
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  watcher.on("change", () => {
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

  // Keep process alive
  process.on("SIGINT", () => {
    watcher.close();
    console.error("\nStopped watching.");
    process.exit(0);
  });
}

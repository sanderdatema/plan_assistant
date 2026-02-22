import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import { createServer } from "node:net";
import { watch } from "chokidar";
import { parseMarkdownToPlan, sessionIdFromPath } from "./markdown-to-plan.js";
import type { SessionMeta } from "./types.js";

const BASE_PORT = 5181;
const MAX_PORT = 5199;

function getPackageDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // dist/index.js -> package root
  return resolve(dirname(thisFile), "..");
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
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
): Promise<number | null> {
  for (let port = BASE_PORT; port <= MAX_PORT; port++) {
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

async function findFreePort(): Promise<number> {
  for (let port = BASE_PORT; port <= MAX_PORT; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${BASE_PORT}-${MAX_PORT}`);
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
    execSync(`open "${url}"`, { stdio: "ignore" });
  } catch {
    console.log(`Open in browser: ${url}`);
  }
}

async function review(markdownFile: string) {
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

  const plan = parseMarkdownToPlan(markdown, absolutePath, projectDir, version);

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
  let port = await findExistingServer(sessionDir);

  if (port) {
    // Server already running for this session dir
  } else {
    port = await findFreePort();
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
  openBrowser(url);

  console.log(`\nPlan Assistant`);
  console.log(`  Review:   ${url}`);
  console.log(`  Session:  ${sessionPath}`);
  console.log(`  Feedback: ${join(sessionPath, "feedback.json")}`);
  console.log(`\nWatching ${absolutePath} for changes...`);

  // Watch markdown file for changes
  const watcher = watch(absolutePath, {
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  watcher.on("change", () => {
    try {
      const updated = readFileSync(absolutePath, "utf-8");
      const existingPlan = JSON.parse(readFileSync(existingPlanPath, "utf-8"));
      const newVersion = (existingPlan.meta?.version ?? 0) + 1;
      const newPlan = parseMarkdownToPlan(
        updated,
        absolutePath,
        projectDir,
        newVersion,
      );

      writeFileSync(
        join(sessionPath, "plan.json"),
        JSON.stringify(newPlan, null, 2),
      );
      console.log(
        `[${new Date().toLocaleTimeString()}] Plan updated (v${newVersion})`,
      );
    } catch (err) {
      console.error(`Error re-parsing markdown: ${err}`);
    }
  });

  // Keep process alive
  process.on("SIGINT", () => {
    watcher.close();
    console.log("\nStopped watching.");
    process.exit(0);
  });
}

function usage() {
  console.log(`plan-assistant - Review implementation plans in the browser

Usage:
  plan-assistant review <markdown-file>   Parse and review a plan
  plan-assistant help                     Show this help

Examples:
  plan-assistant review thoughts/shared/plans/my-plan.md
  npx plan-assistant review ./plan.md`);
}

export function main(args: string[]) {
  const command = args[0];

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    usage();
    return;
  }

  if (command === "review") {
    const file = args[1];
    if (!file) {
      console.error("Error: Please provide a markdown file path");
      console.error("Usage: plan-assistant review <markdown-file>");
      process.exit(1);
    }
    review(file);
  } else {
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
  }
}

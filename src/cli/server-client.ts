/**
 * Server lifecycle management: port finding, health checking,
 * lock files, and process spawning for the Plan Assistant dev server.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import { createServer } from "node:net";

export const DEFAULT_BASE_PORT = 5181;
export const MAX_PORT = 5199;

export function getPackageDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // dist/cli/server-client.js -> package root
  return resolve(dirname(thisFile), "../..");
}

export async function checkHealth(
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

interface ServerLock {
  port: number;
  pid: number;
}

function lockFilePath(sessionDir: string): string {
  return join(sessionDir, ".server-lock.json");
}

function readLock(sessionDir: string): ServerLock | null {
  const lockPath = lockFilePath(sessionDir);
  if (!existsSync(lockPath)) return null;
  try {
    return JSON.parse(readFileSync(lockPath, "utf-8")) as ServerLock;
  } catch {
    return null;
  }
}

function writeLock(sessionDir: string, port: number, pid: number): void {
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(lockFilePath(sessionDir), JSON.stringify({ port, pid }));
}

function clearLock(sessionDir: string): void {
  try {
    unlinkSync(lockFilePath(sessionDir));
  } catch {
    // ignore
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function findExistingServer(
  sessionDir: string,
  basePort: number,
): Promise<number | null> {
  // Check lock file first (fast path, avoids port scan race)
  const lock = readLock(sessionDir);
  if (lock) {
    if (isPidAlive(lock.pid)) {
      const health = await checkHealth(lock.port);
      if (health && health.sessionDir === sessionDir) {
        return lock.port;
      }
      // PID alive but not serving this session dir — kill the zombie
      try {
        process.kill(lock.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
    // Stale lock — remove it
    clearLock(sessionDir);
  }

  // Fallback: scan ports (handles lock-less legacy servers)
  for (let port = basePort; port <= MAX_PORT; port++) {
    const health = await checkHealth(port);
    if (health && health.sessionDir === sessionDir) {
      return port;
    }
  }
  return null;
}

export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function findFreePort(basePort: number): Promise<number> {
  for (let port = basePort; port <= MAX_PORT; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${basePort}-${MAX_PORT}`);
}

function startServer(sessionDir: string, port: number): Promise<number> {
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

    const pid = child.pid!;
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
          resolvePromise(pid);
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

export async function launchServer(
  sessionDir: string,
  port: number,
): Promise<void> {
  process.stdout.write(`Starting Plan Assistant server on port ${port}...`);
  try {
    const pid = await startServer(sessionDir, port);
    writeLock(sessionDir, port, pid);
    console.log(" ready.");
  } catch (err) {
    console.error(` failed: ${err}`);
    process.exit(1);
  }
}

export async function stopServer(sessionDir: string): Promise<boolean> {
  // Try lock file first
  const lock = readLock(sessionDir);
  const port = lock?.port;

  if (port) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      await fetch(`http://localhost:${port}/api/shutdown`, {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      clearLock(sessionDir);
      return true;
    } catch {
      // HTTP shutdown failed, try SIGTERM
    }
  }

  // Fallback: kill by PID
  if (lock && isPidAlive(lock.pid)) {
    try {
      process.kill(lock.pid, "SIGTERM");
      clearLock(sessionDir);
      return true;
    } catch {
      // ignore
    }
  }

  clearLock(sessionDir);
  return false;
}

export function openBrowser(url: string): void {
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

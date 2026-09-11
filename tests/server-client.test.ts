import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { createServer as createNetServer } from "node:net";
import type { Socket } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  fetchWithTimeout,
  checkHealth,
  findExistingServer,
  isPortFree,
  findFreePort,
  clearLock,
  stopServer,
  MAX_PORT,
} from "../src/cli/server-client.js";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

interface TestServer {
  port: number;
  requests: { url: string; method: string }[];
  close: () => Promise<void>;
}

/** Servers and sockets opened by the current test, torn down in afterEach. */
const openServers: TestServer[] = [];
const openSockets: Socket[] = [];
const openChildren: ChildProcess[] = [];

/**
 * Start a throwaway HTTP server. `port` 0 lets the OS assign a free one.
 * Binds 0.0.0.0 to match what the production server does.
 */
async function startServer(handler: Handler, port = 0): Promise<TestServer> {
  const requests: { url: string; method: string }[] = [];
  const server: Server = createHttpServer((req, res) => {
    requests.push({ url: req.url ?? "", method: req.method ?? "" });
    handler(req, res);
  });

  server.on("connection", (socket) => {
    openSockets.push(socket);
  });

  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => resolvePromise());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server did not bind to a TCP port");
  }

  const entry: TestServer = {
    port: address.port,
    requests,
    close: () =>
      new Promise<void>((resolvePromise) => {
        server.closeAllConnections();
        server.close(() => resolvePromise());
      }),
  };
  openServers.push(entry);
  return entry;
}

/** Server that answers /api/health with the given session dir. */
function healthServer(sessionDir: string, pid = 4242, port = 0) {
  return startServer((req, res) => {
    if (req.url === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ sessionDir, pid }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end("{}");
  }, port);
}

/** A port nothing is listening on (bound, then released). */
async function closedPort(): Promise<number> {
  const server = createNetServer();
  const port = await new Promise<number>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "0.0.0.0", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("no port"));
        return;
      }
      resolvePromise(address.port);
    });
  });
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  return port;
}

/** Ports inside the production range (basePort..MAX_PORT) that can be bound right now. */
async function bindablePortsInRange(count: number, from = 5181): Promise<number[]> {
  const found: number[] = [];
  for (let port = from; port <= MAX_PORT && found.length < count; port++) {
    if (await isPortFree(port)) found.push(port);
  }
  if (found.length < count) {
    throw new Error(
      `needed ${count} free ports in ${from}-${MAX_PORT}, found ${found.length}`,
    );
  }
  return found;
}

/** A live child process whose pid can be used in lock files without risking vitest. */
function spawnIdleChild(): ChildProcess {
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], {
    stdio: "ignore",
  });
  openChildren.push(child);
  return child;
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolvePromise) => child.once("exit", () => resolvePromise()));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

let sessionDir: string;
let tempRoot: string;

function writeLockFile(dir: string, port: number, pid: number): void {
  writeFileSync(join(dir, ".server-lock.json"), JSON.stringify({ port, pid }));
}

function lockExists(dir: string): boolean {
  return existsSync(join(dir, ".server-lock.json"));
}

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "server-client-"));
  sessionDir = tempRoot;
});

afterEach(async () => {
  for (const socket of openSockets.splice(0)) socket.destroy();
  for (const server of openServers.splice(0)) await server.close();
  for (const child of openChildren.splice(0)) {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    await waitForExit(child);
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("fetchWithTimeout", () => {
  it("returns the response when the server answers in time", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200);
      res.end("pong");
    });

    const res = await fetchWithTimeout(`http://localhost:${server.port}/ping`, {}, 2000);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("pong");
  });

  it("passes the request options through to the server", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(204);
      res.end();
    });

    await fetchWithTimeout(
      `http://localhost:${server.port}/api/shutdown`,
      { method: "POST" },
      2000,
    );

    expect(server.requests).toEqual([{ url: "/api/shutdown", method: "POST" }]);
  });

  it("rejects when the server does not answer before the timeout", async () => {
    const server = await startServer(() => {
      /* never responds */
    });

    await expect(
      fetchWithTimeout(`http://localhost:${server.port}/hang`, {}, 100),
    ).rejects.toThrow();
  });
});

describe("checkHealth", () => {
  it("returns the health payload of a running server", async () => {
    const server = await healthServer("/some/session/dir", 99);

    expect(await checkHealth(server.port)).toEqual({
      sessionDir: "/some/session/dir",
      pid: 99,
    });
  });

  it("returns null when the server answers with a non-200 status", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(500);
      res.end("boom");
    });

    expect(await checkHealth(server.port)).toBeNull();
  });

  it("returns null when nothing is listening on the port", async () => {
    expect(await checkHealth(await closedPort())).toBeNull();
  });

  it("returns null when the server never answers", async () => {
    const server = await startServer(() => {
      /* never responds */
    });

    expect(await checkHealth(server.port)).toBeNull();
  });

  it("returns null when the server answers with invalid JSON", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("not json");
    });

    expect(await checkHealth(server.port)).toBeNull();
  });
});

describe("isPortFree", () => {
  it("reports a port with a listening server as taken", async () => {
    const server = await healthServer(sessionDir);

    expect(await isPortFree(server.port)).toBe(false);
  });

  it("reports a port nobody listens on as free", async () => {
    expect(await isPortFree(await closedPort())).toBe(true);
  });
});

describe("findFreePort", () => {
  it("returns a bindable port at or above the base port", async () => {
    const [base] = await bindablePortsInRange(2);

    const port = await findFreePort(base);

    expect(port).toBeGreaterThanOrEqual(base);
    expect(port).toBeLessThanOrEqual(MAX_PORT);
    expect(await isPortFree(port)).toBe(true);
  });

  it("skips a port that is already occupied", async () => {
    const [base] = await bindablePortsInRange(2);
    const server = await healthServer(sessionDir, 1, base);

    const port = await findFreePort(base);

    expect(port).toBeGreaterThan(server.port);
    expect(await isPortFree(port)).toBe(true);
  });

  it("throws when the search range holds no free port", async () => {
    await expect(findFreePort(MAX_PORT + 1)).rejects.toThrow(/No free port/);
  });
});

describe("findExistingServer", () => {
  it("returns the locked port when the lock points at a server for this session", async () => {
    const server = await healthServer(sessionDir);
    writeLockFile(sessionDir, server.port, process.pid);

    expect(await findExistingServer(sessionDir, 5181)).toBe(server.port);
    expect(lockExists(sessionDir)).toBe(true);
  });

  it("returns null and clears the lock when the locked process is gone", async () => {
    const child = spawnIdleChild();
    const deadPid = child.pid!;
    child.kill("SIGKILL");
    await waitForExit(child);
    writeLockFile(sessionDir, await closedPort(), deadPid);

    expect(await findExistingServer(sessionDir, MAX_PORT + 1)).toBeNull();
    expect(lockExists(sessionDir)).toBe(false);
  });

  it("kills the locked process and clears the lock when it serves another session", async () => {
    const server = await healthServer("/a/completely/other/dir");
    const child = spawnIdleChild();
    writeLockFile(sessionDir, server.port, child.pid!);

    expect(await findExistingServer(sessionDir, MAX_PORT + 1)).toBeNull();
    await waitForExit(child);
    expect(isAlive(child.pid!)).toBe(false);
    expect(lockExists(sessionDir)).toBe(false);
  });

  it("finds a lock-less server by scanning the port range", async () => {
    const [base] = await bindablePortsInRange(1);
    const server = await healthServer(sessionDir, 7, base);

    expect(await findExistingServer(sessionDir, base)).toBe(server.port);
  });

  it("returns null when no server in the range serves this session", async () => {
    const [base] = await bindablePortsInRange(1);
    await healthServer("/an/unrelated/dir", 7, base);

    expect(await findExistingServer(sessionDir, base)).toBeNull();
  });

  it("ignores an unreadable lock file and falls back to scanning", async () => {
    writeFileSync(join(sessionDir, ".server-lock.json"), "{ broken");
    const [base] = await bindablePortsInRange(1);
    const server = await healthServer(sessionDir, 7, base);

    expect(await findExistingServer(sessionDir, base)).toBe(server.port);
  });
});

describe("stopServer", () => {
  it("asks the locked server to shut down and reports success", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200);
      res.end("{}");
    });
    writeLockFile(sessionDir, server.port, process.pid);

    expect(await stopServer(sessionDir)).toBe(true);
    expect(server.requests).toContainEqual({
      url: "/api/shutdown",
      method: "POST",
    });
    expect(lockExists(sessionDir)).toBe(false);
  });

  it("falls back to SIGTERM when the locked port refuses the connection", async () => {
    const child = spawnIdleChild();
    writeLockFile(sessionDir, await closedPort(), child.pid!);

    expect(await stopServer(sessionDir)).toBe(true);
    await waitForExit(child);
    expect(isAlive(child.pid!)).toBe(false);
    expect(lockExists(sessionDir)).toBe(false);
  });

  it("reports failure when the locked process is already gone", async () => {
    const child = spawnIdleChild();
    const deadPid = child.pid!;
    child.kill("SIGKILL");
    await waitForExit(child);
    writeLockFile(sessionDir, await closedPort(), deadPid);

    expect(await stopServer(sessionDir)).toBe(false);
    expect(lockExists(sessionDir)).toBe(false);
  });

  it("reports failure when there is no lock at all", async () => {
    expect(await stopServer(sessionDir)).toBe(false);
  });
});

describe("clearLock", () => {
  it("removes an existing lock file", () => {
    writeLockFile(sessionDir, 5181, process.pid);

    clearLock(sessionDir);

    expect(lockExists(sessionDir)).toBe(false);
  });

  it("does nothing when there is no lock file", () => {
    expect(() => clearLock(sessionDir)).not.toThrow();
  });

  it("leaves other session files untouched", () => {
    const other = join(sessionDir, "meta.json");
    writeFileSync(other, '{"id":"x"}');
    writeLockFile(sessionDir, 5181, process.pid);

    clearLock(sessionDir);

    expect(readFileSync(other, "utf-8")).toBe('{"id":"x"}');
  });
});

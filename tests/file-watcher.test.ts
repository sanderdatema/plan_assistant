import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { PlanJson } from "../src/lib/types/plan.js";

// file-watcher only uses sse-manager to notify connected browser clients;
// mock it so tests can assert "a broadcast happened" without a real SSE
// connection, while session-manager (which does real disk I/O we want to
// verify) stays unmocked.
vi.mock("../src/lib/server/sse-manager.js", () => ({
  broadcast: vi.fn(),
  broadcastAll: vi.fn(),
}));

let tempDir: string;
let originalSessionDir: string | undefined;

function makePlan(version: number): PlanJson {
  return {
    schemaVersion: 1,
    meta: {
      title: "Test Plan",
      date: "2026-01-01",
      markdownPath: "/test/plan.md",
      projectDir: "/test",
      version,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    overview: "Test overview",
    currentState: "",
    keyDiscoveries: [],
    scopeExclusions: [],
    implementationApproach: "",
    phases: [],
    diagrams: [],
    testingStrategy: { unit: [], integration: [], manual: [] },
    references: [],
  };
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "pa-watcher-test-"));
  originalSessionDir = process.env.SESSION_DIR;
  process.env.SESSION_DIR = tempDir;
  // Each test gets its own chokidar instance watching its own tmp dir:
  // file-watcher keeps `watcher` as module-scoped state (startWatcher() is a
  // no-op on the second call), so we reset the module registry to get a
  // fresh instance per test.
  vi.resetModules();
});

afterEach(() => {
  if (originalSessionDir !== undefined) {
    process.env.SESSION_DIR = originalSessionDir;
  } else {
    delete process.env.SESSION_DIR;
  }
  rmSync(tempDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe("file-watcher", () => {
  it(
    "broadcasts plan-updated and snapshots a version when plan.json changes",
    async () => {
      const { startWatcher } = await import("../src/lib/server/file-watcher.js");
      const { broadcast } = await import("../src/lib/server/sse-manager.js");

      const sessionId = "abcd1234";
      const sessionDir = join(tempDir, sessionId);
      mkdirSync(sessionDir, { recursive: true });
      const planPath = join(sessionDir, "plan.json");

      startWatcher();

      // chokidar needs to (a) finish its initial scan (ignoreInitial) and
      // (b) see the file's size stabilize for awaitWriteFinish (300ms
      // threshold + 100ms poll) before it reports a change. Retry the write
      // on every poll until the watcher has caught one, spaced out far
      // enough that a retry write doesn't itself keep resetting that
      // stability window forever.
      let version = 1;
      await vi.waitFor(
        () => {
          writeFileSync(planPath, JSON.stringify(makePlan(version++)));
          expect(broadcast).toHaveBeenCalledWith(
            sessionId,
            "plan-updated",
            expect.anything(),
          );
        },
        { timeout: 15_000, interval: 750 },
      );

      // chokidar's awaitWriteFinish may coalesce several of the retry
      // writes into a single change event for whichever version was on
      // disk when it stabilized, so assert a version was snapshotted at
      // all rather than pinning an exact version number.
      const snapshotted = readdirSync(join(sessionDir, "versions"));
      expect(snapshotted.some((f) => /^v\d+\.json$/.test(f))).toBe(true);
    },
    20_000,
  );

  it(
    "broadcasts sessions-updated to the wildcard session when meta.json changes",
    async () => {
      const { startWatcher } = await import("../src/lib/server/file-watcher.js");
      const { broadcast } = await import("../src/lib/server/sse-manager.js");

      const sessionId = "abcd1234";
      const sessionDir = join(tempDir, sessionId);
      mkdirSync(sessionDir, { recursive: true });
      const metaPath = join(sessionDir, "meta.json");

      startWatcher();

      let n = 0;
      await vi.waitFor(
        () => {
          writeFileSync(metaPath, JSON.stringify({ updatedAt: Date.now() + n++ }));
          expect(broadcast).toHaveBeenCalledWith("*", "sessions-updated", {});
        },
        { timeout: 15_000, interval: 750 },
      );
    },
    20_000,
  );
});

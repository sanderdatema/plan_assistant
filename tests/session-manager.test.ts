import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SessionMeta } from "../src/lib/types/session.js";
import type { FeedbackPayload } from "../src/lib/types/feedback.js";
import type { PlanJson } from "../src/lib/types/plan.js";

// Import functions under test
import {
  createSession,
  getSession,
  listSessions,
  saveFeedback,
  getFeedback,
  snapshotVersion,
  listVersions,
  getVersion,
  updateSessionStatus,
} from "../src/lib/server/session-manager.js";

let tempDir: string;
let originalSessionDir: string | undefined;

function makeMeta(id: string, overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    id,
    planTitle: "Test Plan",
    markdownPath: "/test/plan.md",
    projectDir: "/test",
    status: "active",
    planVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeFeedback(sessionId: string): FeedbackPayload {
  return {
    schemaVersion: 1,
    planTitle: "Test Plan",
    planVersion: 1,
    sessionId,
    status: "approved",
    phaseStatuses: {},
    subItemStatuses: {},
    comments: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makePlan(version = 1): PlanJson {
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
  tempDir = mkdtempSync(join(tmpdir(), "pa-test-"));
  originalSessionDir = process.env.SESSION_DIR;
  process.env.SESSION_DIR = tempDir;
});

afterEach(() => {
  if (originalSessionDir !== undefined) {
    process.env.SESSION_DIR = originalSessionDir;
  } else {
    delete process.env.SESSION_DIR;
  }
  rmSync(tempDir, { recursive: true, force: true });
});

describe("session-manager", () => {
  describe("createSession", () => {
    it("creates session directory with meta.json and versions/", () => {
      createSession("abcd1234", makeMeta("abcd1234"));
      const sessionDir = join(tempDir, "abcd1234");
      expect(existsSync(join(sessionDir, "meta.json"))).toBe(true);
      expect(existsSync(join(sessionDir, "versions"))).toBe(true);
    });

    it("writes correct meta content", () => {
      const meta = makeMeta("abcd1234", { planTitle: "My Plan" });
      createSession("abcd1234", meta);
      const stored = JSON.parse(
        readFileSync(join(tempDir, "abcd1234", "meta.json"), "utf-8"),
      );
      expect(stored.planTitle).toBe("My Plan");
      expect(stored.id).toBe("abcd1234");
    });
  });

  describe("getSession", () => {
    it("returns meta for existing session", () => {
      createSession("abcd1234", makeMeta("abcd1234"));
      const result = getSession("abcd1234");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("abcd1234");
    });

    it("returns null for nonexistent session", () => {
      expect(getSession("ffffffff")).toBeNull();
    });
  });

  describe("listSessions", () => {
    it("returns empty array when no sessions", () => {
      expect(listSessions()).toEqual([]);
    });

    it("returns sessions sorted by updatedAt descending", () => {
      createSession("aaaa1111", makeMeta("aaaa1111", { updatedAt: "2026-01-01T00:00:00.000Z" }));
      createSession("bbbb2222", makeMeta("bbbb2222", { updatedAt: "2026-01-03T00:00:00.000Z" }));
      createSession("cccc3333", makeMeta("cccc3333", { updatedAt: "2026-01-02T00:00:00.000Z" }));

      const sessions = listSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions[0].id).toBe("bbbb2222");
      expect(sessions[1].id).toBe("cccc3333");
      expect(sessions[2].id).toBe("aaaa1111");
    });
  });

  describe("saveFeedback / getFeedback", () => {
    it("saves and reads feedback", () => {
      createSession("abcd1234", makeMeta("abcd1234"));
      const feedback = makeFeedback("abcd1234");
      saveFeedback("abcd1234", feedback);

      const result = getFeedback("abcd1234");
      expect(result).not.toBeNull();
      expect(result!.status).toBe("approved");
      expect(result!.sessionId).toBe("abcd1234");
    });
  });

  describe("snapshotVersion / listVersions / getVersion", () => {
    it("snapshots a version and lists it", () => {
      createSession("abcd1234", makeMeta("abcd1234"));
      snapshotVersion("abcd1234", makePlan(1));

      const versions = listVersions("abcd1234");
      expect(versions).toEqual([1]);
    });

    it("lists multiple versions sorted", () => {
      createSession("abcd1234", makeMeta("abcd1234"));
      snapshotVersion("abcd1234", makePlan(3));
      snapshotVersion("abcd1234", makePlan(1));
      snapshotVersion("abcd1234", makePlan(2));

      expect(listVersions("abcd1234")).toEqual([1, 2, 3]);
    });

    it("returns empty array for no versions", () => {
      createSession("abcd1234", makeMeta("abcd1234"));
      expect(listVersions("abcd1234")).toEqual([]);
    });

    it("retrieves a specific version", () => {
      createSession("abcd1234", makeMeta("abcd1234"));
      snapshotVersion("abcd1234", makePlan(1));

      const version = getVersion("abcd1234", 1);
      expect(version).not.toBeNull();
      expect(version!.meta.version).toBe(1);
    });

    it("returns null for nonexistent version", () => {
      createSession("abcd1234", makeMeta("abcd1234"));
      expect(getVersion("abcd1234", 99)).toBeNull();
    });
  });

  describe("updateSessionStatus", () => {
    it("updates status and updatedAt", () => {
      createSession("abcd1234", makeMeta("abcd1234", { status: "active" }));

      updateSessionStatus("abcd1234", "approved");

      const updated = getSession("abcd1234");
      expect(updated!.status).toBe("approved");
      expect(updated!.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
    });

    it("throws for nonexistent session", () => {
      expect(() => updateSessionStatus("ffffffff", "approved")).toThrow(
        "Session not found",
      );
    });
  });
});

import { describe, it, expect } from "vitest";
import { selectSessionsToClean } from "../src/cli/commands/clean.js";
import type { SessionEntry } from "../src/cli/session-reader.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeEntry(
  id: string,
  markdownPath: string,
  daysAgo: number,
): SessionEntry {
  const updatedAt = new Date(Date.now() - daysAgo * DAY_MS).toISOString();
  return {
    sessionId: id,
    sessionDir: `/sessions/${id}`,
    meta: {
      id,
      planTitle: `Plan ${id}`,
      markdownPath,
      projectDir: "/project",
      status: "active",
      planVersion: 1,
      createdAt: updatedAt,
      updatedAt,
    },
  };
}

const NOW = Date.now();

describe("selectSessionsToClean", () => {
  it("returns empty array for no sessions", () => {
    const result = selectSessionsToClean([], { all: false, olderThanMs: null }, NOW);
    expect(result).toEqual([]);
  });

  it("selects orphans by default (markdown file missing)", () => {
    const sessions = [
      makeEntry("aaa", "/nonexistent/plan.md", 1),
      makeEntry("bbb", __filename, 1), // this file exists
    ];
    const result = selectSessionsToClean(
      sessions,
      { all: false, olderThanMs: null },
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("aaa");
    expect(result[0].reason).toContain("orphan");
  });

  it("selects all sessions with --all flag", () => {
    const sessions = [
      makeEntry("aaa", __filename, 1),
      makeEntry("bbb", __filename, 2),
    ];
    const result = selectSessionsToClean(
      sessions,
      { all: true, olderThanMs: null },
      NOW,
    );
    expect(result).toHaveLength(2);
    expect(result[0].reason).toBe("all sessions");
  });

  it("selects sessions older than threshold with --older-than", () => {
    const sessions = [
      makeEntry("old", __filename, 10),
      makeEntry("new", __filename, 1),
    ];
    const result = selectSessionsToClean(
      sessions,
      { all: false, olderThanMs: 7 * DAY_MS, olderThanStr: "7d" },
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("old");
    expect(result[0].reason).toContain("older than 7d");
  });

  it("combines --all with --older-than", () => {
    const sessions = [
      makeEntry("old", __filename, 10),
      makeEntry("new", __filename, 1),
    ];
    const result = selectSessionsToClean(
      sessions,
      { all: true, olderThanMs: 7 * DAY_MS, olderThanStr: "7d" },
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("old");
  });

  it("returns empty when all sessions are current with --older-than", () => {
    const sessions = [
      makeEntry("aaa", __filename, 1),
      makeEntry("bbb", __filename, 2),
    ];
    const result = selectSessionsToClean(
      sessions,
      { all: false, olderThanMs: 30 * DAY_MS, olderThanStr: "30d" },
      NOW,
    );
    expect(result).toEqual([]);
  });

  it("orphans are selected even when --older-than is set", () => {
    const sessions = [
      makeEntry("orphan", "/nonexistent.md", 1), // recent orphan
    ];
    const result = selectSessionsToClean(
      sessions,
      { all: false, olderThanMs: 30 * DAY_MS, olderThanStr: "30d" },
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain("orphan");
  });
});

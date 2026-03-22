import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveSession } from "../src/cli/session-resolver.js";
import { sessionIdFromPath } from "../src/cli/markdown-to-plan.js";

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  tempDir = realpathSync(mkdtempSync(join(tmpdir(), "pa-resolver-")));
  originalCwd = process.cwd();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { recursive: true, force: true });
});

describe("resolveSession", () => {
  describe("file path strategy", () => {
    it("resolves a markdown file to its session", () => {
      const mdPath = join(tempDir, "plan.md");
      writeFileSync(mdPath, "# Test Plan");

      const sessionId = sessionIdFromPath(mdPath);
      const sessionDir = join(tempDir, ".plan-sessions", sessionId);
      mkdirSync(sessionDir, { recursive: true });
      writeFileSync(
        join(sessionDir, "meta.json"),
        JSON.stringify({ id: sessionId }),
      );

      const result = resolveSession(mdPath);
      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe(sessionId);
      expect(result!.sessionDir).toBe(sessionDir);
      expect(result!.markdownPath).toBe(mdPath);
    });

    it("returns null for nonexistent file", () => {
      expect(resolveSession("/nonexistent/plan.md")).toBeNull();
    });

    it("returns null when session dir does not exist", () => {
      const mdPath = join(tempDir, "orphan.md");
      writeFileSync(mdPath, "# Orphan Plan");
      // No .plan-sessions/ directory
      expect(resolveSession(mdPath)).toBeNull();
    });
  });

  describe("session ID strategy", () => {
    it("finds session by hex ID scanning from cwd", () => {
      const sessionId = "a1b2c3d4";
      const sessionDir = join(tempDir, ".plan-sessions", sessionId);
      mkdirSync(sessionDir, { recursive: true });
      writeFileSync(
        join(sessionDir, "meta.json"),
        JSON.stringify({ id: sessionId }),
      );

      // Change cwd to tempDir so scan finds .plan-sessions/
      process.chdir(tempDir);

      const result = resolveSession(sessionId);
      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe(sessionId);
      expect(result!.sessionDir).toBe(sessionDir);
    });

    it("finds session from a subdirectory (scans upward)", () => {
      const sessionId = "a1b2c3d4";
      const sessionDir = join(tempDir, ".plan-sessions", sessionId);
      mkdirSync(sessionDir, { recursive: true });
      writeFileSync(
        join(sessionDir, "meta.json"),
        JSON.stringify({ id: sessionId }),
      );

      const subDir = join(tempDir, "sub", "deep");
      mkdirSync(subDir, { recursive: true });
      process.chdir(subDir);

      const result = resolveSession(sessionId);
      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe(sessionId);
    });

    it("lowercases the session ID", () => {
      const sessionId = "a1b2c3d4";
      const sessionDir = join(tempDir, ".plan-sessions", sessionId);
      mkdirSync(sessionDir, { recursive: true });
      writeFileSync(
        join(sessionDir, "meta.json"),
        JSON.stringify({ id: sessionId }),
      );

      process.chdir(tempDir);
      const result = resolveSession("A1B2C3D4");
      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe(sessionId);
    });

    it("returns null for nonexistent session ID", () => {
      process.chdir(tempDir);
      expect(resolveSession("deadbeef")).toBeNull();
    });
  });
});

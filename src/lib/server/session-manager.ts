import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { SessionMeta } from "../types/session.js";
import type { PlanJson } from "../types/plan.js";
import type { FeedbackPayload } from "../types/feedback.js";

/**
 * Session storage root directory.
 *
 * The CLI creates sessions in `.plan-sessions/` adjacent to the markdown file,
 * then passes that path to the server via the `SESSION_DIR` env var when spawning it.
 * The fallback (`~/.plan-assistant/sessions`) is only used when the server runs standalone.
 */
export function getBaseDir(): string {
  return (
    process.env.SESSION_DIR || join(homedir(), ".plan-assistant", "sessions")
  );
}

export function validateSessionId(sessionId: string): void {
  if (!/^[a-f0-9]{1,16}$/.test(sessionId)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }
}

function getSessionDir(sessionId: string): string {
  validateSessionId(sessionId);
  return join(getBaseDir(), sessionId);
}

// ── Shared JSON read helper ──────────────────────────────────────

export function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

// ── Path-based reads (used by CLI via session-reader) ────────────

export function readMeta(sessionDir: string): SessionMeta | null {
  return readJsonFile<SessionMeta>(join(sessionDir, "meta.json"));
}

export function readFeedbackByDir(sessionDir: string): FeedbackPayload | null {
  return readJsonFile<FeedbackPayload>(join(sessionDir, "feedback.json"));
}

export function readPlanByDir(sessionDir: string): PlanJson | null {
  return readJsonFile<PlanJson>(join(sessionDir, "plan.json"));
}

// ── ID-based reads (used by server routes) ───────────────────────

export function listSessions(): SessionMeta[] {
  const baseDir = getBaseDir();
  mkdirSync(baseDir, { recursive: true });
  const entries = readdirSync(baseDir, { withFileTypes: true });
  const sessions: SessionMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = readJsonFile<SessionMeta>(join(baseDir, entry.name, "meta.json"));
    if (meta) sessions.push(meta);
  }

  return sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getSession(sessionId: string): SessionMeta | null {
  return readMeta(getSessionDir(sessionId));
}

export function createSession(sessionId: string, meta: SessionMeta): void {
  const dir = getSessionDir(sessionId);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "versions"), { recursive: true });
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
}

export function getPlan(sessionId: string): PlanJson | null {
  return readPlanByDir(getSessionDir(sessionId));
}

export function getFeedback(sessionId: string): FeedbackPayload | null {
  return readFeedbackByDir(getSessionDir(sessionId));
}

export function saveFeedback(
  sessionId: string,
  feedback: FeedbackPayload,
): void {
  const dir = getSessionDir(sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "feedback.json"), JSON.stringify(feedback, null, 2));
}

export function snapshotVersion(sessionId: string, plan: PlanJson): void {
  const dir = join(getSessionDir(sessionId), "versions");
  mkdirSync(dir, { recursive: true });
  const versionFile = join(dir, `v${plan.meta.version}.json`);
  writeFileSync(versionFile, JSON.stringify(plan, null, 2));
}

export function listVersions(sessionId: string): number[] {
  const dir = join(getSessionDir(sessionId), "versions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith("v") && f.endsWith(".json"))
    .map((f) => parseInt(f.slice(1, -5), 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);
}

export function updateSessionStatus(
  sessionId: string,
  status: SessionMeta["status"],
): void {
  const meta = getSession(sessionId);
  if (!meta) throw new Error(`Session not found: ${sessionId}`);
  const updated: SessionMeta = {
    ...meta,
    status,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(getSessionDir(sessionId), "meta.json"),
    JSON.stringify(updated, null, 2),
  );
}

export function getVersion(
  sessionId: string,
  version: number,
): PlanJson | null {
  const versionPath = join(
    getSessionDir(sessionId),
    "versions",
    `v${version}.json`,
  );
  if (!existsSync(versionPath)) return null;
  try {
    return JSON.parse(readFileSync(versionPath, "utf-8")) as PlanJson;
  } catch {
    return null;
  }
}

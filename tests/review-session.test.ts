import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Orchestration tests for the `review` command.
 *
 * `src/cli/review-session.ts` holds the session setup (`prepareSession`) and the
 * markdown watcher; the server/browser orchestration the ticket describes lives
 * in `src/cli/commands/review.ts` and drives those two. Both are covered here:
 * `prepareSession` runs for real against a temp directory, while the server
 * client, the feedback waiter and chokidar are mocked so no process is spawned,
 * no port is opened and no browser window is opened.
 */

const serverClient = vi.hoisted(() => ({
  DEFAULT_BASE_PORT: 5181,
  MAX_PORT: 5199,
  findExistingServer: vi.fn(),
  checkHealth: vi.fn(),
  isPortFree: vi.fn(),
  findFreePort: vi.fn(),
  launchServer: vi.fn(),
  openBrowser: vi.fn(),
}));

const awaitReviewFeedback = vi.hoisted(() => vi.fn());
const watcher = vi.hoisted(() => ({ on: vi.fn(), close: vi.fn() }));
const chokidarWatch = vi.hoisted(() => vi.fn());

vi.mock("../src/cli/server-client.js", () => serverClient);
vi.mock("../src/cli/session-reader.js", () => ({ awaitReviewFeedback }));
vi.mock("chokidar", () => ({ watch: chokidarWatch }));

import { review } from "../src/cli/commands/review.js";
import { prepareSession } from "../src/cli/review-session.js";
import { CliError } from "../src/cli/errors.js";
import type { ParsedArgs } from "../src/cli/index.js";

const PLAN_MD = `# Fix Login Bug

## Phase 1: Patch Token Validation

### Changes Required:

#### 1. Fix expiry check

**File**: \`src/auth.ts\`

The token expiry comparison is off by one.

### Success Criteria:

- [ ] \`npm test\`
`;

let tempDir: string;
let planPath: string;
let stdout: ReturnType<typeof vi.spyOn>;
let stderr: ReturnType<typeof vi.spyOn>;
let errorLog: ReturnType<typeof vi.spyOn>;
let stdoutLines: string[];

function args(positional: string[], flags: Record<string, string | boolean> = {}): ParsedArgs {
  return { command: "review", positional, flags };
}

/** The `ready` event the CLI prints on stdout for the calling agent. */
function readyEvent(): Record<string, unknown> {
  const line = stdoutLines.find((l) => l.includes('"event":"ready"'));
  if (!line) throw new Error(`no ready event in stdout: ${stdoutLines.join("|")}`);
  return JSON.parse(line);
}

function sessionDirOf(dir: string): string {
  return join(dir, ".plan-sessions");
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "review-session-"));
  planPath = join(tempDir, "plan.md");
  writeFileSync(planPath, PLAN_MD);

  stdoutLines = [];
  stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdoutLines.push(String(chunk).trim());
    return true;
  });
  stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

  serverClient.findExistingServer.mockResolvedValue(null);
  serverClient.checkHealth.mockResolvedValue(null);
  serverClient.isPortFree.mockResolvedValue(true);
  serverClient.findFreePort.mockResolvedValue(5181);
  serverClient.launchServer.mockResolvedValue(undefined);
  serverClient.openBrowser.mockReturnValue(undefined);
  awaitReviewFeedback.mockResolvedValue(undefined);
  chokidarWatch.mockReturnValue(watcher);
});

afterEach(() => {
  vi.clearAllMocks();
  stdout.mockRestore();
  stderr.mockRestore();
  errorLog.mockRestore();
  delete process.env.PLAN_ASSISTANT_PORT;
  delete process.env.PLAN_ASSISTANT_HOST;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("prepareSession", () => {
  it("writes meta, plan and a version snapshot for a fresh plan", () => {
    const session = prepareSession(planPath);

    expect(session.version).toBe(1);
    expect(existsSync(join(session.sessionPath, "meta.json"))).toBe(true);
    expect(existsSync(join(session.sessionPath, "versions", "v1.json"))).toBe(true);

    const meta = JSON.parse(readFileSync(join(session.sessionPath, "meta.json"), "utf-8"));
    expect(meta.planTitle).toBe("Fix Login Bug");
    expect(meta.markdownPath).toBe(planPath);
    expect(meta.status).toBe("active");
  });

  it("parses the phases of the markdown into the session plan", () => {
    const session = prepareSession(planPath);

    const plan = JSON.parse(readFileSync(join(session.sessionPath, "plan.json"), "utf-8"));
    expect(plan.phases).toHaveLength(1);
    expect(plan.phases[0].name).toContain("Patch Token Validation");
    expect(plan.phases[0].number).toBe(1);
  });

  it("increments the version on a second review of the same file", () => {
    prepareSession(planPath);

    const second = prepareSession(planPath);

    expect(second.version).toBe(2);
    expect(existsSync(join(second.sessionPath, "versions", "v2.json"))).toBe(true);
  });

  it("clears feedback left behind by the previous review cycle", () => {
    const first = prepareSession(planPath);
    const feedbackPath = join(first.sessionPath, "feedback.json");
    writeFileSync(feedbackPath, '{"status":"approved"}');

    prepareSession(planPath);

    expect(existsSync(feedbackPath)).toBe(false);
  });

  it("throws a CliError when the markdown file does not exist", () => {
    expect(() => prepareSession(join(tempDir, "nope.md"))).toThrow(CliError);
  });

  it("warns when the markdown holds no phases", () => {
    const emptyPath = join(tempDir, "empty.md");
    writeFileSync(emptyPath, "# Just a title\n\nSome prose.\n");

    const session = prepareSession(emptyPath);

    expect(session.plan.phases).toHaveLength(0);
    expect(errorLog.mock.calls.flat().join("\n")).toContain("No phases found");
  });
});

describe("review — reusing a running server", () => {
  it("does not start a server when one already serves this session", async () => {
    serverClient.findExistingServer.mockResolvedValue(5182);

    await review(args([planPath]));

    expect(serverClient.findExistingServer).toHaveBeenCalledWith(
      sessionDirOf(tempDir),
      5181,
    );
    expect(serverClient.launchServer).not.toHaveBeenCalled();
    expect(serverClient.findFreePort).not.toHaveBeenCalled();
    expect(readyEvent().url).toContain(":5182/plan/");
  });

  it("opens the browser on the url of the reused server", async () => {
    serverClient.findExistingServer.mockResolvedValue(5182);

    await review(args([planPath]));

    const { url } = readyEvent();
    expect(serverClient.openBrowser).toHaveBeenCalledWith(url);
  });

  it("waits for feedback on the session feedback file", async () => {
    serverClient.findExistingServer.mockResolvedValue(5182);

    await review(args([planPath]));

    expect(awaitReviewFeedback).toHaveBeenCalledTimes(1);
    const [feedbackPath, sessionId, planTitle] = awaitReviewFeedback.mock.calls[0];
    expect(feedbackPath).toBe(readyEvent().feedbackPath);
    expect(sessionId).toBe(readyEvent().sessionId);
    expect(planTitle).toBe("Fix Login Bug");
  });

  it("adopts a foreign server and links the session into it with --reuse", async () => {
    const foreignDir = join(tempDir, "foreign-sessions");
    serverClient.findExistingServer.mockResolvedValue(null);
    serverClient.checkHealth.mockImplementation(async (port: number) =>
      port === 5181 ? { sessionDir: foreignDir, pid: 1 } : null,
    );

    await review(args([planPath], { reuse: true }));

    expect(serverClient.launchServer).not.toHaveBeenCalled();
    expect(readyEvent().url).toContain(":5181/plan/");
    expect(existsSync(join(foreignDir, String(readyEvent().sessionId)))).toBe(true);
  });

  it("does not scan for foreign servers without --reuse", async () => {
    await review(args([planPath]));

    expect(serverClient.checkHealth).not.toHaveBeenCalledWith(5181);
    expect(serverClient.launchServer).toHaveBeenCalled();
  });
});

describe("review — starting a new server", () => {
  it("launches a server on a free port when none is running", async () => {
    serverClient.findFreePort.mockResolvedValue(5185);

    await review(args([planPath]));

    expect(serverClient.findFreePort).toHaveBeenCalledWith(5181);
    expect(serverClient.launchServer).toHaveBeenCalledWith(sessionDirOf(tempDir), 5185);
    expect(readyEvent().url).toContain(":5185/plan/");
  });

  it("uses an explicitly requested port when it is free", async () => {
    await review(args([planPath], { port: "5190" }));

    expect(serverClient.isPortFree).toHaveBeenCalledWith(5190);
    expect(serverClient.findFreePort).not.toHaveBeenCalled();
    expect(serverClient.launchServer).toHaveBeenCalledWith(sessionDirOf(tempDir), 5190);
  });

  it("takes the requested port from the environment", async () => {
    process.env.PLAN_ASSISTANT_PORT = "5191";

    await review(args([planPath]));

    expect(serverClient.launchServer).toHaveBeenCalledWith(sessionDirOf(tempDir), 5191);
  });

  it("searches upward from a requested base port when reusing fails", async () => {
    serverClient.findFreePort.mockResolvedValue(5195);

    await review(args([planPath], { port: "5195" }));

    expect(serverClient.launchServer).toHaveBeenCalledWith(sessionDirOf(tempDir), 5195);
  });

  it("reports the session and feedback paths in the ready event", async () => {
    await review(args([planPath]));

    const event = readyEvent();
    expect(event.planVersion).toBe(1);
    expect(String(event.feedbackPath)).toContain(".plan-sessions");
    expect(String(event.feedbackPath)).toContain("feedback.json");
  });

  it("watches the markdown file for changes", async () => {
    await review(args([planPath]));

    expect(chokidarWatch).toHaveBeenCalledWith(planPath, expect.anything());
    expect(awaitReviewFeedback.mock.calls[0][3]).toBe(watcher);
  });
});

describe("review — host handling", () => {
  it("uses the host flag in the review url and skips the browser", async () => {
    serverClient.findExistingServer.mockResolvedValue(5182);

    await review(args([planPath], { host: "0.0.0.0" }));

    expect(readyEvent().url).toContain("http://0.0.0.0:5182/");
    expect(serverClient.openBrowser).not.toHaveBeenCalled();
  });

  it("takes the host from the environment", async () => {
    process.env.PLAN_ASSISTANT_HOST = "sandbox.local";
    serverClient.findExistingServer.mockResolvedValue(5182);

    await review(args([planPath]));

    expect(readyEvent().url).toContain("http://sandbox.local:5182/");
  });
});

describe("review — error paths", () => {
  it("refuses to run without a markdown file", async () => {
    await expect(review(args([]))).rejects.toThrow(CliError);
    expect(serverClient.launchServer).not.toHaveBeenCalled();
  });

  it("refuses a markdown file that does not exist", async () => {
    await expect(review(args([join(tempDir, "missing.md")]))).rejects.toThrow(
      /File not found/,
    );
    expect(serverClient.launchServer).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric --port", async () => {
    await expect(review(args([planPath], { port: "abc" }))).rejects.toThrow(
      /Invalid port number/,
    );
  });

  it("rejects a non-numeric PLAN_ASSISTANT_PORT", async () => {
    process.env.PLAN_ASSISTANT_PORT = "abc";

    await expect(review(args([planPath]))).rejects.toThrow(/Invalid PLAN_ASSISTANT_PORT/);
  });

  it("refuses to start when the requested port is taken by another plan-assistant", async () => {
    serverClient.isPortFree.mockResolvedValue(false);
    serverClient.checkHealth.mockResolvedValue({ sessionDir: "/other", pid: 3 });

    await expect(review(args([planPath], { port: "5190" }))).rejects.toThrow(
      /already in use/,
    );
    expect(serverClient.launchServer).not.toHaveBeenCalled();
    expect(errorLog.mock.calls.flat().join("\n")).toContain("already used by Plan Assistant");
  });

  it("refuses to start when the requested port is taken by an unrelated process", async () => {
    serverClient.isPortFree.mockResolvedValue(false);
    serverClient.checkHealth.mockResolvedValue(null);

    await expect(review(args([planPath], { port: "5190" }))).rejects.toThrow(
      /already in use/,
    );
    expect(errorLog.mock.calls.flat().join("\n")).toContain("another process");
  });

  it("propagates a failure to launch the server", async () => {
    serverClient.launchServer.mockRejectedValue(new Error("Server failed to start"));

    await expect(review(args([planPath]))).rejects.toThrow(/Server failed to start/);
    expect(awaitReviewFeedback).not.toHaveBeenCalled();
  });

  it("propagates a failure to find a free port", async () => {
    serverClient.findFreePort.mockRejectedValue(new Error("No free port found"));

    await expect(review(args([planPath]))).rejects.toThrow(/No free port found/);
    expect(serverClient.launchServer).not.toHaveBeenCalled();
  });
});

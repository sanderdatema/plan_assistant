import { describe, it, expect } from "vitest";
import { CliError, CliExitCode } from "../src/cli/errors.js";
import { validateSessionId } from "../src/lib/server/session-manager.js";

describe("CliError", () => {
  it("stores message and exitCode", () => {
    const err = new CliError("not found", 1);
    expect(err.message).toBe("not found");
    expect(err.exitCode).toBe(1);
  });

  it("defaults exitCode to 1", () => {
    const err = new CliError("fail");
    expect(err.exitCode).toBe(1);
  });

  it("is an instance of Error", () => {
    const err = new CliError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("has name CliError", () => {
    const err = new CliError("test");
    expect(err.name).toBe("CliError");
  });
});

describe("CliExitCode", () => {
  it("stores exitCode", () => {
    const exit = new CliExitCode(3);
    expect(exit.exitCode).toBe(3);
  });

  it("is not an Error instance", () => {
    const exit = new CliExitCode(0);
    expect(exit).not.toBeInstanceOf(Error);
  });
});

describe("validateSessionId", () => {
  it("accepts valid 8-char hex ID", () => {
    expect(() => validateSessionId("a3f7c1e2")).not.toThrow();
  });

  it("accepts valid 16-char hex ID", () => {
    expect(() => validateSessionId("a3f7c1e2b4d6e8f0")).not.toThrow();
  });

  it("accepts single hex char", () => {
    expect(() => validateSessionId("a")).not.toThrow();
  });

  it("rejects path traversal", () => {
    expect(() => validateSessionId("../../etc")).toThrow("Invalid session ID");
  });

  it("rejects ../ prefix", () => {
    expect(() => validateSessionId("../secret")).toThrow("Invalid session ID");
  });

  it("rejects empty string", () => {
    expect(() => validateSessionId("")).toThrow("Invalid session ID");
  });

  it("rejects non-hex characters", () => {
    expect(() => validateSessionId("abcdefgh")).toThrow("Invalid session ID");
  });

  it("rejects uppercase hex", () => {
    expect(() => validateSessionId("A3F7C1E2")).toThrow("Invalid session ID");
  });

  it("rejects IDs longer than 16 chars", () => {
    expect(() => validateSessionId("a3f7c1e2b4d6e8f01")).toThrow("Invalid session ID");
  });

  it("rejects slashes", () => {
    expect(() => validateSessionId("abc/def")).toThrow("Invalid session ID");
  });
});

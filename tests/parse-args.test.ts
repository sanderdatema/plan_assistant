import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/cli/index.js";

describe("parseArgs", () => {
  it("extracts command from first argument", () => {
    const result = parseArgs(["review", "plan.md"]);
    expect(result.command).toBe("review");
  });

  it("defaults to help when no arguments", () => {
    const result = parseArgs([]);
    expect(result.command).toBe("help");
    expect(result.positional).toEqual([]);
    expect(result.flags).toEqual({});
  });

  it("collects positional arguments", () => {
    const result = parseArgs(["review", "plan.md", "other.md"]);
    expect(result.positional).toEqual(["plan.md", "other.md"]);
  });

  it("parses --flag as boolean", () => {
    const result = parseArgs(["status", "--wait"]);
    expect(result.flags.wait).toBe(true);
  });

  it("parses --key=value", () => {
    const result = parseArgs(["review", "--port=5199"]);
    expect(result.flags.port).toBe("5199");
  });

  it("parses --key value (space-separated)", () => {
    const result = parseArgs(["review", "--output", "out.html"]);
    expect(result.flags.output).toBe("out.html");
  });

  it("parses -k shorthand as boolean", () => {
    const result = parseArgs(["list", "-p"]);
    expect(result.flags.p).toBe(true);
  });

  it("parses -k value shorthand", () => {
    const result = parseArgs(["review", "-o", "out.html"]);
    expect(result.flags.o).toBe("out.html");
  });

  it("handles mixed positional args and flags", () => {
    const result = parseArgs(["review", "plan.md", "--pretty", "--port", "5199"]);
    expect(result.command).toBe("review");
    expect(result.positional).toEqual(["plan.md"]);
    expect(result.flags.pretty).toBe(true);
    expect(result.flags.port).toBe("5199");
  });

  it("treats --flag followed by another --flag as boolean", () => {
    const result = parseArgs(["status", "--wait", "--pretty"]);
    expect(result.flags.wait).toBe(true);
    expect(result.flags.pretty).toBe(true);
  });

  it("does not consume positional as value for known boolean flags", () => {
    const result = parseArgs(["status", "--wait", "plan.md"]);
    expect(result.flags.wait).toBe(true);
    expect(result.positional).toEqual(["plan.md"]);
  });

  it("treats --no-wait as boolean even when followed by positional", () => {
    const result = parseArgs(["review", "--no-wait", "plan.md"]);
    expect(result.flags["no-wait"]).toBe(true);
    expect(result.positional).toEqual(["plan.md"]);
  });

  it("treats --reuse as boolean even when followed by positional", () => {
    const result = parseArgs(["review", "--reuse", "plan.md"]);
    expect(result.flags.reuse).toBe(true);
    expect(result.positional).toEqual(["plan.md"]);
  });
});

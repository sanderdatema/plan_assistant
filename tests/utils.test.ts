import { describe, it, expect } from "vitest";
import { parseDuration } from "../src/cli/utils.js";

describe("parseDuration", () => {
  it("parses milliseconds", () => {
    expect(parseDuration("500ms")).toBe(500);
  });

  it("parses seconds", () => {
    expect(parseDuration("30s")).toBe(30_000);
  });

  it("parses minutes", () => {
    expect(parseDuration("5m")).toBe(300_000);
  });

  it("parses hours", () => {
    expect(parseDuration("24h")).toBe(86_400_000);
  });

  it("parses days", () => {
    expect(parseDuration("7d")).toBe(604_800_000);
  });

  it("parses weeks", () => {
    expect(parseDuration("2w")).toBe(1_209_600_000);
  });

  it("returns 0 for zero value", () => {
    expect(parseDuration("0s")).toBe(0);
  });

  it("returns null for empty string", () => {
    expect(parseDuration("")).toBeNull();
  });

  it("returns null for invalid unit", () => {
    expect(parseDuration("7x")).toBeNull();
  });

  it("returns null for non-numeric value", () => {
    expect(parseDuration("abc")).toBeNull();
  });

  it("returns null for reversed format", () => {
    expect(parseDuration("d7")).toBeNull();
  });

  it("returns null for negative values", () => {
    expect(parseDuration("-5d")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { aggregateSubItemStatuses } from "../src/lib/stores/feedback.svelte.js";

describe("aggregateSubItemStatuses", () => {
  it("returns pending for empty array", () => {
    expect(aggregateSubItemStatuses([])).toBe("pending");
  });

  it("returns the status when all items match", () => {
    expect(aggregateSubItemStatuses(["approved", "approved", "approved"])).toBe(
      "approved",
    );
  });

  it("returns pending when statuses are mixed", () => {
    expect(
      aggregateSubItemStatuses(["approved", "needs-work", "approved"]),
    ).toBe("pending");
  });

  it("returns needs-work when all items are needs-work", () => {
    expect(
      aggregateSubItemStatuses(["needs-work", "needs-work"]),
    ).toBe("needs-work");
  });

  it("returns the single status for a one-element array", () => {
    expect(aggregateSubItemStatuses(["approved"])).toBe("approved");
  });
});

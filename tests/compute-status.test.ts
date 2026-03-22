import { describe, it, expect } from "vitest";
import {
  computeStatus,
  computeSummary,
  EXIT_APPROVED,
  EXIT_NEEDS_WORK,
  EXIT_REVIEWING,
  EXIT_NO_FEEDBACK,
} from "../src/cli/commands/status.js";
import type { FeedbackPayload } from "../src/lib/types/index.js";

function makeFeedback(overrides: Partial<FeedbackPayload> = {}): FeedbackPayload {
  return {
    schemaVersion: 1,
    planTitle: "Test",
    planVersion: 1,
    sessionId: "test1234",
    status: "reviewing",
    phaseStatuses: {},
    subItemStatuses: {},
    comments: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeStatus", () => {
  it("returns exitCode 5 for null feedback", () => {
    const result = computeStatus(null);
    expect(result.exitCode).toBe(EXIT_NO_FEEDBACK);
    expect(result.feedbackStatus).toBe("none");
  });

  it("returns exitCode 0 for approved feedback", () => {
    const result = computeStatus(makeFeedback({ status: "approved" }));
    expect(result.exitCode).toBe(EXIT_APPROVED);
    expect(result.feedbackStatus).toBe("approved");
  });

  it("returns exitCode 3 for needs-work feedback", () => {
    const result = computeStatus(makeFeedback({ status: "needs-work" }));
    expect(result.exitCode).toBe(EXIT_NEEDS_WORK);
    expect(result.feedbackStatus).toBe("needs-work");
  });

  it("returns exitCode 4 for reviewing feedback", () => {
    const result = computeStatus(makeFeedback({ status: "reviewing" }));
    expect(result.exitCode).toBe(EXIT_REVIEWING);
    expect(result.feedbackStatus).toBe("reviewing");
  });
});

describe("computeSummary", () => {
  it("returns zero counts for null feedback", () => {
    const result = computeSummary(null);
    expect(result.phaseSummary).toEqual({ total: 0, approved: 0, needsWork: 0, pending: 0 });
    expect(result.commentSummary).toEqual({ total: 0, unresolved: 0 });
  });

  it("counts phase statuses correctly", () => {
    const feedback = makeFeedback({
      phaseStatuses: {
        "phase-1": { phaseId: "phase-1", status: "approved" },
        "phase-2": { phaseId: "phase-2", status: "needs-work" },
        "phase-3": { phaseId: "phase-3", status: "pending" },
        "phase-4": { phaseId: "phase-4", status: "approved" },
      },
    });
    const result = computeSummary(feedback);
    expect(result.phaseSummary).toEqual({ total: 4, approved: 2, needsWork: 1, pending: 1 });
  });

  it("counts resolved and unresolved comments", () => {
    const feedback = makeFeedback({
      comments: [
        { id: "1", section: "s", phaseId: "p1", comment: "fix this", resolved: false, createdAt: "", quote: "" },
        { id: "2", section: "s", phaseId: "p1", comment: "done", resolved: true, createdAt: "", quote: "" },
        { id: "3", section: "s", phaseId: "p2", comment: "also fix", resolved: false, createdAt: "", quote: "" },
      ],
    });
    const result = computeSummary(feedback);
    expect(result.commentSummary).toEqual({ total: 3, unresolved: 2 });
  });
});

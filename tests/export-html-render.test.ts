import { describe, it, expect } from "vitest";
import { renderPlanToHtml } from "../src/cli/export-html.js";
import type { PlanJson } from "../src/lib/types/plan.js";
import type { FeedbackPayload } from "../src/lib/types/feedback.js";

function makePlan(overrides: Partial<PlanJson> = {}): PlanJson {
  return {
    schemaVersion: 1,
    meta: {
      title: "Test Plan",
      date: "2026-01-01",
      markdownPath: "/test/plan.md",
      projectDir: "/test",
      version: 1,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
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
    ...overrides,
  };
}

function makeFeedback(
  overrides: Partial<FeedbackPayload> = {},
): FeedbackPayload {
  return {
    schemaVersion: 1,
    planTitle: "Test Plan",
    planVersion: 1,
    sessionId: "abcd1234",
    status: "reviewing",
    phaseStatuses: {},
    subItemStatuses: {},
    comments: [],
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

describe("renderPlanToHtml", () => {
  it("renders title and overview", () => {
    const html = renderPlanToHtml(makePlan(), null);
    expect(html).toContain("<title>Test Plan</title>");
    expect(html).toContain("Test overview");
  });

  it("renders phase names and numbers", () => {
    const plan = makePlan({
      phases: [
        {
          id: "p1",
          number: 1,
          name: "Setup",
          overview: "Setup phase",
          subItems: [],
          changes: [],
          successCriteria: { automated: [], manual: [] },
        },
      ],
    });
    const html = renderPlanToHtml(plan, null);
    expect(html).toContain("Phase 1: Setup");
    expect(html).toContain("Setup phase");
  });

  it("renders changes with component names and file paths", () => {
    const plan = makePlan({
      phases: [
        {
          id: "p1",
          number: 1,
          name: "Changes",
          overview: "",
          subItems: [],
          changes: [
            {
              componentName: "AuthModule",
              filePath: "src/auth.ts",
              description: "Add JWT validation",
            },
          ],
          successCriteria: { automated: [], manual: [] },
        },
      ],
    });
    const html = renderPlanToHtml(plan, null);
    expect(html).toContain("AuthModule");
    expect(html).toContain("src/auth.ts");
    expect(html).toContain("Add JWT validation");
  });

  it("renders success criteria", () => {
    const plan = makePlan({
      phases: [
        {
          id: "p1",
          number: 1,
          name: "Test",
          overview: "",
          subItems: [],
          changes: [],
          successCriteria: {
            automated: [
              { id: "c1", text: "Tests pass", command: "npm test" },
            ],
            manual: [{ id: "c2", text: "UI renders correctly" }],
          },
        },
      ],
    });
    const html = renderPlanToHtml(plan, null);
    expect(html).toContain("Tests pass");
    expect(html).toContain("npm test");
    expect(html).toContain("UI renders correctly");
  });

  it("renders no status badge when feedback is null", () => {
    const html = renderPlanToHtml(makePlan(), null);
    // No status badge span with status text
    expect(html).not.toMatch(/approved|needs-work|reviewing/);
  });

  it("renders approved badge with green background", () => {
    const html = renderPlanToHtml(
      makePlan(),
      makeFeedback({ status: "approved" }),
    );
    expect(html).toContain("approved");
    expect(html).toContain("#22c55e"); // green
  });

  it("renders needs-work badge with red background", () => {
    const html = renderPlanToHtml(
      makePlan(),
      makeFeedback({ status: "needs-work" }),
    );
    expect(html).toContain("needs-work");
    expect(html).toContain("#ef4444"); // red
  });

  it("renders phase status badges from feedback", () => {
    const plan = makePlan({
      phases: [
        {
          id: "p1",
          number: 1,
          name: "Phase One",
          overview: "",
          subItems: [],
          changes: [],
          successCriteria: { automated: [], manual: [] },
        },
      ],
    });
    const feedback = makeFeedback({
      phaseStatuses: {
        p1: { phaseId: "p1", status: "approved" },
      },
    });
    const html = renderPlanToHtml(plan, feedback);
    // Should have the phase-level approved badge
    expect(html).toContain("#22c55e"); // green for approved phase
  });

  it("renders comments in the correct phase section", () => {
    const plan = makePlan({
      phases: [
        {
          id: "p1",
          number: 1,
          name: "Phase One",
          overview: "",
          subItems: [],
          changes: [],
          successCriteria: { automated: [], manual: [] },
        },
      ],
    });
    const feedback = makeFeedback({
      comments: [
        {
          id: "c1",
          section: "Phase 1",
          quote: "some quote",
          comment: "Phase-specific comment",
          phaseId: "p1",
          resolved: false,
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "c2",
          section: "Overview",
          quote: "",
          comment: "General comment here",
          resolved: false,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const html = renderPlanToHtml(plan, feedback);
    expect(html).toContain("Phase-specific comment");
    expect(html).toContain("General comment here");
    expect(html).toContain("General Comments");
  });

  it("renders resolved comments with opacity style", () => {
    const plan = makePlan({
      phases: [
        {
          id: "p1",
          number: 1,
          name: "Phase One",
          overview: "",
          subItems: [],
          changes: [],
          successCriteria: { automated: [], manual: [] },
        },
      ],
    });
    const feedback = makeFeedback({
      comments: [
        {
          id: "c1",
          section: "Phase 1",
          quote: "text",
          comment: "Resolved issue",
          phaseId: "p1",
          resolved: true,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const html = renderPlanToHtml(plan, feedback);
    expect(html).toContain("opacity:0.5");
    expect(html).toContain("(resolved)");
  });

  it("escapes HTML in user content", () => {
    const plan = makePlan({
      overview: '<script>alert("xss")</script>',
    });
    const html = renderPlanToHtml(plan, null);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

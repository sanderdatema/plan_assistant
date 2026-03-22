import { describe, it, expect } from "vitest";
import { diffPlans } from "../src/lib/utils/diff.js";
import type { PlanJson } from "../src/lib/types/plan.js";

function makePlan(overrides: Partial<PlanJson> = {}): PlanJson {
  return {
    schemaVersion: 1,
    meta: {
      title: "Test Plan",
      date: "2025-01-01",
      markdownPath: "/test/plan.md",
      projectDir: "/test",
      version: 1,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    },
    overview: "Overview text",
    currentState: "Current state",
    implementationApproach: "Approach",
    keyDiscoveries: [],
    scopeExclusions: [],
    phases: [],
    testingStrategy: { unit: [], integration: [], manual: [] },
    diagrams: [],
    references: [],
    ...overrides,
  };
}

function makePhase(id: string, number: number, name: string, overview = ""): PlanJson["phases"][0] {
  return {
    id,
    number,
    name,
    overview,
    subItems: [],
    changes: [],
    successCriteria: { automated: [], manual: [] },
    content: "",
  };
}

describe("diffPlans", () => {
  it("returns empty array for identical plans", () => {
    const plan = makePlan();
    expect(diffPlans(plan, plan)).toEqual([]);
  });

  it("detects changed overview", () => {
    const old = makePlan({ overview: "Old overview" });
    const updated = makePlan({ overview: "New overview" });
    const diffs = diffPlans(old, updated);
    const overviewDiff = diffs.find((d) => d.section === "Overview");
    expect(overviewDiff).toBeDefined();
    expect(overviewDiff!.status).toBe("changed");
    expect(overviewDiff!.oldValue).toBe("Old overview");
    expect(overviewDiff!.newValue).toBe("New overview");
  });

  it("detects added phase", () => {
    const old = makePlan({ phases: [] });
    const updated = makePlan({
      phases: [makePhase("p1", 1, "Setup", "Setup phase")],
    });
    const diffs = diffPlans(old, updated);
    const phaseDiff = diffs.find((d) => d.section === "Phase 1: Setup");
    expect(phaseDiff).toBeDefined();
    expect(phaseDiff!.status).toBe("added");
  });

  it("detects removed phase", () => {
    const old = makePlan({
      phases: [makePhase("p1", 1, "Old", "Old phase")],
    });
    const updated = makePlan({ phases: [] });
    const diffs = diffPlans(old, updated);
    const phaseDiff = diffs.find((d) => d.section === "Phase 1: Old");
    expect(phaseDiff).toBeDefined();
    expect(phaseDiff!.status).toBe("removed");
  });

  it("detects changed implementation approach", () => {
    const old = makePlan({ implementationApproach: "Old approach" });
    const updated = makePlan({ implementationApproach: "New approach" });
    const diffs = diffPlans(old, updated);
    const diff = diffs.find((d) => d.section === "Implementation Approach");
    expect(diff).toBeDefined();
    expect(diff!.status).toBe("changed");
  });

  it("detects added section (empty to non-empty)", () => {
    const old = makePlan({ currentState: "" });
    const updated = makePlan({ currentState: "Now we have state" });
    const diffs = diffPlans(old, updated);
    const diff = diffs.find((d) => d.section === "Current State");
    expect(diff).toBeDefined();
    expect(diff!.status).toBe("added");
  });

  it("detects changed subItems within a phase", () => {
    const oldPhase = makePhase("p1", 1, "Setup", "Overview");
    oldPhase.subItems = [{ id: "s1", letter: "a", name: "Task A", content: "Old content" }];
    const newPhase = makePhase("p1", 1, "Setup", "Overview");
    newPhase.subItems = [{ id: "s1", letter: "a", name: "Task A", content: "Updated content" }];

    const old = makePlan({ phases: [oldPhase] });
    const updated = makePlan({ phases: [newPhase] });
    const diffs = diffPlans(old, updated);
    const phaseDiff = diffs.find((d) => d.section === "Phase 1: Setup");
    expect(phaseDiff).toBeDefined();
    expect(phaseDiff!.status).toBe("changed");
  });
});

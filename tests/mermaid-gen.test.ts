import { describe, it, expect } from "vitest";
import { generatePhaseFlowDiagram } from "../src/cli/mermaid-gen.js";
import type { Phase } from "../src/lib/types/index.js";

function makePhase(number: number, name: string): Phase {
  return {
    id: `phase-${number}`,
    number,
    name,
    overview: "",
    subItems: [],
    changes: [],
    successCriteria: { automated: [], manual: [] },
    content: "",
  };
}

describe("generatePhaseFlowDiagram", () => {
  it("returns correct diagram shape", () => {
    const result = generatePhaseFlowDiagram([makePhase(1, "Setup")]);
    expect(result.id).toBe("phase-flow");
    expect(result.title).toBe("Implementation Flow");
    expect(result.type).toBe("flowchart");
  });

  it("generates graph LR header", () => {
    const result = generatePhaseFlowDiagram([makePhase(1, "Setup")]);
    expect(result.mermaidCode).toContain("graph LR");
  });

  it("generates node for single phase", () => {
    const result = generatePhaseFlowDiagram([makePhase(1, "Setup")]);
    expect(result.mermaidCode).toContain('P1["Phase 1: Setup"]');
  });

  it("generates arrows between phases", () => {
    const phases = [makePhase(1, "Setup"), makePhase(2, "Build"), makePhase(3, "Test")];
    const result = generatePhaseFlowDiagram(phases);
    expect(result.mermaidCode).toContain("P1 --> P2");
    expect(result.mermaidCode).toContain("P2 --> P3");
    expect(result.mermaidCode).not.toContain("P3 -->");
  });

  it("generates no arrows for single phase", () => {
    const result = generatePhaseFlowDiagram([makePhase(1, "Solo")]);
    expect(result.mermaidCode).not.toContain("-->");
  });

  it("handles empty phases array", () => {
    const result = generatePhaseFlowDiagram([]);
    expect(result.mermaidCode).toBe("graph LR");
  });
});

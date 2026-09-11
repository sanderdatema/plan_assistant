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

  it("escapes double quotes in phase names so the label stays valid", () => {
    const result = generatePhaseFlowDiagram([makePhase(1, 'Add "quoted" step')]);
    // No raw double quote other than the two that open/close the label.
    const quoteCount = (result.mermaidCode.match(/"/g) || []).length;
    expect(quoteCount).toBe(2);
    expect(result.mermaidCode).toContain("&quot;quoted&quot;");
    expect(result.mermaidCode).not.toContain('"quoted"');
  });

  it("escapes square brackets in phase names", () => {
    const result = generatePhaseFlowDiagram([makePhase(1, "Build [core] module")]);
    expect(result.mermaidCode).toContain("&#91;core&#93;");
    expect(result.mermaidCode).not.toContain("[core]");
  });

  it("escapes pipes in phase names", () => {
    const result = generatePhaseFlowDiagram([makePhase(1, "Lint | Format")]);
    expect(result.mermaidCode).toContain("&#124;");
    expect(result.mermaidCode).not.toContain("Lint | Format");
  });

  it("escapes parens, braces and angle brackets in phase names", () => {
    const result = generatePhaseFlowDiagram([
      makePhase(1, "Setup (init) {config} <deploy>"),
    ]);
    expect(result.mermaidCode).toContain("&#40;init&#41;");
    expect(result.mermaidCode).toContain("&#123;config&#125;");
    expect(result.mermaidCode).toContain("&lt;deploy&gt;");
  });

  it("collapses newlines in phase names to a single space", () => {
    const result = generatePhaseFlowDiagram([makePhase(1, "Setup\nand build")]);
    expect(result.mermaidCode).toContain("Setup and build");
    expect(result.mermaidCode).not.toContain("Setup\nand build");
  });

  it("leaves plain phase names unchanged", () => {
    const result = generatePhaseFlowDiagram([makePhase(1, "Setup")]);
    expect(result.mermaidCode).toContain('P1["Phase 1: Setup"]');
  });

  it("keeps arrows between phases correct when names contain special characters", () => {
    const phases = [
      makePhase(1, 'Setup "core"'),
      makePhase(2, "Build [module]"),
      makePhase(3, "Test | Verify"),
    ];
    const result = generatePhaseFlowDiagram(phases);
    expect(result.mermaidCode).toContain("P1 --> P2");
    expect(result.mermaidCode).toContain("P2 --> P3");
    expect(result.mermaidCode).not.toContain("P3 -->");
  });
});

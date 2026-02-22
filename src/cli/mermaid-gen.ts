import type { Phase, Diagram } from "./types.js";

export function generatePhaseFlowDiagram(phases: Phase[]): Diagram {
  const lines: string[] = ["graph LR"];

  for (const phase of phases) {
    const nodeId = `P${phase.number}`;
    const label = `Phase ${phase.number}: ${phase.name}`;
    lines.push(`  ${nodeId}["${label}"]`);
  }

  for (let i = 0; i < phases.length - 1; i++) {
    lines.push(`  P${phases[i].number} --> P${phases[i + 1].number}`);
  }

  return {
    id: "phase-flow",
    title: "Implementation Flow",
    type: "flowchart",
    mermaidCode: lines.join("\n"),
  };
}

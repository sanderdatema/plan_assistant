import type { Phase, Diagram } from "../lib/types/index.js";

// Mermaid flowchart node labels (`ID["label"]`) break on characters that
// collide with the parser's own syntax: quotes end the label early, and
// []{}()<>| are node/edge-shape delimiters. Mermaid's documented fix is to
// substitute HTML entities for these characters inside the label instead of
// trying to backslash-escape them, so `"` -> `&quot;`, etc. Newlines are
// replaced with a space since a raw line break would terminate the
// statement. Applied to every label we generate, not just double quotes,
// since any of these characters in a phase name can break the diagram the
// same way.
function escapeMermaidLabel(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
    .replace(/\(/g, "&#40;")
    .replace(/\)/g, "&#41;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "&#124;")
    .replace(/\r\n|\r|\n/g, " ");
}

export function generatePhaseFlowDiagram(phases: Phase[]): Diagram {
  const lines: string[] = ["graph LR"];

  for (const phase of phases) {
    const nodeId = `P${phase.number}`;
    const label = `Phase ${phase.number}: ${escapeMermaidLabel(phase.name)}`;
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

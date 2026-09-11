import type { Phase, Diagram } from "../lib/types/index.js";

// Mermaid flowchart node labels (`ID["label"]`) break on characters that
// collide with the parser's own syntax: quotes end the label early, and
// []{}()<>| are node/edge-shape delimiters. Mermaid's documented fix is to
// substitute HTML entities for these characters inside the label instead of
// trying to backslash-escape them. One pass over the string, so an ampersand
// in the source cannot be escaped twice.
const MERMAID_LABEL_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  '"': "&quot;",
  "[": "&#91;",
  "]": "&#93;",
  "(": "&#40;",
  ")": "&#41;",
  "{": "&#123;",
  "}": "&#125;",
  "<": "&lt;",
  ">": "&gt;",
  "|": "&#124;",
};

function escapeMermaidLabel(text: string): string {
  return text
    .replaceAll(/[&"[\](){}<>|]/g, (char) => MERMAID_LABEL_ENTITIES[char])
    // A raw line break would terminate the statement.
    .replaceAll(/\r\n|\r|\n/g, " ");
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

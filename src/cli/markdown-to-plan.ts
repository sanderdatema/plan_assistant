import { Lexer, type Token } from "marked";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import type {
  PlanJson,
  Phase,
  Change,
  Criterion,
  Diagram,
  SubItem,
} from "../lib/types/index.js";
import { generatePhaseFlowDiagram } from "./mermaid-gen.js";
import {
  createParseContext,
  splitIntoSections,
  tokensToMarkdown,
  findSection,
  collectSectionsUntilLevel,
  parseKeyDiscoveries,
  parseScopeExclusions,
  parsePhases,
  parseTestingStrategy,
  parseReferences,
  tryMatchPhaseHeading,
  extractFilePath,
  parseChangesFromHeadings,
  parseChangesFromList,
  parseCriteria,
} from "./markdown-parser.js";

export type { PlanJson, Phase, Change, Criterion, Diagram, SubItem };

export interface ParseResult {
  plan: PlanJson;
  warnings: string[];
}

export function sessionIdFromPath(absolutePath: string): string {
  return createHash("sha256").update(absolutePath).digest("hex").slice(0, 8);
}

export function parseMarkdownToPlan(
  markdown: string,
  markdownPath: string,
  projectDir: string,
  version = 1,
): ParseResult {
  const ctx = createParseContext();
  const tokens = Lexer.lex(markdown);
  const sections = splitIntoSections(tokens);

  // Title from first H1
  const titleSection = sections.find((s) => s.level === 1);
  const title = titleSection?.heading ?? basename(markdownPath, ".md");

  // Date from filename or today
  const dateMatch = basename(markdownPath).match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

  // Ticket ref from filename
  const ticketMatch = basename(markdownPath).match(/(?:ENG|TASK)-(\d+)/i);
  const ticketRef = ticketMatch ? ticketMatch[0].toUpperCase() : undefined;

  // Overview
  const overviewSection = findSection(sections, /^Overview$/i, 2);
  const overview = overviewSection
    ? tokensToMarkdown(overviewSection.tokens)
    : "";

  // Current State
  const currentStateSection = findSection(sections, /^Current\s+State/i, 2);
  const currentStateIdx = currentStateSection
    ? sections.indexOf(currentStateSection)
    : -1;
  let currentState = "";
  let keyDiscoveries: { text: string; codeRef?: string }[] = [];

  if (currentStateSection) {
    const subSections = collectSectionsUntilLevel(sections, currentStateIdx, 2);
    const kdSection = subSections.find((s) =>
      /Key\s+Discover/i.test(s.heading),
    );

    if (kdSection) {
      keyDiscoveries = parseKeyDiscoveries(kdSection.tokens);
      const kdIdx = sections.indexOf(kdSection);
      const beforeKd: Token[] = [];
      for (let i = currentStateIdx + 1; i < kdIdx; i++) {
        beforeKd.push(...sections[i].tokens);
      }
      currentState = tokensToMarkdown([
        ...currentStateSection.tokens,
        ...beforeKd,
      ]);
    } else {
      currentState = tokensToMarkdown(currentStateSection.tokens);
    }
  }

  // Scope exclusions
  const scopeSection = findSection(sections, /What\s+We.*NOT\s+Doing/i, 2);
  const scopeExclusions = scopeSection
    ? parseScopeExclusions(scopeSection.tokens)
    : [];

  // Implementation approach
  const approachSection = findSection(
    sections,
    /Implementation\s+Approach/i,
    2,
  );
  const implementationApproach = approachSection
    ? tokensToMarkdown(approachSection.tokens)
    : "";

  // Phases
  const phases = parsePhases(sections, ctx);

  // Diagrams
  const diagrams: Diagram[] = [];
  if (phases.length > 0) {
    diagrams.push(generatePhaseFlowDiagram(phases));
  }

  // Testing strategy
  const testingSection = findSection(sections, /Testing\s+Strategy/i, 2);
  const testingIdx = testingSection ? sections.indexOf(testingSection) : -1;
  const testingSubs =
    testingIdx >= 0 ? collectSectionsUntilLevel(sections, testingIdx, 2) : [];
  const testingStrategy = testingSection
    ? parseTestingStrategy(testingSection, testingSubs)
    : { unit: [], integration: [], manual: [] };

  // References
  const refsSection = findSection(sections, /^References$/i, 2);
  const references = refsSection ? parseReferences(refsSection.tokens) : [];

  // Collect additional (unrecognized) H2 sections
  const knownH2Indices = new Set<number>();
  const knownPatterns = [
    /^Overview$/i,
    /^Current\s+State/i,
    /What\s+We.*NOT\s+Doing/i,
    /Implementation\s+Approach/i,
    /Testing\s+Strategy/i,
    /^References$/i,
  ];
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].level === 1) {
      knownH2Indices.add(i);
      continue;
    }
    if (sections[i].level !== 2) continue;

    // Check if it's a known section
    if (knownPatterns.some((p) => p.test(sections[i].heading))) {
      knownH2Indices.add(i);
      continue;
    }

    // Check if it was parsed as a phase
    if (
      phases.some(
        (p) =>
          p.name === sections[i].heading ||
          tryMatchPhaseHeading(sections[i].heading, 0),
      )
    ) {
      knownH2Indices.add(i);
      continue;
    }
  }

  const additionalSections: { heading: string; content: string }[] = [];
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].level !== 2 || knownH2Indices.has(i)) continue;
    // Double-check it's not a parsed phase
    const isPhase = phases.some(
      (p) =>
        p.name === sections[i].heading ||
        sections[i].heading.match(new RegExp(`Phase\\s+${p.number}`, "i")),
    );
    if (isPhase) continue;

    const subs = collectSectionsUntilLevel(sections, i, 2);
    let content = tokensToMarkdown(sections[i].tokens);
    for (const sub of subs) {
      content += `\n\n${"#".repeat(sub.level)} ${sub.heading}\n\n${tokensToMarkdown(sub.tokens)}`;
    }
    additionalSections.push({
      heading: sections[i].heading,
      content: content.trim(),
    });
  }

  const now = new Date().toISOString();

  const plan: PlanJson = {
    schemaVersion: 1,
    meta: {
      title,
      date,
      ticketRef,
      markdownPath,
      projectDir,
      version,
      createdAt: now,
      updatedAt: now,
    },
    overview,
    currentState,
    keyDiscoveries,
    scopeExclusions,
    implementationApproach,
    phases,
    diagrams,
    testingStrategy,
    references,
    ...(additionalSections.length > 0 ? { additionalSections } : {}),
  };

  return { plan, warnings: ctx.warnings };
}

// Export internals for testing
export const _internal = {
  splitIntoSections,
  tokensToMarkdown,
  findSection,
  collectSectionsUntilLevel,
  parseKeyDiscoveries,
  parseScopeExclusions,
  parseChangesFromHeadings,
  parseChangesFromList,
  parseCriteria,
  parsePhases,
  parseTestingStrategy,
  parseReferences,
  tryMatchPhaseHeading,
  extractFilePath,
  createParseContext,
};

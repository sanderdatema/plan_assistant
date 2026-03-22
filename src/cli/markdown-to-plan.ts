import { Lexer, type Token } from "marked";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import type {
  PlanJson,
  Diagram,
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
  extractFilePath,
  parseChangesFromHeadings,
  parseChangesFromList,
  parseCriteria,
} from "./markdown-parser.js";

interface ParseResult {
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
  };

  return { plan, warnings: ctx.warnings };
}

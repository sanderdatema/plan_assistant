import { Lexer, type Token, type Tokens } from "marked";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import type { Phase, Change, Criterion, Diagram, SubItem } from "./types.js";
import { generatePhaseFlowDiagram } from "./mermaid-gen.js";

export interface PlanJson {
  schemaVersion: 1;
  meta: {
    title: string;
    date: string;
    ticketRef?: string;
    markdownPath: string;
    projectDir: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  overview: string;
  currentState: string;
  keyDiscoveries: { text: string; codeRef?: string }[];
  scopeExclusions: { title: string; reason: string }[];
  implementationApproach: string;
  phases: Phase[];
  diagrams: Diagram[];
  testingStrategy: {
    unit: string[];
    integration: string[];
    manual: string[];
  };
  references: string[];
}

export type { Phase, Change, Criterion, Diagram, SubItem };

interface Section {
  heading: string;
  level: number;
  tokens: Token[];
}

function splitIntoSections(tokens: Token[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const token of tokens) {
    if (token.type === "heading") {
      const h = token as Tokens.Heading;
      current = { heading: h.text, level: h.depth, tokens: [] };
      sections.push(current);
    } else if (current) {
      current.tokens.push(token);
    }
  }

  return sections;
}

function tokensToMarkdown(tokens: Token[]): string {
  return tokens
    .map((t) => t.raw)
    .join("")
    .trim();
}

function findSection(
  sections: Section[],
  pattern: RegExp,
  level?: number,
): Section | undefined {
  return sections.find(
    (s) =>
      pattern.test(s.heading) && (level === undefined || s.level === level),
  );
}

function collectSectionsUntilLevel(
  sections: Section[],
  startIdx: number,
  level: number,
): Section[] {
  const result: Section[] = [];
  for (let i = startIdx + 1; i < sections.length; i++) {
    if (sections[i].level <= level) break;
    result.push(sections[i]);
  }
  return result;
}

function parseKeyDiscoveries(
  tokens: Token[],
): { text: string; codeRef?: string }[] {
  const results: { text: string; codeRef?: string }[] = [];
  for (const token of tokens) {
    if (token.type === "list") {
      const list = token as Tokens.List;
      for (const item of list.items) {
        const text = item.text.trim();
        const codeRefMatch = text.match(/\(?\`([^`]+:\d+[^`]*)\`\)?$/);
        results.push({
          text: codeRefMatch ? text.replace(codeRefMatch[0], "").trim() : text,
          codeRef: codeRefMatch ? codeRefMatch[1] : undefined,
        });
      }
    }
  }
  return results;
}

function parseScopeExclusions(
  tokens: Token[],
): { title: string; reason: string }[] {
  const results: { title: string; reason: string }[] = [];
  for (const token of tokens) {
    if (token.type === "list") {
      const list = token as Tokens.List;
      for (const item of list.items) {
        const text = item.text.trim();
        const parts = text.split(/\s*--\s*|\s*[—–]\s*/);
        if (parts.length >= 2) {
          results.push({
            title: parts[0].trim(),
            reason: parts.slice(1).join(" -- ").trim(),
          });
        } else {
          results.push({ title: text, reason: "" });
        }
      }
    }
  }
  return results;
}

function parseChanges(sections: Section[]): Change[] {
  const changes: Change[] = [];

  for (const section of sections) {
    if (section.level !== 4) continue;

    const nameMatch = section.heading.match(/^\d+\.\s*(.+)/);
    if (!nameMatch) continue;

    const componentName = nameMatch[1]
      .replace(/^(?:New\s+component:\s*|Update\s+)?/i, "")
      .trim();
    let filePath = "";
    let description = "";
    let codeSnippet: string | undefined;
    let codeLanguage: string | undefined;

    const lines: string[] = [];
    for (const token of section.tokens) {
      if (token.type === "paragraph") {
        const para = token as Tokens.Paragraph;
        const fileMatch = para.raw.match(/\*\*File\*\*:\s*`([^`]+)`/);
        if (fileMatch) {
          filePath = fileMatch[1];
          const rest = para.raw
            .replace(/\*\*File\*\*:\s*`[^`]+`\s*(\(new\))?\s*/i, "")
            .trim();
          if (rest) lines.push(rest);
        } else {
          const changesMatch = para.raw.match(/\*\*Changes?\*\*:\s*(.*)/s);
          if (changesMatch) {
            lines.push(changesMatch[1].trim());
          } else {
            lines.push(para.raw.trim());
          }
        }
      } else if (token.type === "code") {
        const codeToken = token as Tokens.Code;
        codeSnippet = codeToken.text;
        codeLanguage = codeToken.lang || undefined;
      } else if (token.type === "list") {
        lines.push(tokensToMarkdown([token]));
      }
    }

    description = lines.filter(Boolean).join("\n\n");

    changes.push({
      componentName,
      filePath,
      description,
      codeSnippet,
      codeLanguage,
    });
  }

  return changes;
}

function parseCriteria(
  tokens: Token[],
  type: "automated" | "manual",
): Criterion[] {
  const criteria: Criterion[] = [];

  for (const token of tokens) {
    if (token.type === "list") {
      const list = token as Tokens.List;
      for (const item of list.items) {
        const text = item.text.trim();
        const commandMatch = text.match(/:\s*`([^`]+)`\s*$/);
        const id = `${type}-${criteria.length + 1}`;
        criteria.push({
          id,
          text: commandMatch
            ? text.replace(commandMatch[0], "").trim() + ":"
            : text,
          command: commandMatch ? commandMatch[1] : undefined,
        });
      }
    }
  }

  return criteria;
}

function parsePhases(allSections: Section[]): Phase[] {
  const phases: Phase[] = [];

  for (let i = 0; i < allSections.length; i++) {
    const section = allSections[i];
    const phaseMatch = section.heading.match(/^Phase\s+(\d+):\s*(.+)/i);
    if (!phaseMatch || section.level !== 2) continue;

    const number = parseInt(phaseMatch[1], 10);
    const name = phaseMatch[2].trim();
    const id = `phase-${number}`;

    const subSections = collectSectionsUntilLevel(allSections, i, 2);

    const overviewSection = subSections.find((s) =>
      /^Overview$/i.test(s.heading),
    );
    const overview = overviewSection
      ? tokensToMarkdown(overviewSection.tokens)
      : "";

    const changesSection = subSections.find((s) =>
      /^Changes\s+Required/i.test(s.heading),
    );
    const changesIdx = changesSection
      ? allSections.indexOf(changesSection)
      : -1;

    let changes: Change[] = [];
    if (changesIdx >= 0) {
      const changeSubs = collectSectionsUntilLevel(allSections, changesIdx, 3);
      changes = parseChanges(changeSubs);
    }

    const automatedSection = subSections.find((s) =>
      /Automated\s+Verification/i.test(s.heading),
    );
    const manualSection = subSections.find((s) =>
      /Manual\s+Verification/i.test(s.heading),
    );

    const automated = automatedSection
      ? parseCriteria(automatedSection.tokens, "automated")
      : [];
    const manual = manualSection
      ? parseCriteria(manualSection.tokens, "manual")
      : [];

    // Build content from direct tokens + unrecognized subsections
    // Also extract sub-items (e.g. "### 1a. First sub-task")
    const recognizedPattern =
      /^(Overview|Changes\s+Required|Automated\s+Verification|Manual\s+Verification)$/i;
    const subItemPattern = /^(\d+)([a-z])\.\s+(.+)/i;
    const contentParts: string[] = [];
    const subItems: SubItem[] = [];

    // Direct tokens between "## Phase N:" and first "###"
    const phaseSection = allSections[i];
    const directText = tokensToMarkdown(phaseSection.tokens);
    if (directText) contentParts.push(directText);

    // Unrecognized ### subsections — check for sub-items first
    for (const sub of subSections) {
      if (recognizedPattern.test(sub.heading)) continue;

      const siMatch = sub.heading.match(subItemPattern);
      if (siMatch && parseInt(siMatch[1], 10) === number) {
        const letter = siMatch[2].toLowerCase();
        subItems.push({
          id: `${id}-${letter}`,
          letter,
          name: siMatch[3].trim(),
          content: tokensToMarkdown(sub.tokens),
        });
      } else {
        const subBody = tokensToMarkdown(sub.tokens);
        contentParts.push(`### ${sub.heading}\n\n${subBody}`);
      }
    }

    const content = contentParts.join("\n\n").trim() || undefined;

    phases.push({
      id,
      number,
      name,
      overview,
      content,
      subItems,
      changes,
      successCriteria: { automated, manual },
    });
  }

  return phases;
}

function parseTestingStrategy(
  section: Section,
  subSections: Section[],
): {
  unit: string[];
  integration: string[];
  manual: string[];
} {
  const result = {
    unit: [] as string[],
    integration: [] as string[],
    manual: [] as string[],
  };

  const unitSection = subSections.find((s) => /Unit\s+Tests?/i.test(s.heading));
  const intSection = subSections.find(
    (s) =>
      /Integration\s+Tests?/i.test(s.heading) ||
      /E2E\s+Tests?/i.test(s.heading),
  );
  const manualSection = subSections.find((s) =>
    /Manual\s+Test/i.test(s.heading),
  );

  function extractList(sec: Section | undefined): string[] {
    if (!sec) return [];
    const items: string[] = [];
    for (const token of sec.tokens) {
      if (token.type === "list") {
        for (const item of (token as Tokens.List).items) {
          items.push(item.text.trim());
        }
      }
    }
    return items;
  }

  result.unit = extractList(unitSection);
  result.integration = extractList(intSection);
  result.manual = extractList(manualSection);

  return result;
}

function parseReferences(tokens: Token[]): string[] {
  const refs: string[] = [];
  for (const token of tokens) {
    if (token.type === "list") {
      for (const item of (token as Tokens.List).items) {
        refs.push(item.text.trim());
      }
    } else if (token.type === "paragraph") {
      const lines = (token as Tokens.Paragraph).text.split("\n");
      for (const line of lines) {
        const trimmed = line.replace(/^[-*]\s*/, "").trim();
        if (trimmed) refs.push(trimmed);
      }
    }
  }
  return refs;
}

export function sessionIdFromPath(absolutePath: string): string {
  return createHash("sha256").update(absolutePath).digest("hex").slice(0, 8);
}

export function parseMarkdownToPlan(
  markdown: string,
  markdownPath: string,
  projectDir: string,
  version = 1,
): PlanJson {
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
    // Get tokens that are in the current state section but NOT in the key discoveries sub-section
    const subSections = collectSectionsUntilLevel(sections, currentStateIdx, 2);
    const kdSection = subSections.find((s) =>
      /Key\s+Discover/i.test(s.heading),
    );

    if (kdSection) {
      keyDiscoveries = parseKeyDiscoveries(kdSection.tokens);
      // currentState is everything in the current state section before key discoveries
      const kdIdx = sections.indexOf(kdSection);
      const beforeKd: Token[] = [];
      for (let i = currentStateIdx + 1; i < kdIdx; i++) {
        // include sub-section headings+tokens as raw markdown
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
  const phases = parsePhases(sections);

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

  return {
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
}

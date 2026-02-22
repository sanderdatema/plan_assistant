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
  additionalSections?: { heading: string; content: string }[];
}

export type { Phase, Change, Criterion, Diagram, SubItem };

export interface ParseResult {
  plan: PlanJson;
  warnings: string[];
}

interface ParseContext {
  warnings: string[];
  warn(message: string): void;
}

function createParseContext(): ParseContext {
  const warnings: string[] = [];
  return {
    warnings,
    warn(message: string) {
      warnings.push(message);
    },
  };
}

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

// --- Flexible Change Parsing ---

/**
 * Extract file path from a paragraph token using multiple patterns.
 * Accepts: **File**: `path`, **Path**: `path`, File: `path`, bare `path/to/file.ext`
 */
function extractFilePath(
  raw: string,
): { filePath: string; rest: string } | null {
  // Pattern 1: **File**: `path` or **Path**: `path`
  const boldPattern = raw.match(
    /\*\*(?:File|Path)\*\*:\s*`([^`]+)`\s*(\(new\))?\s*/i,
  );
  if (boldPattern) {
    return {
      filePath: boldPattern[1],
      rest: raw.replace(boldPattern[0], "").trim(),
    };
  }

  // Pattern 2: File: `path` (no bold)
  const plainPattern = raw.match(
    /^(?:File|Path):\s*`([^`]+)`\s*(\(new\))?\s*/i,
  );
  if (plainPattern) {
    return {
      filePath: plainPattern[1],
      rest: raw.replace(plainPattern[0], "").trim(),
    };
  }

  return null;
}

/**
 * Parse changes from heading-based sections (#### N. Name).
 * Accepts both level 4 and level 3 sections.
 */
function parseChangesFromHeadings(
  sections: Section[],
  ctx: ParseContext,
): Change[] {
  const changes: Change[] = [];

  for (const section of sections) {
    // Accept level 3 or 4
    if (section.level !== 4 && section.level !== 3) continue;

    const nameMatch = section.heading.match(/^\d+\.\s*(.+)/);
    if (!nameMatch) continue;

    if (section.level === 3) {
      ctx.warn(
        `Change "${section.heading}" uses h3 instead of h4 — accepted but non-canonical`,
      );
    }

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
        const fp = extractFilePath(para.raw);
        if (fp) {
          filePath = fp.filePath;
          if (fp.rest) lines.push(fp.rest);
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

/**
 * Parse changes from bullet list items with file paths.
 * Accepts: - **path/to/file**: description
 */
function parseChangesFromList(tokens: Token[], ctx: ParseContext): Change[] {
  const changes: Change[] = [];

  for (const token of tokens) {
    if (token.type !== "list") continue;
    const list = token as Tokens.List;
    for (const item of list.items) {
      const text = item.text.trim();
      // **path/to/file.ext**: description
      const boldPathMatch = text.match(/^\*\*([^*]+\.[a-zA-Z]+)\*\*:\s*(.*)/s);
      if (boldPathMatch) {
        const filePath = boldPathMatch[1];
        const description = boldPathMatch[2].trim();
        const name = basename(filePath);
        changes.push({
          componentName: name,
          filePath,
          description,
        });
        continue;
      }

      // `path/to/file.ext`: description
      const backtickPathMatch = text.match(/^`([^`]+\.[a-zA-Z]+)`:\s*(.*)/s);
      if (backtickPathMatch) {
        const filePath = backtickPathMatch[1];
        const description = backtickPathMatch[2].trim();
        const name = basename(filePath);
        changes.push({
          componentName: name,
          filePath,
          description,
        });
      }
    }
  }

  if (changes.length > 0) {
    ctx.warn("Changes parsed from list format — non-canonical");
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

// --- Flexible Phase Heading Matching ---

interface PhaseHeadingMatch {
  number: number;
  name: string;
  variant: "canonical" | "dash" | "step" | "task" | "unnumbered";
}

/**
 * Try to match a section heading as a phase heading.
 * Cascade: strict first, then relaxed patterns.
 */
function tryMatchPhaseHeading(
  heading: string,
  autoNumber: number,
): PhaseHeadingMatch | null {
  // Canonical: "Phase 1: Setup"
  let m = heading.match(/^Phase\s+(\d+):\s*(.+)/i);
  if (m)
    return {
      number: parseInt(m[1], 10),
      name: m[2].trim(),
      variant: "canonical",
    };

  // Dash separator: "Phase 1 - Setup"
  m = heading.match(/^Phase\s+(\d+)\s*[-–—]\s*(.+)/i);
  if (m)
    return { number: parseInt(m[1], 10), name: m[2].trim(), variant: "dash" };

  // Step keyword: "Step 1: Setup"
  m = heading.match(/^Step\s+(\d+):\s*(.+)/i);
  if (m)
    return { number: parseInt(m[1], 10), name: m[2].trim(), variant: "step" };

  // Task keyword: "Task 1: Setup"
  m = heading.match(/^Task\s+(\d+):\s*(.+)/i);
  if (m)
    return { number: parseInt(m[1], 10), name: m[2].trim(), variant: "task" };

  return null;
}

/** Known top-level section patterns that should NOT be treated as phases */
const KNOWN_SECTION_PATTERNS = [
  /^Overview$/i,
  /^Current\s+State/i,
  /What\s+We.*NOT\s+Doing/i,
  /Implementation\s+Approach/i,
  /Testing\s+Strategy/i,
  /^References$/i,
  /^Context$/i,
  /^Verification$/i,
  /^Version$/i,
  /^Summary$/i,
];

const CHANGES_HEADING_PATTERN =
  /^(?:Changes\s+Required|Changes|File\s+Changes|Modifications):?$/i;

const SUCCESS_CRITERIA_HEADING_PATTERN =
  /^(?:Success\s+Criteria|Criteria|Verification):?$/i;

function parsePhases(allSections: Section[], ctx: ParseContext): Phase[] {
  const phases: Phase[] = [];
  let autoNumber = 1;

  for (let i = 0; i < allSections.length; i++) {
    const section = allSections[i];

    // Try matching at level 2 (canonical) or level 3 (with warning)
    if (section.level !== 2 && section.level !== 3) continue;

    const phaseMatch = tryMatchPhaseHeading(section.heading, autoNumber);

    // Also check for unnumbered H2s that look like phases
    let isUnnumberedPhase = false;
    if (!phaseMatch && section.level === 2) {
      // Skip known section patterns
      if (KNOWN_SECTION_PATTERNS.some((p) => p.test(section.heading))) continue;

      // Check if this H2 has subsections that look like phase content
      // (has Changes Required, or Success Criteria, or numbered sub-headings)
      const subSections = collectSectionsUntilLevel(allSections, i, 2);
      const hasChanges = subSections.some((s) =>
        CHANGES_HEADING_PATTERN.test(s.heading),
      );
      const hasCriteria = subSections.some(
        (s) =>
          SUCCESS_CRITERIA_HEADING_PATTERN.test(s.heading) ||
          /Automated\s+Verification/i.test(s.heading) ||
          /Manual\s+Verification/i.test(s.heading),
      );
      const hasNumberedChanges = subSections.some(
        (s) => (s.level === 4 || s.level === 3) && /^\d+\.\s/.test(s.heading),
      );

      if (hasChanges || hasCriteria || hasNumberedChanges) {
        isUnnumberedPhase = true;
      } else {
        continue;
      }
    }

    if (!phaseMatch && !isUnnumberedPhase) {
      // H3 with phase-like heading
      if (section.level === 3) {
        const h3Match = tryMatchPhaseHeading(section.heading, autoNumber);
        if (h3Match) {
          ctx.warn(
            `Phase "${section.heading}" uses h3 instead of h2 — accepted but non-canonical`,
          );
          // Fall through with h3Match
        } else {
          continue;
        }
      } else {
        continue;
      }
    }

    const match = phaseMatch ?? {
      number: autoNumber,
      name: section.heading,
      variant: "unnumbered" as const,
    };

    if (match.variant !== "canonical" && match.variant !== "unnumbered") {
      ctx.warn(
        `Phase "${section.heading}" uses non-canonical format (${match.variant}) — accepted`,
      );
    }
    if (match.variant === "unnumbered") {
      ctx.warn(
        `Unnumbered heading "${section.heading}" treated as Phase ${match.number}`,
      );
    }

    const number = match.number;
    const name = match.name;
    const id = `phase-${number}`;
    autoNumber = number + 1;

    const subSections = collectSectionsUntilLevel(
      allSections,
      i,
      section.level,
    );

    const overviewSection = subSections.find((s) =>
      /^Overview$/i.test(s.heading),
    );
    const overview = overviewSection
      ? tokensToMarkdown(overviewSection.tokens)
      : "";

    // Flexible changes section heading
    const changesSection = subSections.find((s) =>
      CHANGES_HEADING_PATTERN.test(s.heading),
    );

    if (
      changesSection &&
      !/^Changes\s+Required/i.test(changesSection.heading)
    ) {
      ctx.warn(
        `Phase ${number}: "${changesSection.heading}" used instead of "Changes Required" — accepted`,
      );
    }

    const changesIdx = changesSection
      ? allSections.indexOf(changesSection)
      : -1;

    let changes: Change[] = [];
    if (changesIdx >= 0 && changesSection) {
      // Strategy 1: Heading-based changes (#### N. Name)
      const changeSubs = collectSectionsUntilLevel(
        allSections,
        changesIdx,
        changesSection.level,
      );
      changes = parseChangesFromHeadings(changeSubs, ctx);

      // Strategy 2: List-based changes if no heading-based changes found
      if (changes.length === 0) {
        changes = parseChangesFromList(changesSection.tokens, ctx);
      }
    }

    // Flexible success criteria heading
    const criteriaSection = subSections.find((s) =>
      SUCCESS_CRITERIA_HEADING_PATTERN.test(s.heading),
    );
    const criteriaIdx = criteriaSection
      ? allSections.indexOf(criteriaSection)
      : -1;
    const criteriaSubs =
      criteriaIdx >= 0 && criteriaSection
        ? collectSectionsUntilLevel(
            allSections,
            criteriaIdx,
            criteriaSection.level,
          )
        : [];

    const automatedSection =
      criteriaSubs.find((s) => /Automated\s+Verification/i.test(s.heading)) ??
      subSections.find((s) => /Automated\s+Verification/i.test(s.heading));
    const manualSection =
      criteriaSubs.find((s) => /Manual\s+Verification/i.test(s.heading)) ??
      subSections.find((s) => /Manual\s+Verification/i.test(s.heading));

    const automated = automatedSection
      ? parseCriteria(automatedSection.tokens, "automated")
      : [];
    const manual = manualSection
      ? parseCriteria(manualSection.tokens, "manual")
      : [];

    // If criteria section exists but no automated/manual sub-sections,
    // treat all list items as manual criteria
    if (
      criteriaSection &&
      automated.length === 0 &&
      manual.length === 0 &&
      criteriaSubs.length === 0
    ) {
      manual.push(...parseCriteria(criteriaSection.tokens, "manual"));
    }

    // Build content from direct tokens + unrecognized subsections
    const recognizedPattern =
      /^(Overview|Changes\s+Required|Changes|File\s+Changes|Modifications|Automated\s+Verification|Manual\s+Verification|Success\s+Criteria|Criteria|Verification):?$/i;
    const subItemPattern = /^(\d+)([a-z])\.\s+(.+)/i;
    const contentParts: string[] = [];
    const subItems: SubItem[] = [];

    // Direct tokens between phase heading and first sub-heading
    const phaseSection = allSections[i];
    const directText = tokensToMarkdown(phaseSection.tokens);
    if (directText) contentParts.push(directText);

    // Unrecognized subsections — check for sub-items first
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

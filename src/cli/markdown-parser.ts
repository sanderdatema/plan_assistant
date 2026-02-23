import { type Token, type Tokens } from "marked";
import { basename } from "node:path";
import type { Phase, Change, Criterion, SubItem } from "../lib/types/index.js";

export interface ParseContext {
  warnings: string[];
  warn(message: string): void;
}

export function createParseContext(): ParseContext {
  const warnings: string[] = [];
  return {
    warnings,
    warn(message: string) {
      warnings.push(message);
    },
  };
}

export interface Section {
  heading: string;
  level: number;
  tokens: Token[];
}

export function splitIntoSections(tokens: Token[]): Section[] {
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

export function tokensToMarkdown(tokens: Token[]): string {
  return tokens
    .map((t) => t.raw)
    .join("")
    .trim();
}

export function findSection(
  sections: Section[],
  pattern: RegExp,
  level?: number,
): Section | undefined {
  return sections.find(
    (s) =>
      pattern.test(s.heading) && (level === undefined || s.level === level),
  );
}

export function collectSectionsUntilLevel(
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

export function parseKeyDiscoveries(
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

export function parseScopeExclusions(
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
export function extractFilePath(
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
export function parseChangesFromHeadings(
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
export function parseChangesFromList(tokens: Token[], ctx: ParseContext): Change[] {
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

export function parseCriteria(
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

export interface PhaseHeadingMatch {
  number: number;
  name: string;
  variant: "canonical" | "dash" | "step" | "task" | "unnumbered";
}

/**
 * Try to match a section heading as a phase heading.
 * Cascade: strict first, then relaxed patterns.
 */
export function tryMatchPhaseHeading(
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
export const KNOWN_SECTION_PATTERNS = [
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

export const CHANGES_HEADING_PATTERN =
  /^(?:Changes\s+Required|Changes|File\s+Changes|Modifications):?$/i;

export const SUCCESS_CRITERIA_HEADING_PATTERN =
  /^(?:Success\s+Criteria|Criteria|Verification):?$/i;

export function parsePhases(allSections: Section[], ctx: ParseContext): Phase[] {
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

export function parseTestingStrategy(
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

export function parseReferences(tokens: Token[]): string[] {
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

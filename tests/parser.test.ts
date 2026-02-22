import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseMarkdownToPlan,
  sessionIdFromPath,
  _internal,
} from "../src/cli/markdown-to-plan.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

function parseFixture(name: string) {
  const markdown = readFileSync(join(FIXTURES_DIR, name), "utf-8");
  return parseMarkdownToPlan(markdown, `/test/${name}`, "/test", 1);
}

// --- Canonical format ---

describe("canonical format", () => {
  it("parses title from H1", () => {
    const { plan } = parseFixture("canonical.md");
    expect(plan.meta.title).toBe("Widget Dashboard Implementation Plan");
  });

  it("extracts overview", () => {
    const { plan } = parseFixture("canonical.md");
    expect(plan.overview).toContain("widget dashboard");
  });

  it("extracts current state", () => {
    const { plan } = parseFixture("canonical.md");
    expect(plan.currentState).toContain("static layout");
  });

  it("extracts key discoveries", () => {
    const { plan } = parseFixture("canonical.md");
    expect(plan.keyDiscoveries).toHaveLength(2);
    expect(plan.keyDiscoveries[0].codeRef).toBe("src/config/dashboard.ts:15");
  });

  it("extracts scope exclusions", () => {
    const { plan } = parseFixture("canonical.md");
    expect(plan.scopeExclusions).toHaveLength(2);
    expect(plan.scopeExclusions[0].title).toBe("Mobile responsive layout");
    expect(plan.scopeExclusions[0].reason).toBe("Not in scope for v1");
  });

  it("extracts implementation approach", () => {
    const { plan } = parseFixture("canonical.md");
    expect(plan.implementationApproach).toContain("grid-based layout");
  });

  it("parses all phases", () => {
    const { plan } = parseFixture("canonical.md");
    expect(plan.phases).toHaveLength(2);
    expect(plan.phases[0].number).toBe(1);
    expect(plan.phases[0].name).toBe("Grid Layout Engine");
    expect(plan.phases[1].number).toBe(2);
    expect(plan.phases[1].name).toBe("Widget System");
  });

  it("parses changes within phases", () => {
    const { plan } = parseFixture("canonical.md");
    const phase1 = plan.phases[0];
    expect(phase1.changes).toHaveLength(2);
    expect(phase1.changes[0].componentName).toBe("Grid Component");
    expect(phase1.changes[0].filePath).toBe("src/lib/components/Grid.svelte");
    expect(phase1.changes[0].codeSnippet).toContain("grid-template-columns");
  });

  it("parses success criteria", () => {
    const { plan } = parseFixture("canonical.md");
    const phase1 = plan.phases[0];
    expect(phase1.successCriteria.automated).toHaveLength(2);
    expect(phase1.successCriteria.automated[0].command).toBe(
      "npm test -- grid",
    );
    expect(phase1.successCriteria.manual).toHaveLength(2);
  });

  it("generates no warnings", () => {
    const { warnings } = parseFixture("canonical.md");
    expect(warnings).toHaveLength(0);
  });

  it("generates diagrams", () => {
    const { plan } = parseFixture("canonical.md");
    expect(plan.diagrams).toHaveLength(1);
    expect(plan.diagrams[0].type).toBe("flowchart");
    expect(plan.diagrams[0].mermaidCode).toContain("P1");
  });

  it("extracts testing strategy", () => {
    const { plan } = parseFixture("canonical.md");
    expect(plan.testingStrategy.unit).toHaveLength(2);
    expect(plan.testingStrategy.integration).toHaveLength(1);
    expect(plan.testingStrategy.manual).toHaveLength(3);
  });

  it("extracts references", () => {
    const { plan } = parseFixture("canonical.md");
    expect(plan.references).toHaveLength(2);
  });
});

// --- Claude Code style (dash separator) ---

describe("claude-code style", () => {
  it("accepts dash separator in phase heading", () => {
    const { plan, warnings } = parseFixture("claude-code-style.md");
    expect(plan.phases).toHaveLength(2);
    expect(plan.phases[0].name).toBe("Auth Middleware");
    expect(warnings.some((w) => w.includes("dash"))).toBe(true);
  });

  it("parses changes under dash-separated phases", () => {
    const { plan } = parseFixture("claude-code-style.md");
    expect(plan.phases[0].changes).toHaveLength(2);
    expect(plan.phases[0].changes[0].filePath).toBe("src/middleware/auth.ts");
  });
});

// --- Codex style (Step keyword, list-based changes) ---

describe("codex style", () => {
  it("accepts Step keyword in phase heading", () => {
    const { plan, warnings } = parseFixture("codex-style.md");
    expect(plan.phases).toHaveLength(2);
    expect(plan.phases[0].name).toBe("Setup ORM");
    expect(warnings.some((w) => w.includes("step"))).toBe(true);
  });

  it("parses list-based file changes", () => {
    const { plan } = parseFixture("codex-style.md");
    // The codex-style uses "### File Changes" with bold-path list items
    const phase1 = plan.phases[0];
    expect(phase1.changes.length).toBeGreaterThan(0);
    expect(phase1.changes[0].filePath).toContain("src/db/");
  });
});

// --- Cursor style (unnumbered H2, "Modifications" heading) ---

describe("cursor style", () => {
  it("accepts unnumbered H2 as phase", () => {
    const { plan, warnings } = parseFixture("cursor-style.md");
    expect(plan.phases).toHaveLength(2);
    expect(plan.phases[0].name).toBe("Theme System Setup");
    expect(warnings.some((w) => w.includes("Unnumbered"))).toBe(true);
  });

  it("parses changes under 'Modifications' heading", () => {
    const { plan } = parseFixture("cursor-style.md");
    expect(plan.phases[0].changes.length).toBeGreaterThan(0);
  });
});

// --- Minimal plan ---

describe("minimal plan", () => {
  it("parses a plan with only required sections", () => {
    const { plan } = parseFixture("minimal.md");
    expect(plan.meta.title).toBe("Fix Login Bug");
    expect(plan.phases).toHaveLength(1);
    expect(plan.phases[0].changes).toHaveLength(1);
    expect(plan.phases[0].changes[0].filePath).toBe("src/auth.ts");
  });
});

// --- Kitchen sink ---

describe("kitchen-sink plan", () => {
  it("extracts date from filename", () => {
    const { plan } = parseFixture("kitchen-sink.md");
    expect(plan.meta.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it("parses all three phases", () => {
    const { plan } = parseFixture("kitchen-sink.md");
    expect(plan.phases).toHaveLength(3);
  });

  it("extracts sub-items in Phase 2", () => {
    const { plan } = parseFixture("kitchen-sink.md");
    const phase2 = plan.phases[1];
    expect(phase2.subItems).toHaveLength(3);
    expect(phase2.subItems[0].letter).toBe("a");
    expect(phase2.subItems[0].name).toBe("Feature List Component");
  });

  it("parses code snippets", () => {
    const { plan } = parseFixture("kitchen-sink.md");
    const phase1 = plan.phases[0];
    expect(phase1.changes[0].codeSnippet).toContain("router.get");
    expect(phase1.changes[0].codeLanguage).toBe("typescript");
  });

  it("handles multiple scope exclusions", () => {
    const { plan } = parseFixture("kitchen-sink.md");
    expect(plan.scopeExclusions).toHaveLength(3);
  });
});

// --- Internal helpers ---

describe("tryMatchPhaseHeading", () => {
  const { tryMatchPhaseHeading } = _internal;

  it("matches canonical format", () => {
    const result = tryMatchPhaseHeading("Phase 1: Setup", 1);
    expect(result).toEqual({ number: 1, name: "Setup", variant: "canonical" });
  });

  it("matches dash separator", () => {
    const result = tryMatchPhaseHeading("Phase 2 - Implementation", 1);
    expect(result).toEqual({
      number: 2,
      name: "Implementation",
      variant: "dash",
    });
  });

  it("matches Step keyword", () => {
    const result = tryMatchPhaseHeading("Step 3: Testing", 1);
    expect(result).toEqual({ number: 3, name: "Testing", variant: "step" });
  });

  it("matches Task keyword", () => {
    const result = tryMatchPhaseHeading("Task 1: Research", 1);
    expect(result).toEqual({ number: 1, name: "Research", variant: "task" });
  });

  it("returns null for non-phase headings", () => {
    expect(tryMatchPhaseHeading("Overview", 1)).toBeNull();
    expect(tryMatchPhaseHeading("Testing Strategy", 1)).toBeNull();
  });
});

describe("extractFilePath", () => {
  const { extractFilePath } = _internal;

  it("extracts bold file path", () => {
    const result = extractFilePath("**File**: `src/foo.ts`");
    expect(result?.filePath).toBe("src/foo.ts");
  });

  it("extracts bold path path", () => {
    const result = extractFilePath("**Path**: `src/bar.ts`");
    expect(result?.filePath).toBe("src/bar.ts");
  });

  it("extracts plain file path", () => {
    const result = extractFilePath("File: `src/baz.ts`");
    expect(result?.filePath).toBe("src/baz.ts");
  });

  it("handles (new) suffix", () => {
    const result = extractFilePath("**File**: `src/new.ts` (new)");
    expect(result?.filePath).toBe("src/new.ts");
  });

  it("returns null for non-file paragraphs", () => {
    expect(extractFilePath("This is just text")).toBeNull();
  });
});

describe("sessionIdFromPath", () => {
  it("returns 8 hex chars", () => {
    const id = sessionIdFromPath("/test/plan.md");
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic", () => {
    const a = sessionIdFromPath("/test/plan.md");
    const b = sessionIdFromPath("/test/plan.md");
    expect(a).toBe(b);
  });

  it("differs for different paths", () => {
    const a = sessionIdFromPath("/test/a.md");
    const b = sessionIdFromPath("/test/b.md");
    expect(a).not.toBe(b);
  });
});

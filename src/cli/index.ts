export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0] ?? "help";
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const eqIdx = key.indexOf("=");
      if (eqIdx >= 0) {
        flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
      } else {
        // Check if next arg is a value (not a flag)
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const key = arg.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function usage() {
  console.log(`plan-assistant - Review implementation plans in the browser

Workflow:
  1. plan-assistant init --output plan.md              Create correctly-formatted template
  2. # Edit plan.md with your plan content
  3. plan-assistant review plan.md                     Open in browser, wait for Approve/Request Changes
  4. # review exits with the feedback result automatically

Commands:
  plan-assistant init [--output <file>]                Generate plan template (stdout if no --output)
  plan-assistant review <markdown-file>                Parse and review a plan
  plan-assistant status <session-id-or-file>           Check review status
  plan-assistant feedback <session-id-or-file>         Read feedback JSON
  plan-assistant list [--dir <path>]                   List all sessions
  plan-assistant clean [--all] [--older-than <dur>]    Remove old sessions
  plan-assistant export <session-id-or-file>           Export as HTML
  plan-assistant help format                           Show the required plan format
  plan-assistant help                                  Show this help

Flags:
  --pretty        Human-readable output (default: JSON)
  --port <N>      Port for review server (review command)
  --no-wait       Don't wait for feedback, just start server (review command)
  --wait          Block until feedback is submitted (status command)

TIP: Always start with \`plan-assistant init\` to get a correctly-formatted template.
     Run \`plan-assistant help format\` to see the expected markdown structure.`);
}

function usageFormat() {
  console.log(`plan-assistant - Expected plan markdown format

Always start with: npx plan-assistant init --output <file>

Required structure:
─────────────────────────────────────────────────────────────────
# Plan Title

## Overview
Brief description of what this plan accomplishes.

## Phase 1: Phase Name

### Changes Required:

#### 1. Component Name
**File**: \`path/to/file.ext\`
Description of what to change.

#### 2. Another Component
**File**: \`path/to/other.ts\`
Description of changes.

### Success Criteria:

#### Automated Verification:
- [ ] \`npm test\`

#### Manual Verification:
- [ ] Manually verify the feature works

## Phase 2: Phase Name
(same structure as Phase 1)
─────────────────────────────────────────────────────────────────

Phase heading formats (all accepted):
  ## Phase N: Name    (canonical)
  ## Phase N - Name
  ## Step N: Name
  ## Task N: Name

Changes section heading alternatives:
  ### Changes Required:   (canonical)
  ### Changes:
  ### Modifications:

Success Criteria heading alternatives:
  ### Success Criteria:   (canonical)
  ### Criteria:
  ### Verification:

Optional top-level sections (all H2):
  ## Current State
  ## What We're NOT Doing
  ## Implementation Approach
  ## Testing Strategy
  ## References`);
}

export async function main(args: string[]) {
  const parsed = parseArgs(args);

  switch (parsed.command) {
    case "review": {
      const { review } = await import("./commands/review.js");
      return review(parsed);
    }
    case "status": {
      const { status } = await import("./commands/status.js");
      return status(parsed);
    }
    case "feedback": {
      const { feedback } = await import("./commands/feedback.js");
      return feedback(parsed);
    }
    case "list": {
      const { list } = await import("./commands/list.js");
      return list(parsed);
    }
    case "init": {
      const { init } = await import("./commands/init.js");
      return init(parsed);
    }
    case "clean": {
      const { clean } = await import("./commands/clean.js");
      return clean(parsed);
    }
    case "export": {
      const { exportCmd } = await import("./commands/export.js");
      return exportCmd(parsed);
    }
    case "help":
    case "--help":
    case "-h":
      if (parsed.positional[0] === "format") {
        usageFormat();
      } else {
        usage();
      }
      return;
    default:
      console.error(`Unknown command: ${parsed.command}`);
      usage();
      process.exit(1);
  }
}

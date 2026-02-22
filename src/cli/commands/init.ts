import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { outputError } from "../output.js";
import type { ParsedArgs } from "../index.js";

const TEMPLATE = `# [Feature Name] Implementation Plan

<!-- Plan Assistant template. Replace bracketed placeholders with your content. -->

## Overview

<!-- What we're building and why. 2-3 sentences. -->

[Describe the feature or change at a high level.]

## Current State

<!-- What exists now. Include relevant code references. -->

[Describe the current state of the codebase relevant to this plan.]

### Key Discoveries

<!-- Findings from code exploration. Use backtick file:line references. -->

- [Finding 1] (\`path/to/file.ts:42\`)
- [Finding 2] (\`path/to/other.ts:15\`)

## What We're NOT Doing

<!-- Scope exclusions with rationale. Use -- to separate item from reason. -->

- [Out of scope item] -- [Reason for exclusion]

## Implementation Approach

<!-- High-level strategy. How will you approach this? -->

[Describe the overall approach.]

## Phase 1: [Phase Name]

### Overview

[What this phase accomplishes.]

### Changes Required:

#### 1. [Component Name]

**File**: \`path/to/file.ext\`

[Description of changes to make.]

\`\`\`typescript
// Example code snippet
\`\`\`

### Success Criteria:

#### Automated Verification:

- [ ] Tests pass: \`npm test\`
- [ ] Type check passes: \`npm run check\`

#### Manual Verification:

- [ ] [Manual verification step]

## Phase 2: [Phase Name]

### Overview

[What this phase accomplishes.]

### Changes Required:

#### 1. [Component Name]

**File**: \`path/to/file.ext\`

[Description of changes.]

### Success Criteria:

#### Automated Verification:

- [ ] [Automated check]: \`command\`

#### Manual Verification:

- [ ] [Manual check]

## Testing Strategy

### Unit Tests

- [What to unit test]

### Integration Tests

- [What to integration test]

### Manual Testing Steps

1. [Step to manually verify]

## References

- [Related file or resource]
`;

export async function init(args: ParsedArgs) {
  const outputFile =
    typeof args.flags.output === "string" ? args.flags.output : undefined;

  if (outputFile) {
    const path = resolve(outputFile);
    if (existsSync(path)) {
      outputError(`File already exists: ${path}`, "FILE_EXISTS");
      process.exit(1);
    }
    writeFileSync(path, TEMPLATE, "utf-8");
    console.error(`Template written to ${path}`);
  } else {
    // Output to stdout (pipe-friendly)
    process.stdout.write(TEMPLATE);
  }
}

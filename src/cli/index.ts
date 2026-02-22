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

Usage:
  plan-assistant review <markdown-file>                Parse and review a plan
  plan-assistant status <session-id-or-file>           Check review status
  plan-assistant feedback <session-id-or-file>         Read feedback JSON
  plan-assistant list [--dir <path>]                   List all sessions
  plan-assistant init [--output <file>]                Generate plan template
  plan-assistant clean [--all] [--older-than <dur>]    Remove old sessions
  plan-assistant export <session-id-or-file>           Export as HTML
  plan-assistant help                                  Show this help

Flags:
  --pretty        Human-readable output (default: JSON)
  --port <N>      Port for review server
  --wait          Block until feedback is submitted (status command)

Examples:
  plan-assistant review thoughts/shared/plans/my-plan.md
  npx plan-assistant review ./plan.md
  plan-assistant status plan.md
  plan-assistant feedback plan.md --unresolved`);
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
      usage();
      return;
    default:
      console.error(`Unknown command: ${parsed.command}`);
      usage();
      process.exit(1);
  }
}

import { dirname } from "node:path";
import type { ParsedArgs } from "../index.js";
import { resolveSession } from "../session-resolver.js";
import {
  stopServer,
  checkHealth,
  DEFAULT_BASE_PORT,
  MAX_PORT,
} from "../server-client.js";
import { outputJson, outputError } from "../output.js";

export async function stop(args: ParsedArgs) {
  const target = args.positional[0];

  if (target) {
    // Stop server for a specific session
    const session = resolveSession(target);
    if (!session) {
      outputError(`Session not found: ${target}`, "NOT_FOUND");
      process.exit(1);
    }

    const parentDir = dirname(session.sessionDir);
    const stopped = await stopServer(parentDir);

    if (stopped) {
      outputJson({ event: "server-stopped", sessionDir: parentDir });
      console.error(`Server stopped for session ${session.sessionId}.`);
    } else {
      outputJson({ event: "no-server", sessionDir: parentDir });
      console.error(
        `No running server found for session ${session.sessionId}.`,
      );
    }
    return;
  }

  // No argument: find and stop all plan-assistant servers in port range
  let stopped = 0;
  const results: Array<{ port: number; sessionDir: string }> = [];

  for (let port = DEFAULT_BASE_PORT; port <= MAX_PORT; port++) {
    const health = await checkHealth(port);
    if (health) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        await fetch(`http://localhost:${port}/api/shutdown`, {
          method: "POST",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        results.push({ port, sessionDir: health.sessionDir });
        stopped++;
      } catch {
        // Try SIGTERM
        try {
          process.kill(health.pid, "SIGTERM");
          results.push({ port, sessionDir: health.sessionDir });
          stopped++;
        } catch {
          // ignore
        }
      }
    }
  }

  if (stopped === 0) {
    outputJson({ event: "no-servers", stopped: 0 });
    console.error("No running Plan Assistant servers found.");
  } else {
    outputJson({ event: "servers-stopped", stopped, servers: results });
    console.error(`Stopped ${stopped} server(s).`);
  }
}

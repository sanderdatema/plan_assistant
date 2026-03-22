import { json } from "@sveltejs/kit";
import { stop } from "$lib/server/idle-timer.js";
import { broadcastAll } from "$lib/server/sse-manager.js";

const SHUTDOWN_GRACE_MS = 500;

export async function POST() {
  stop();
  broadcastAll("server-shutdown", { reason: "stop-command" });

  // Give SSE clients time to receive the shutdown event
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS);

  return json({ status: "shutting-down" });
}

import { watch } from "chokidar";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { broadcast } from "./sse-manager.js";
import { snapshotVersion } from "./session-manager.js";

const BASE_DIR = join(homedir(), ".plan-assistant", "sessions");

let watcher: ReturnType<typeof watch> | null = null;

export function startWatcher() {
  if (watcher) return;

  watcher = watch(BASE_DIR, {
    ignoreInitial: true,
    depth: 2,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  function handlePlanChange(filePath: string) {
    if (!filePath.endsWith("/plan.json")) return;

    const parts = filePath.split("/");
    const planIdx = parts.lastIndexOf("plan.json");
    if (planIdx < 1) return;
    const sessionId = parts[planIdx - 1];

    console.log(`[file-watcher] plan.json changed for session: ${sessionId}`);

    try {
      const content = readFileSync(filePath, "utf-8");
      const plan = JSON.parse(content);

      snapshotVersion(sessionId, plan);
      broadcast(sessionId, "plan-updated", plan);
    } catch (err) {
      console.error("[file-watcher] Error processing plan change:", err);
    }
  }

  watcher.on("change", handlePlanChange);
  watcher.on("add", handlePlanChange);

  console.log("[file-watcher] Watching", BASE_DIR);
}

export function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

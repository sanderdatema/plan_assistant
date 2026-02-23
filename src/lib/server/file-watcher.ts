import { watch } from "chokidar";
import { readFileSync } from "node:fs";
import { broadcast } from "./sse-manager.js";
import { snapshotVersion, getBaseDir } from "./session-manager.js";

let watcher: ReturnType<typeof watch> | null = null;

export function startWatcher() {
  if (watcher) return;

  watcher = watch(getBaseDir(), {
    ignoreInitial: true,
    depth: 2,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  function handleFileChange(filePath: string) {
    if (filePath.endsWith("/plan.json")) {
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
    } else if (filePath.endsWith("/meta.json")) {
      console.log(`[file-watcher] meta.json changed`);
      broadcast("*", "sessions-updated", {});
    }
  }

  watcher.on("change", handleFileChange);
  watcher.on("add", handleFileChange);

  console.log("[file-watcher] Watching", getBaseDir());
}

import type { Handle } from "@sveltejs/kit";
import { startWatcher } from "$lib/server/file-watcher.js";
import {
  initIdleTimer,
  reset as resetIdleTimer,
} from "$lib/server/idle-timer.js";

startWatcher();
initIdleTimer(() => {
  process.exit(0);
});

export const handle: Handle = async ({ event, resolve }) => {
  resetIdleTimer();
  return resolve(event);
};

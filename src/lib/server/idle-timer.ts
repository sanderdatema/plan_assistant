import { broadcastAll } from "./sse-manager.js";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const TICK_INTERVAL_MS = 10 * 1000; // broadcast remaining time every 10s

let deadline = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;
let onExpireCallback: (() => void) | null = null;

export function initIdleTimer(onExpire: () => void) {
  onExpireCallback = onExpire;
  reset();
}

export function reset() {
  deadline = Date.now() + IDLE_TIMEOUT_MS;

  if (timer) clearTimeout(timer);
  timer = setTimeout(expire, IDLE_TIMEOUT_MS);

  if (!interval) {
    interval = setInterval(tick, TICK_INTERVAL_MS);
  }
}

export function getRemaining(): number {
  return Math.max(0, deadline - Date.now());
}

export function stop() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

function tick() {
  const remaining = getRemaining();
  broadcastAll("idle-timer", { remainingMs: remaining });
}

function expire() {
  stop();
  broadcastAll("idle-timer", { remainingMs: 0 });
  broadcastAll("server-shutdown", { reason: "idle-timeout" });

  const minutes = IDLE_TIMEOUT_MS / 60_000;
  console.log(`[idle-timer] Server idle for ${minutes} minutes, shutting down.`);

  if (onExpireCallback) {
    onExpireCallback();
  }
}

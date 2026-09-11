import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// idle-timer imports broadcastAll from sse-manager purely as a side effect
// (notifying connected clients); mock it so these tests only assert on the
// timer behavior itself.
vi.mock("../src/lib/server/sse-manager.js", () => ({
  broadcastAll: vi.fn(),
  broadcast: vi.fn(),
}));

import { initIdleTimer, reset, stop } from "../src/lib/server/idle-timer.js";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // idle-timer keeps its state at module scope; stop() clears the pending
  // timer/interval so the next test starts from a clean slate.
  stop();
  vi.useRealTimers();
});

describe("idle-timer", () => {
  it("fires the expire callback once the idle timeout elapses", () => {
    const onExpire = vi.fn();
    initIdleTimer(onExpire);

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("does not fire before the idle timeout elapses", () => {
    const onExpire = vi.fn();
    initIdleTimer(onExpire);

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);

    expect(onExpire).not.toHaveBeenCalled();
  });

  it("reset() postpones the expiry by a full timeout period", () => {
    const onExpire = vi.fn();
    initIdleTimer(onExpire);

    // Halfway through the original window, push the deadline out again.
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS / 2);
    reset();

    // The original deadline (at IDLE_TIMEOUT_MS from the start) would have
    // passed by now, but reset() should have moved it a full timeout out
    // from *this* point instead.
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);
    expect(onExpire).not.toHaveBeenCalled();

    // Now the full timeout since reset() has elapsed.
    vi.advanceTimersByTime(2);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("stop() cancels the pending expiry", () => {
    const onExpire = vi.fn();
    initIdleTimer(onExpire);
    stop();

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2);

    expect(onExpire).not.toHaveBeenCalled();
  });
});

import type { PlanJson } from "$lib/types/plan.js";

let instance: ReturnType<typeof createPlanStore> | null = null;

function createPlanStore() {
  let currentPlan = $state<PlanJson | null>(null);
  let idleRemainingMs = $state<number | null>(null);
  let serverShutdown = $state(false);
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    get plan() {
      return currentPlan;
    },
    get idleRemainingMs() {
      return idleRemainingMs;
    },
    get serverShutdown() {
      return serverShutdown;
    },
    set(plan: PlanJson | null) {
      currentPlan = plan;
    },
    connectSSE(sessionId: string) {
      this.disconnectSSE();

      const connect = () => {
        eventSource = new EventSource(`/api/sse/${sessionId}`);

        eventSource.addEventListener("plan-updated", (event) => {
          try {
            const plan = JSON.parse(event.data) as PlanJson;
            currentPlan = plan;
          } catch {
            // ignore parse errors
          }
        });

        eventSource.addEventListener("idle-timer", (event) => {
          try {
            const data = JSON.parse(event.data) as { remainingMs: number };
            idleRemainingMs = data.remainingMs;
          } catch {
            // ignore
          }
        });

        eventSource.addEventListener("server-shutdown", () => {
          serverShutdown = true;
          eventSource?.close();
        });

        eventSource.onerror = () => {
          eventSource?.close();
          if (!serverShutdown) {
            // Reconnect after 3 seconds (but not if server is shutting down)
            reconnectTimer = setTimeout(connect, 3000);
          }
        };
      };

      connect();
    },
    disconnectSSE() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    },
  };
}

export function getPlanStore() {
  if (!instance) instance = createPlanStore();
  return instance;
}

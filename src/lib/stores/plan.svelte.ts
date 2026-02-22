import type { PlanJson } from '$lib/types/plan.js';

let currentPlan = $state<PlanJson | null>(null);
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function getPlanStore() {
	return {
		get plan() {
			return currentPlan;
		},
		set(plan: PlanJson | null) {
			currentPlan = plan;
		},
		connectSSE(sessionId: string) {
			this.disconnectSSE();

			const connect = () => {
				eventSource = new EventSource(`/api/sse/${sessionId}`);

				eventSource.addEventListener('plan-updated', (event) => {
					try {
						const plan = JSON.parse(event.data) as PlanJson;
						currentPlan = plan;
					} catch {
						// ignore parse errors
					}
				});

				eventSource.onerror = () => {
					eventSource?.close();
					// Reconnect after 3 seconds
					reconnectTimer = setTimeout(connect, 3000);
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
		}
	};
}

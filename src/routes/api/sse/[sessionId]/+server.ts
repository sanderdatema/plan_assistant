import type { RequestHandler } from './$types.js';
import { addClient, removeClient } from '$lib/server/sse-manager.js';

export const GET: RequestHandler = async ({ params }) => {
	const sessionId = params.sessionId;
	let interval: ReturnType<typeof setInterval>;
	let client: ReturnType<typeof addClient>;

	const stream = new ReadableStream({
		start(controller) {
			client = addClient(sessionId, controller);

			// Send initial heartbeat
			const encoder = new TextEncoder();
			controller.enqueue(encoder.encode(': heartbeat\n\n'));

			// Heartbeat every 30s to keep connection alive
			interval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': heartbeat\n\n'));
				} catch {
					clearInterval(interval);
					removeClient(client);
				}
			}, 30000);
		},
		cancel() {
			clearInterval(interval);
			removeClient(client);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};

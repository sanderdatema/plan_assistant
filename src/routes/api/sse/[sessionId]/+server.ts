import type { RequestHandler } from './$types.js';
import { addClient, removeClient } from '$lib/server/sse-manager.js';

export const GET: RequestHandler = async ({ params }) => {
	const sessionId = params.sessionId;

	const stream = new ReadableStream({
		start(controller) {
			const client = addClient(sessionId, controller);

			// Send initial heartbeat
			const encoder = new TextEncoder();
			controller.enqueue(encoder.encode(': heartbeat\n\n'));

			// Heartbeat every 30s to keep connection alive
			const interval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': heartbeat\n\n'));
				} catch {
					clearInterval(interval);
					removeClient(client);
				}
			}, 30000);

			// Cleanup when client disconnects
			// @ts-expect-error - cancel is valid on ReadableStream controllers
			controller.cancel = () => {
				clearInterval(interval);
				removeClient(client);
			};
		},
		cancel() {
			// handled above
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

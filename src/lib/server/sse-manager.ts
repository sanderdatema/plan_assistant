type SSEClient = {
	controller: ReadableStreamDefaultController;
	sessionId: string;
};

const clients = new Map<string, Set<SSEClient>>();

export function addClient(sessionId: string, controller: ReadableStreamDefaultController): SSEClient {
	const client: SSEClient = { controller, sessionId };
	if (!clients.has(sessionId)) {
		clients.set(sessionId, new Set());
	}
	clients.get(sessionId)!.add(client);
	return client;
}

export function removeClient(client: SSEClient) {
	const sessionClients = clients.get(client.sessionId);
	if (sessionClients) {
		sessionClients.delete(client);
		if (sessionClients.size === 0) {
			clients.delete(client.sessionId);
		}
	}
}

export function broadcast(sessionId: string, event: string, data: unknown) {
	const sessionClients = clients.get(sessionId);
	if (!sessionClients) return;

	const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
	const encoder = new TextEncoder();
	const encoded = encoder.encode(message);

	for (const client of sessionClients) {
		try {
			client.controller.enqueue(encoded);
		} catch {
			// client disconnected
			sessionClients.delete(client);
		}
	}
}

export function hasClients(sessionId: string): boolean {
	return (clients.get(sessionId)?.size ?? 0) > 0;
}

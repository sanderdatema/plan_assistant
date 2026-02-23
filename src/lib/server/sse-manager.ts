type SSEClient = {
  controller: ReadableStreamDefaultController;
  sessionId: string;
};

const clients = new Map<string, Set<SSEClient>>();

export function addClient(
  sessionId: string,
  controller: ReadableStreamDefaultController,
): SSEClient {
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

function sendToClients(
  clientSet: Set<SSEClient> | undefined,
  encoded: Uint8Array,
) {
  if (!clientSet) return;
  for (const client of clientSet) {
    try {
      client.controller.enqueue(encoded);
    } catch {
      // client disconnected
      clientSet.delete(client);
    }
  }
}

export function broadcast(sessionId: string, event: string, data: unknown) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);

  // Send to session-specific clients
  sendToClients(clients.get(sessionId), encoded);

  // Also send to wildcard subscribers (unless we're already broadcasting to *)
  if (sessionId !== "*") {
    sendToClients(clients.get("*"), encoded);
  }
}

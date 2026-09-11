import { describe, it, expect } from "vitest";
import {
  addClient,
  removeClient,
  broadcast,
  broadcastAll,
} from "../src/lib/server/sse-manager.js";

function makeSpyController() {
  const messages: string[] = [];
  const controller = {
    enqueue: (chunk: Uint8Array) => {
      messages.push(new TextDecoder().decode(chunk));
    },
  } as unknown as ReadableStreamDefaultController<Uint8Array>;
  return { controller, messages };
}

describe("sse-manager", () => {
  it("delivers a broadcast to a subscriber of that session", () => {
    const sessionId = "session-a-" + Math.random().toString(36).slice(2);
    const { controller, messages } = makeSpyController();
    addClient(sessionId, controller);

    broadcast(sessionId, "plan-updated", { foo: 1 });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("event: plan-updated");
    expect(messages[0]).toContain(JSON.stringify({ foo: 1 }));
  });

  it("isolates sessions: a broadcast to session A never reaches session B's client", () => {
    const sessionA = "session-a-" + Math.random().toString(36).slice(2);
    const sessionB = "session-b-" + Math.random().toString(36).slice(2);
    const clientA = makeSpyController();
    const clientB = makeSpyController();
    addClient(sessionA, clientA.controller);
    addClient(sessionB, clientB.controller);

    broadcast(sessionA, "plan-updated", { foo: 1 });

    expect(clientA.messages).toHaveLength(1);
    expect(clientB.messages).toHaveLength(0);
  });

  it("fans a session broadcast out to wildcard ('*') subscribers", () => {
    const sessionId = "session-a-" + Math.random().toString(36).slice(2);
    const sessionSpecific = makeSpyController();
    const wildcard = makeSpyController();
    addClient(sessionId, sessionSpecific.controller);
    addClient("*", wildcard.controller);

    broadcast(sessionId, "plan-updated", { foo: 1 });

    expect(sessionSpecific.messages).toHaveLength(1);
    expect(wildcard.messages).toHaveLength(1);
  });

  it("stops delivering events to a client after removeClient", () => {
    const sessionId = "session-a-" + Math.random().toString(36).slice(2);
    const { controller, messages } = makeSpyController();
    const client = addClient(sessionId, controller);

    removeClient(client);
    broadcast(sessionId, "plan-updated", { foo: 1 });

    expect(messages).toHaveLength(0);
  });

  it("broadcastAll reaches clients regardless of which session they belong to", () => {
    const sessionA = "session-a-" + Math.random().toString(36).slice(2);
    const sessionB = "session-b-" + Math.random().toString(36).slice(2);
    const clientA = makeSpyController();
    const clientB = makeSpyController();
    addClient(sessionA, clientA.controller);
    addClient(sessionB, clientB.controller);

    broadcastAll("server-shutdown", { reason: "idle-timeout" });

    expect(clientA.messages).toHaveLength(1);
    expect(clientB.messages).toHaveLength(1);
  });
});

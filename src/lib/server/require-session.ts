import { error } from "@sveltejs/kit";
import { getSession } from "./session-manager.js";
import type { SessionMeta } from "../types/session.js";

/**
 * Route-layer only: translates a missing session into a SvelteKit 404.
 * Kept out of session-manager.ts because that module is also compiled
 * into the CLI bundle, which doesn't have @sveltejs/kit as a dependency.
 */
export function requireSession(sessionId: string): SessionMeta {
  const session = getSession(sessionId);
  if (!session) throw error(404, "Session not found");
  return session;
}

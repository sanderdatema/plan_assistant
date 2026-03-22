import { json } from "@sveltejs/kit";
import {
  requireSession,
  getFeedback,
  saveFeedback,
  updateSessionStatus,
} from "$lib/server/session-manager.js";
import type { RequestHandler } from "./$types.js";
import type { FeedbackPayload } from "$lib/types/feedback.js";

export const GET: RequestHandler = async ({ params }) => {
  requireSession(params.sessionId);
  const feedback = getFeedback(params.sessionId);
  return json(feedback);
};

export const PUT: RequestHandler = async ({ params, request }) => {
  requireSession(params.sessionId);
  const body = (await request.json()) as FeedbackPayload;
  body.updatedAt = new Date().toISOString();
  saveFeedback(params.sessionId, body);

  // Sync session status for terminal feedback states
  if (body.status === "approved" || body.status === "needs-work") {
    updateSessionStatus(params.sessionId, body.status);
  }

  return json(body);
};

import { json, error } from '@sveltejs/kit';
import { getSession, getFeedback, saveFeedback } from '$lib/server/session-manager.js';
import type { RequestHandler } from './$types.js';
import type { FeedbackPayload } from '$lib/types/feedback.js';

export const GET: RequestHandler = async ({ params }) => {
	const session = getSession(params.sessionId);
	if (!session) throw error(404, 'Session not found');

	const feedback = getFeedback(params.sessionId);
	return json(feedback);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const session = getSession(params.sessionId);
	if (!session) throw error(404, 'Session not found');

	const body = (await request.json()) as FeedbackPayload;
	body.updatedAt = new Date().toISOString();
	saveFeedback(params.sessionId, body);
	return json(body);
};

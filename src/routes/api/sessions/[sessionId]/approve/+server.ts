import { json, error } from '@sveltejs/kit';
import { getSession, getFeedback, saveFeedback, updateSessionStatus } from '$lib/server/session-manager.js';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ params }) => {
	const session = getSession(params.sessionId);
	if (!session) throw error(404, 'Session not found');

	updateSessionStatus(params.sessionId, 'approved');

	// Update feedback with submittedAt
	let feedback = getFeedback(params.sessionId);
	if (feedback) {
		feedback.status = 'approved';
		feedback.submittedAt = new Date().toISOString();
		feedback.updatedAt = new Date().toISOString();
		saveFeedback(params.sessionId, feedback);
	}

	return json({ status: 'approved' });
};

import { json, error } from '@sveltejs/kit';
import { getSession, getFeedback, saveFeedback, getSessionDir } from '$lib/server/session-manager.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RequestHandler } from './$types.js';
import type { SessionMeta } from '$lib/types/session.js';

export const POST: RequestHandler = async ({ params }) => {
	const session = getSession(params.sessionId);
	if (!session) throw error(404, 'Session not found');

	// Update session status
	const dir = getSessionDir(params.sessionId);
	const updatedMeta: SessionMeta = {
		...session,
		status: 'approved',
		updatedAt: new Date().toISOString()
	};
	writeFileSync(join(dir, 'meta.json'), JSON.stringify(updatedMeta, null, 2));

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

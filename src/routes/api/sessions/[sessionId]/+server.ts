import { json, error } from '@sveltejs/kit';
import { getSession, getPlan } from '$lib/server/session-manager.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const session = getSession(params.sessionId);
	if (!session) throw error(404, 'Session not found');

	const plan = getPlan(params.sessionId);
	return json({ session, plan });
};

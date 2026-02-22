import { json, error } from '@sveltejs/kit';
import { getSession, listVersions } from '$lib/server/session-manager.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const session = getSession(params.sessionId);
	if (!session) throw error(404, 'Session not found');

	return json(listVersions(params.sessionId));
};

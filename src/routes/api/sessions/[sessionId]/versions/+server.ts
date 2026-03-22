import { json } from '@sveltejs/kit';
import { requireSession, listVersions } from '$lib/server/session-manager.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	requireSession(params.sessionId);
	return json(listVersions(params.sessionId));
};

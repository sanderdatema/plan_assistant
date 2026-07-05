import { json } from '@sveltejs/kit';
import { listVersions } from '$lib/server/session-manager.js';
import { requireSession } from '$lib/server/require-session.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	requireSession(params.sessionId);
	return json(listVersions(params.sessionId));
};

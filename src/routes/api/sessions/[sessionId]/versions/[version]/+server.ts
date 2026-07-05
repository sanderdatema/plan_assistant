import { json, error } from '@sveltejs/kit';
import { getVersion } from '$lib/server/session-manager.js';
import { requireSession } from '$lib/server/require-session.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	requireSession(params.sessionId);
	const version = parseInt(params.version, 10);
	if (isNaN(version)) throw error(400, 'Invalid version number');

	const plan = getVersion(params.sessionId, version);
	if (!plan) throw error(404, 'Version not found');

	return json(plan);
};

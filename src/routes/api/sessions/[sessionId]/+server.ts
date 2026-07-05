import { json } from '@sveltejs/kit';
import { getPlan } from '$lib/server/session-manager.js';
import { requireSession } from '$lib/server/require-session.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const session = requireSession(params.sessionId);
	const plan = getPlan(params.sessionId);
	return json({ session, plan });
};

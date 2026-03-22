import { json } from '@sveltejs/kit';
import { requireSession, getPlan } from '$lib/server/session-manager.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const session = requireSession(params.sessionId);
	const plan = getPlan(params.sessionId);
	return json({ session, plan });
};

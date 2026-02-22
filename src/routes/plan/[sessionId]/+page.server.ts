import { error } from '@sveltejs/kit';
import { getSession, getPlan, getFeedback, listVersions } from '$lib/server/session-manager.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const session = getSession(params.sessionId);
	if (!session) throw error(404, 'Session not found');

	const plan = getPlan(params.sessionId);
	const feedback = getFeedback(params.sessionId);
	const versions = listVersions(params.sessionId);

	return {
		session,
		plan,
		feedback,
		versions,
		sessionId: params.sessionId
	};
};

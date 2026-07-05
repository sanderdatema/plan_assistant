import { getPlan, getFeedback, listVersions } from '$lib/server/session-manager.js';
import { requireSession } from '$lib/server/require-session.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const session = requireSession(params.sessionId);
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

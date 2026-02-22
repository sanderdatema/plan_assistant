import { listSessions } from '$lib/server/session-manager.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	return {
		sessions: listSessions()
	};
};

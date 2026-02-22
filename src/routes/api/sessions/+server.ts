import { json } from '@sveltejs/kit';
import { listSessions, createSession } from '$lib/server/session-manager.js';
import type { RequestHandler } from './$types.js';
import type { SessionMeta } from '$lib/types/session.js';

export const GET: RequestHandler = async () => {
	return json(listSessions());
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const now = new Date().toISOString();
	const sessionId = body.id || crypto.randomUUID().slice(0, 8);

	const meta: SessionMeta = {
		id: sessionId,
		planTitle: body.planTitle || 'Untitled Plan',
		markdownPath: body.markdownPath || '',
		projectDir: body.projectDir || '',
		status: 'active',
		planVersion: 1,
		createdAt: now,
		updatedAt: now
	};

	createSession(sessionId, meta);
	return json(meta, { status: 201 });
};

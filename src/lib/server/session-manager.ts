import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SessionMeta } from '$lib/types/session.js';
import type { PlanJson } from '$lib/types/plan.js';
import type { FeedbackPayload } from '$lib/types/feedback.js';

const BASE_DIR = join(homedir(), '.plan-assistant', 'sessions');

function ensureDir(dir: string) {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

export function getSessionDir(sessionId: string): string {
	return join(BASE_DIR, sessionId);
}

export function listSessions(): SessionMeta[] {
	ensureDir(BASE_DIR);
	const entries = readdirSync(BASE_DIR, { withFileTypes: true });
	const sessions: SessionMeta[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const metaPath = join(BASE_DIR, entry.name, 'meta.json');
		if (!existsSync(metaPath)) continue;
		try {
			const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as SessionMeta;
			sessions.push(meta);
		} catch {
			// skip invalid sessions
		}
	}

	return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getSession(sessionId: string): SessionMeta | null {
	const metaPath = join(getSessionDir(sessionId), 'meta.json');
	if (!existsSync(metaPath)) return null;
	try {
		return JSON.parse(readFileSync(metaPath, 'utf-8')) as SessionMeta;
	} catch {
		return null;
	}
}

export function createSession(sessionId: string, meta: SessionMeta): void {
	const dir = getSessionDir(sessionId);
	ensureDir(dir);
	ensureDir(join(dir, 'versions'));
	writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
}

export function getPlan(sessionId: string): PlanJson | null {
	const planPath = join(getSessionDir(sessionId), 'plan.json');
	if (!existsSync(planPath)) return null;
	try {
		return JSON.parse(readFileSync(planPath, 'utf-8')) as PlanJson;
	} catch {
		return null;
	}
}

export function getFeedback(sessionId: string): FeedbackPayload | null {
	const fbPath = join(getSessionDir(sessionId), 'feedback.json');
	if (!existsSync(fbPath)) return null;
	try {
		return JSON.parse(readFileSync(fbPath, 'utf-8')) as FeedbackPayload;
	} catch {
		return null;
	}
}

export function saveFeedback(sessionId: string, feedback: FeedbackPayload): void {
	const dir = getSessionDir(sessionId);
	ensureDir(dir);
	writeFileSync(join(dir, 'feedback.json'), JSON.stringify(feedback, null, 2));
}

export function snapshotVersion(sessionId: string, plan: PlanJson): void {
	const dir = join(getSessionDir(sessionId), 'versions');
	ensureDir(dir);
	const versionFile = join(dir, `v${plan.meta.version}.json`);
	writeFileSync(versionFile, JSON.stringify(plan, null, 2));
}

export function listVersions(sessionId: string): number[] {
	const dir = join(getSessionDir(sessionId), 'versions');
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.startsWith('v') && f.endsWith('.json'))
		.map((f) => parseInt(f.slice(1, -5), 10))
		.filter((n) => !isNaN(n))
		.sort((a, b) => a - b);
}

export function getVersion(sessionId: string, version: number): PlanJson | null {
	const versionPath = join(getSessionDir(sessionId), 'versions', `v${version}.json`);
	if (!existsSync(versionPath)) return null;
	try {
		return JSON.parse(readFileSync(versionPath, 'utf-8')) as PlanJson;
	} catch {
		return null;
	}
}

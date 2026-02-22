export interface SessionMeta {
	id: string;
	planTitle: string;
	markdownPath: string;
	projectDir: string;
	status: 'active' | 'approved' | 'archived';
	planVersion: number;
	createdAt: string;
	updatedAt: string;
}

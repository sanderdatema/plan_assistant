<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types.js';
	import type { SessionMeta } from '$lib/types/session.js';
	import { sessionStatusBadgeClass } from '$lib/utils/status.js';

	let { data }: { data: PageData } = $props();

	let polledSessions = $state<SessionMeta[] | null>(null);
	let sessions = $derived(polledSessions ?? data.sessions);

	async function refreshSessions() {
		try {
			const res = await fetch('/api/sessions');
			if (res.ok) {
				polledSessions = await res.json();
			}
		} catch {
			// ignore
		}
	}

	onMount(() => {
		// Use SSE for reactive updates, fall back to polling
		const eventSource = new EventSource('/api/sse/*');
		eventSource.addEventListener('sessions-updated', () => refreshSessions());
		eventSource.addEventListener('plan-updated', () => refreshSessions());

		// Fallback poll every 10s in case SSE is not delivering
		const interval = setInterval(refreshSessions, 10000);

		return () => {
			eventSource.close();
			clearInterval(interval);
		};
	});

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

</script>

<div class="min-h-screen p-8">
	<div class="mx-auto max-w-4xl">
		<h1 class="mb-1 text-2xl font-bold">Plan Assistant</h1>
		<p class="text-text-dim mb-8 text-sm">Review and annotate implementation plans from Claude Code</p>

		{#if sessions.length === 0}
			<div class="bg-surface border-border rounded-lg border p-8 text-center">
				<p class="text-text-dim mb-2 text-lg">No active sessions</p>
				<p class="text-text-dim text-sm">
					Run <code class="bg-surface2 rounded px-1.5 py-0.5 font-mono text-sm text-accent">/create_plan</code> in Claude Code to start a new plan review session.
				</p>
				<div class="text-text-dim mt-3 animate-pulse text-xs">Watching for new sessions...</div>
			</div>
		{:else}
			<div class="space-y-3">
				{#each sessions as session (session.id)}
					<a
						href="/plan/{session.id}"
						class="bg-surface border-border hover:border-accent/50 flex items-center justify-between rounded-lg border p-5 transition-colors"
					>
						<div>
							<h2 class="mb-1 text-lg font-semibold">{session.planTitle}</h2>
							<p class="text-text-dim text-sm">
								v{session.planVersion} &middot; {formatDate(session.updatedAt)}
							</p>
						</div>
						<span class="inline-block rounded-full px-3 py-1 text-xs font-semibold {sessionStatusBadgeClass(session.status)}">
							{session.status}
						</span>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>

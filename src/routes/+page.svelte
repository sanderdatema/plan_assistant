<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types.js';
	import type { SessionMeta } from '$lib/types/session.js';

	let { data }: { data: PageData } = $props();

	let polledSessions = $state<SessionMeta[] | null>(null);
	let sessions = $derived(polledSessions ?? data.sessions);

	onMount(() => {
		// Poll for new/updated sessions every 3 seconds
		const interval = setInterval(async () => {
			try {
				const res = await fetch('/api/sessions');
				if (res.ok) {
					polledSessions = await res.json();
				}
			} catch {
				// ignore
			}
		}, 3000);

		return () => clearInterval(interval);
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

	function statusBadge(status: string) {
		switch (status) {
			case 'active':
				return 'bg-accent/15 text-accent';
			case 'approved':
				return 'bg-green/15 text-green';
			case 'archived':
				return 'bg-text-dim/15 text-text-dim';
			default:
				return 'bg-text-dim/15 text-text-dim';
		}
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
						<span class="inline-block rounded-full px-3 py-1 text-xs font-semibold {statusBadge(session.status)}">
							{session.status}
						</span>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>

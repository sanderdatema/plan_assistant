<script lang="ts">
	import { statusBadgeClass } from '$lib/utils/status.js';

	interface Props {
		meta: {
			title: string;
			date: string;
			ticketRef?: string;
			markdownPath: string;
			version: number;
		};
		status: string;
	}

	let { meta, status }: Props = $props();
</script>

<header class="mb-6">
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-bold">{meta.title}</h1>
			<p class="text-text-dim mt-1 text-sm">
				{meta.date}
				{#if meta.ticketRef}
					&middot; <span class="text-accent">{meta.ticketRef}</span>
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-2">
			<span class="bg-surface2 rounded-full px-3 py-1 text-xs font-semibold text-text-dim">
				v{meta.version}
			</span>
			<span class="rounded-full px-3 py-1 text-xs font-semibold {statusBadgeClass(status)}">
				{status}
			</span>
		</div>
	</div>
	{#if meta.markdownPath}
		<p class="text-text-dim mt-2 text-xs">
			Source: <code class="bg-surface2 text-accent rounded px-1 py-0.5 font-mono text-xs">{meta.markdownPath}</code>
		</p>
	{/if}
</header>

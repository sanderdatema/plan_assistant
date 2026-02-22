<script lang="ts">
	import type { SectionDiff } from '$lib/utils/diff.js';

	interface Props {
		diffs: SectionDiff[];
		fromVersion: number;
		toVersion: number;
		onClose: () => void;
	}

	let { diffs, fromVersion, toVersion, onClose }: Props = $props();

	function statusIcon(status: string) {
		switch (status) {
			case 'added': return '+';
			case 'removed': return '−';
			case 'changed': return '~';
			default: return '';
		}
	}

	function statusColor(status: string) {
		switch (status) {
			case 'added': return 'border-l-green bg-green/5';
			case 'removed': return 'border-l-red bg-red/5';
			case 'changed': return 'border-l-orange bg-orange/5';
			default: return 'border-l-border';
		}
	}

	function statusBadge(status: string) {
		switch (status) {
			case 'added': return 'bg-green/15 text-green';
			case 'removed': return 'bg-red/15 text-red';
			case 'changed': return 'bg-orange/15 text-orange';
			default: return 'bg-text-dim/15 text-text-dim';
		}
	}
</script>

<div class="bg-surface border-border mb-6 rounded-lg border">
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<div class="flex items-center gap-3">
			<h3 class="text-sm font-semibold">
				Changes: v{fromVersion} → v{toVersion}
			</h3>
			<span class="text-text-dim text-xs">
				{diffs.length} section{diffs.length !== 1 ? 's' : ''} changed
			</span>
		</div>
		<button
			class="text-text-dim hover:text-text rounded px-2 py-1 text-xs"
			onclick={onClose}
		>
			Close diff
		</button>
	</div>

	{#if diffs.length === 0}
		<div class="p-4 text-center text-sm text-text-dim">No differences found.</div>
	{:else}
		<div class="divide-y divide-border">
			{#each diffs as diff}
				<div class="border-l-3 p-4 {statusColor(diff.status)}">
					<div class="mb-2 flex items-center gap-2">
						<span class="rounded-full px-2 py-0.5 text-xs font-semibold {statusBadge(diff.status)}">
							{statusIcon(diff.status)} {diff.status}
						</span>
						<span class="text-sm font-medium">{diff.section}</span>
					</div>

					{#if diff.status === 'changed'}
						<div class="grid grid-cols-2 gap-3">
							<div>
								<div class="text-red mb-1 text-xs font-medium">v{fromVersion}</div>
								<div class="bg-bg rounded p-2 text-xs text-text-dim whitespace-pre-wrap">{diff.oldValue}</div>
							</div>
							<div>
								<div class="text-green mb-1 text-xs font-medium">v{toVersion}</div>
								<div class="bg-bg rounded p-2 text-xs text-text-dim whitespace-pre-wrap">{diff.newValue}</div>
							</div>
						</div>
					{:else if diff.status === 'added'}
						<div class="bg-bg rounded p-2 text-xs text-text-dim whitespace-pre-wrap">{diff.newValue}</div>
					{:else if diff.status === 'removed'}
						<div class="bg-bg rounded p-2 text-xs text-text-dim line-through whitespace-pre-wrap">{diff.oldValue}</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

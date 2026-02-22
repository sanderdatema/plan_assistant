<script lang="ts">
	interface Props {
		status: string;
		commentCount: number;
		onApprove: () => void;
		onRequestChanges: () => void;
	}

	let { status, commentCount, onApprove, onRequestChanges }: Props = $props();

	let submitted = $derived(status === 'approved' || status === 'needs-work');
</script>

<div class="fixed right-0 bottom-0 left-0 z-40 border-t border-border bg-surface px-6 py-3">
	<div class="mx-auto flex max-w-5xl items-center justify-between pr-80">
		<div class="text-text-dim text-sm">
			{#if submitted}
				<span class="font-semibold {status === 'approved' ? 'text-green' : 'text-orange'}">
					Feedback {status === 'approved' ? 'submitted — plan approved' : 'submitted — changes requested'}
				</span>
			{:else}
				{commentCount} unresolved comment{commentCount !== 1 ? 's' : ''}
			{/if}
		</div>
		{#if !submitted}
			<div class="flex gap-3">
				<button
					class="cursor-pointer rounded-lg bg-orange/15 px-4 py-2 text-sm font-semibold text-orange hover:bg-orange/25 transition-colors"
					onclick={onRequestChanges}
				>
					Request Changes
				</button>
				<button
					class="cursor-pointer rounded-lg bg-green px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition-colors"
					onclick={onApprove}
				>
					Approve Plan
				</button>
			</div>
		{/if}
	</div>
</div>

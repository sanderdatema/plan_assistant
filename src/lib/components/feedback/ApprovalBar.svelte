<script lang="ts">
	interface Props {
		status: string;
		commentCount: number;
		computedStatus: 'approved' | 'needs-work';
		onSubmit: () => void;
	}

	let { status, commentCount, computedStatus, onSubmit }: Props = $props();

	let flashMessage = $state<string | null>(null);
	let flashColor = $state('text-green');
	let flashTimer: ReturnType<typeof setTimeout> | null = null;

	function handleSubmit() {
		onSubmit();
		if (computedStatus === 'approved') {
			flash('Feedback submitted — plan approved ✓', 'text-green');
		} else {
			flash('Feedback submitted — changes requested', 'text-orange');
		}
	}

	function flash(message: string, color: string) {
		if (flashTimer) clearTimeout(flashTimer);
		flashMessage = message;
		flashColor = color;
		flashTimer = setTimeout(() => { flashMessage = null; }, 3000);
	}
</script>

<div role="toolbar" aria-label="Review actions" class="fixed right-0 bottom-0 left-0 z-40 border-t border-border bg-surface px-6 py-3">
	<div class="mx-auto flex max-w-5xl items-center justify-between pr-80">
		<div class="text-text-dim text-sm">
			{#if flashMessage}
				<span class="font-semibold {flashColor}">{flashMessage}</span>
			{:else if commentCount > 0}
				<span class="text-orange">{commentCount} unresolved comment{commentCount !== 1 ? 's' : ''}</span>
				<span class="ml-2">— will submit as <span class="font-semibold text-orange">needs-work</span></span>
			{:else}
				<span class="text-text-dim">No unresolved comments — will submit as <span class="font-semibold text-green">approved</span></span>
			{/if}
		</div>
		<div class="flex gap-3">
			{#if status !== 'approved' && status !== 'needs-work'}
				<button
					class="cursor-pointer rounded-lg px-5 py-2 text-sm font-semibold transition-colors {computedStatus === 'approved'
						? 'bg-green text-white hover:brightness-110'
						: 'bg-orange/15 text-orange hover:bg-orange/25'}"
					aria-label="Submit feedback"
					onclick={handleSubmit}
				>
					Submit Feedback
				</button>
			{:else}
				<span class="rounded-lg px-5 py-2 text-sm font-semibold {status === 'approved' ? 'bg-green/15 text-green' : 'bg-orange/15 text-orange'}">
					{status === 'approved' ? 'Approved ✓' : 'Changes requested'}
				</span>
			{/if}
		</div>
	</div>
</div>

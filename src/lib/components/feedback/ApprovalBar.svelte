<script lang="ts">
	interface Props {
		status: string;
		commentCount: number;
		onApprove: () => void;
		onRequestChanges: () => void;
	}

	let { status, commentCount, onApprove, onRequestChanges }: Props = $props();

	let flashMessage = $state<string | null>(null);
	let flashColor = $state('text-orange');
	let flashTimer: ReturnType<typeof setTimeout> | null = null;

	function handleApprove() {
		onApprove();
		flash('Feedback submitted — plan approved', 'text-green');
	}

	function handleRequestChanges() {
		onRequestChanges();
		flash('Feedback submitted — changes requested', 'text-orange');
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
			{:else}
				{commentCount} unresolved comment{commentCount !== 1 ? 's' : ''}
			{/if}
		</div>
		<div class="flex gap-3">
			<button
				class="cursor-pointer rounded-lg bg-orange/15 px-4 py-2 text-sm font-semibold text-orange hover:bg-orange/25 transition-colors"
				aria-label="Request changes to the plan"
				onclick={handleRequestChanges}
			>
				Request Changes
			</button>
			<button
				class="cursor-pointer rounded-lg bg-green px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition-colors"
				aria-label="Approve the plan"
				onclick={handleApprove}
			>
				Approve Plan
			</button>
		</div>
	</div>
</div>

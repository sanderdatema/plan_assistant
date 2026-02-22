<script lang="ts">
	interface Props {
		status: string;
		onSetStatus: (status: 'pending' | 'approved' | 'needs-work', note?: string) => void;
	}

	let { status, onSetStatus }: Props = $props();

	const states: { value: 'pending' | 'approved' | 'needs-work'; label: string; color: string }[] = [
		{ value: 'pending', label: 'Pending', color: 'bg-accent/15 text-accent border-accent/30' },
		{ value: 'approved', label: 'Approved', color: 'bg-green/15 text-green border-green/30' },
		{ value: 'needs-work', label: 'Needs Work', color: 'bg-orange/15 text-orange border-orange/30' }
	];
</script>

<div class="flex gap-1" role="radiogroup" aria-label="Phase status">
	{#each states as s}
		<button
			class="cursor-pointer rounded-full border px-2 py-0.5 text-xs font-medium transition-all
				{status === s.value ? s.color : 'border-transparent text-text-dim hover:bg-surface2'}"
			role="radio"
			aria-checked={status === s.value}
			onclick={() => onSetStatus(s.value)}
		>
			{s.label}
		</button>
	{/each}
</div>

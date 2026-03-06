<script lang="ts">
	import { STATUS_LABELS, type PhaseStatus } from '$lib/utils/status.js';

	interface Props {
		status: string;
		onSetStatus: (status: PhaseStatus, note?: string) => void;
	}

	let { status, onSetStatus }: Props = $props();

	const STATE_COLORS: Record<PhaseStatus, string> = {
		'pending': 'bg-accent/15 text-accent border-accent/30',
		'approved': 'bg-green/15 text-green border-green/30',
		'needs-work': 'bg-orange/15 text-orange border-orange/30',
	};

	const states = (Object.keys(STATUS_LABELS) as PhaseStatus[]).map((value) => ({
		value,
		label: STATUS_LABELS[value],
		color: STATE_COLORS[value],
	}));
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

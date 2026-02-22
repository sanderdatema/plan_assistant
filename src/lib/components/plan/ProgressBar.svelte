<script lang="ts">
	import type { Phase } from '$lib/types/plan.js';

	interface Props {
		phases: Phase[];
		phaseStatuses: Record<string, { status: string }>;
	}

	let { phases, phaseStatuses }: Props = $props();

	let approvedCount = $derived(
		phases.filter(p => phaseStatuses[p.id]?.status === 'approved').length
	);
	let progress = $derived(phases.length > 0 ? (approvedCount / phases.length) * 100 : 0);
</script>

<div class="fixed top-0 right-0 left-0 z-50 h-[3px] bg-surface2">
	<div
		class="h-full transition-all duration-400 ease-out"
		style="width: {progress}%; background: linear-gradient(90deg, var(--color-green), #2ea043);"
	></div>
</div>

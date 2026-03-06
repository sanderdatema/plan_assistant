<script lang="ts">
	import type { Phase } from '$lib/types/plan.js';
	import { statusBadgeClass, statusLabel } from '$lib/utils/status.js';
	import type { PhaseStatus } from '$lib/utils/status.js';

	interface Props {
		phases: Phase[];
		phaseStatuses: Record<string, { phaseId: string; status: string; note?: string }>;
		onSetStatus: (phaseId: string, status: PhaseStatus) => void;
	}

	let { phases, phaseStatuses, onSetStatus }: Props = $props();
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead>
			<tr>
				<th class="bg-surface2 border-b border-border px-3 py-2 text-left font-semibold">Phase</th>
				<th class="bg-surface2 border-b border-border px-3 py-2 text-left font-semibold">Focus</th>
				<th class="bg-surface2 border-b border-border px-3 py-2 text-left font-semibold w-32">Status</th>
			</tr>
		</thead>
		<tbody>
			{#each phases as phase}
				{@const status = phaseStatuses[phase.id]?.status ?? 'pending'}
				<tr class="hover:bg-surface transition-colors" class:opacity-50={status === 'approved'}>
					<td class="border-b border-border px-3 py-2 font-medium">
						Phase {phase.number}: {phase.name}
					</td>
					<td class="text-text-dim border-b border-border px-3 py-2">
						{phase.overview.length > 100 ? phase.overview.slice(0, 100) + '...' : phase.overview}
					</td>
					<td class="border-b border-border px-3 py-2">
						<button
							class="inline-block cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold {statusBadgeClass(status)}"
							onclick={() => {
								const next = status === 'pending' ? 'approved' : status === 'approved' ? 'needs-work' : 'pending';
								onSetStatus(phase.id, next);
							}}
						>
							{statusLabel(status)}
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<script lang="ts">
	import type { Phase } from '$lib/types/plan.js';
	import ChangeBlock from './ChangeBlock.svelte';
	import MarkdownBlock from './MarkdownBlock.svelte';
	import PhaseStatusControl from '../feedback/PhaseStatusControl.svelte';

	interface Props {
		phase: Phase;
		phaseStatus?: { phaseId: string; status: string; note?: string };
		onSetStatus: (status: 'pending' | 'approved' | 'needs-work', note?: string) => void;
	}

	let { phase, phaseStatus, onSetStatus }: Props = $props();

	let expanded = $state(true);
</script>

<section data-section="Phase {phase.number}: {phase.name}" class="mt-6">
	<div class="flex items-center gap-3">
		<button
			class="text-accent flex-1 cursor-pointer border-b border-border pb-2 text-left text-xl font-semibold"
			onclick={() => expanded = !expanded}
		>
			<span class="mr-2 inline-block transition-transform" class:rotate-90={expanded}>▶</span>
			Phase {phase.number}: {phase.name}
		</button>
		<PhaseStatusControl
			status={phaseStatus?.status ?? 'pending'}
			{onSetStatus}
		/>
	</div>

	{#if expanded}
		<div class="mt-4 space-y-4">
			<!-- Overview -->
			<MarkdownBlock content={phase.overview} />

			<!-- Changes -->
			{#if phase.changes.length > 0}
				<h3 class="mt-4 mb-2 text-base font-semibold">Changes Required</h3>
				{#each phase.changes as change}
					<ChangeBlock {change} />
				{/each}
			{/if}

			<!-- Success Criteria -->
			<div class="mt-4">
				<h3 class="mb-2 text-base font-semibold">Success Criteria</h3>

				{#if phase.successCriteria.automated.length > 0}
					<h4 class="text-text-dim mt-3 mb-1 text-sm font-medium">Automated Verification</h4>
					<ul class="space-y-1.5 pl-1">
						{#each phase.successCriteria.automated as criterion}
							<li class="text-text-dim flex items-start gap-2 text-sm">
								<input type="checkbox" class="mt-0.5 accent-green" />
								<span>
									{#if criterion.command}
										<code class="bg-surface2 rounded px-1 py-0.5 font-mono text-xs">{criterion.command}</code>
										—
									{/if}
									{criterion.text}
								</span>
							</li>
						{/each}
					</ul>
				{/if}

				{#if phase.successCriteria.manual.length > 0}
					<h4 class="text-text-dim mt-3 mb-1 text-sm font-medium">Manual Verification</h4>
					<ul class="space-y-1.5 pl-1">
						{#each phase.successCriteria.manual as criterion}
							<li class="text-text-dim flex items-start gap-2 text-sm">
								<input type="checkbox" class="mt-0.5 accent-green" />
								<span>{criterion.text}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}

	<hr class="border-border mt-6" />
</section>

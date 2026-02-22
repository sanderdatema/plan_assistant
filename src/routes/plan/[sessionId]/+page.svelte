<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types.js';
	import { getPlanStore } from '$lib/stores/plan.svelte.js';
	import { getFeedbackStore } from '$lib/stores/feedback.svelte.js';
	import PlanHeader from '$lib/components/plan/PlanHeader.svelte';
	import PhaseTable from '$lib/components/plan/PhaseTable.svelte';
	import PhaseCard from '$lib/components/plan/PhaseCard.svelte';
	import MermaidDiagram from '$lib/components/plan/MermaidDiagram.svelte';
	import MarkdownBlock from '$lib/components/plan/MarkdownBlock.svelte';
	import ProgressBar from '$lib/components/plan/ProgressBar.svelte';
	import VersionSelector from '$lib/components/plan/VersionSelector.svelte';
	import DiffView from '$lib/components/plan/DiffView.svelte';
	import FeedbackPanel from '$lib/components/feedback/FeedbackPanel.svelte';
	import SelectionToolbar from '$lib/components/feedback/SelectionToolbar.svelte';
	import ApprovalBar from '$lib/components/feedback/ApprovalBar.svelte';
	import { diffPlans, type SectionDiff } from '$lib/utils/diff.js';
	import type { PlanJson } from '$lib/types/plan.js';

	let { data }: { data: PageData } = $props();

	const planStore = getPlanStore();
	const feedbackStore = getFeedbackStore();

	// Version history state
	let diffs = $state<SectionDiff[]>([]);
	let diffFromVersion = $state(0);
	let showDiff = $state(false);

	async function handleSelectVersion(version: number) {
		if (!plan) return;
		if (version === plan.meta.version) return;
		try {
			const res = await fetch(`/api/sessions/${data.sessionId}/versions/${version}`);
			if (res.ok) {
				const oldPlan = await res.json() as PlanJson;
				planStore.set(oldPlan);
			}
		} catch { /* ignore */ }
	}

	async function handleCompare(fromVersion: number, toVersion: number) {
		try {
			const [fromRes, toRes] = await Promise.all([
				fetch(`/api/sessions/${data.sessionId}/versions/${fromVersion}`),
				toVersion === plan?.meta.version
					? Promise.resolve({ ok: true, json: () => Promise.resolve(plan) })
					: fetch(`/api/sessions/${data.sessionId}/versions/${toVersion}`)
			]);
			if (fromRes.ok && toRes.ok) {
				const fromPlan = await fromRes.json() as PlanJson;
				const toPlan = await toRes.json() as PlanJson;
				diffs = diffPlans(fromPlan, toPlan);
				diffFromVersion = fromVersion;
				showDiff = true;
			}
		} catch { /* ignore */ }
	}

	// Initialize stores from server data
	$effect(() => {
		if (data.plan) {
			planStore.set(data.plan);
			feedbackStore.init(
				data.sessionId,
				data.plan.meta.title,
				data.plan.meta.version,
				data.feedback
			);
		}
	});

	onMount(() => {
		planStore.connectSSE(data.sessionId);
		return () => planStore.disconnectSSE();
	});

	let plan = $derived(planStore.plan);

	// Selection state for commenting
	let selectionText = $state('');
	let selectionSection = $state('');
	let selectionRect = $state<{ x: number; y: number } | null>(null);

	function handleTextSelect(event: MouseEvent) {
		const sel = window.getSelection();
		if (!sel || sel.isCollapsed || !sel.toString().trim()) {
			selectionRect = null;
			return;
		}

		// Don't select inside feedback panel
		const range = sel.getRangeAt(0);
		const container = range.commonAncestorContainer;
		const el = container instanceof Element ? container : container.parentElement;
		if (el?.closest('[data-feedback-panel]')) {
			selectionRect = null;
			return;
		}

		selectionText = sel.toString().trim().replace(/\s+/g, ' ');
		selectionSection = findSection(range.startContainer);
		const rect = range.getBoundingClientRect();
		selectionRect = {
			x: rect.left + rect.width / 2,
			y: rect.top
		};
	}

	function findSection(node: Node): string {
		let el = node instanceof Element ? node : node.parentElement;
		while (el && el !== document.body) {
			// Check for data-section attribute
			if (el instanceof HTMLElement && el.dataset?.section) return el.dataset.section;
			// Walk up to find nearest h2
			let sib: Element | null = el;
			while (sib) {
				if (sib.tagName === 'H2') return sib.textContent?.trim() ?? 'General';
				sib = sib.previousElementSibling;
			}
			el = el.parentElement;
		}
		return 'General';
	}

	function handleAddComment() {
		if (!selectionText) return;
		feedbackStore.addComment(selectionSection, selectionText, '');
		selectionRect = null;
		window.getSelection()?.removeAllRanges();
	}

	function handleClearSelection() {
		selectionRect = null;
	}
</script>

<svelte:document onmouseup={handleTextSelect} onscroll={handleClearSelection} />

{#if plan}
	<ProgressBar phases={plan.phases} phaseStatuses={feedbackStore.phaseStatuses} />

	<div class="min-h-screen pb-20 pr-[22rem] pl-8 pt-4">
		<PlanHeader meta={plan.meta} version={plan.meta.version} status={feedbackStore.status} />

		<!-- Version Selector -->
		<div class="mt-4 mb-2">
			<VersionSelector
				versions={data.versions}
				currentVersion={plan.meta.version}
				onSelectVersion={handleSelectVersion}
				onCompare={handleCompare}
			/>
		</div>

		<!-- Diff View -->
		{#if showDiff && diffs.length > 0}
			<DiffView
				{diffs}
				fromVersion={diffFromVersion}
				toVersion={plan.meta.version}
				onClose={() => { showDiff = false; diffs = []; }}
			/>
		{/if}

		<!-- Overview -->
		<section data-section="Overview">
			<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">Overview</h2>
			<MarkdownBlock content={plan.overview} />
		</section>

		<!-- Diagrams -->
		{#each plan.diagrams as diagram}
			<section data-section="Diagrams">
				<h3 class="mt-6 mb-3 text-lg font-semibold">{diagram.title}</h3>
				<MermaidDiagram code={diagram.mermaidCode} id={diagram.id} />
			</section>
		{/each}

		<!-- Current State -->
		{#if plan.currentState}
			<section data-section="Current State">
				<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">Current State</h2>
				<MarkdownBlock content={plan.currentState} />

				{#if plan.keyDiscoveries.length > 0}
					<h3 class="mt-6 mb-3 text-lg font-semibold">Key Discoveries</h3>
					<ul class="text-text-dim space-y-1.5 pl-5 text-sm">
						{#each plan.keyDiscoveries as discovery}
							<li>
								{discovery.text}
								{#if discovery.codeRef}
									<code class="bg-surface2 text-accent rounded px-1 py-0.5 font-mono text-xs">{discovery.codeRef}</code>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		<!-- Scope Exclusions -->
		{#if plan.scopeExclusions.length > 0}
			<section data-section="Scope Exclusions">
				<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">What We're NOT Doing</h2>
				<div class="grid grid-cols-2 gap-3">
					{#each plan.scopeExclusions as exclusion}
						<div class="bg-surface border-border rounded-lg border border-l-3 border-l-red p-4">
							<div class="text-red text-xs font-semibold uppercase tracking-wide">Out of scope</div>
							<h4 class="mt-1 mb-1 text-sm font-semibold">{exclusion.title}</h4>
							<p class="text-text-dim text-xs">{exclusion.reason}</p>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Implementation Approach -->
		{#if plan.implementationApproach}
			<section data-section="Implementation Approach">
				<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">Implementation Approach</h2>
				<MarkdownBlock content={plan.implementationApproach} />
			</section>
		{/if}

		<!-- Phase Summary Table -->
		<section data-section="Phase Summary">
			<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">Phase Summary</h2>
			<PhaseTable
				phases={plan.phases}
				phaseStatuses={feedbackStore.phaseStatuses}
				onSetStatus={(id, status) => feedbackStore.setPhaseStatus(id, status)}
			/>
		</section>

		<!-- Individual Phases -->
		{#each plan.phases as phase}
			<PhaseCard
				{phase}
				phaseStatus={feedbackStore.phaseStatuses[phase.id]}
				onSetStatus={(status, note) => feedbackStore.setPhaseStatus(phase.id, status, note)}
			/>
		{/each}

		<!-- Testing Strategy -->
		{#if plan.testingStrategy}
			<section data-section="Testing Strategy">
				<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">Testing Strategy</h2>
				{#if plan.testingStrategy.unit.length > 0}
					<h3 class="mt-4 mb-2 text-base font-semibold">Unit Tests</h3>
					<ul class="text-text-dim space-y-1 pl-5 text-sm">
						{#each plan.testingStrategy.unit as item}
							<li>{item}</li>
						{/each}
					</ul>
				{/if}
				{#if plan.testingStrategy.integration.length > 0}
					<h3 class="mt-4 mb-2 text-base font-semibold">Integration Tests</h3>
					<ul class="text-text-dim space-y-1 pl-5 text-sm">
						{#each plan.testingStrategy.integration as item}
							<li>{item}</li>
						{/each}
					</ul>
				{/if}
				{#if plan.testingStrategy.manual.length > 0}
					<h3 class="mt-4 mb-2 text-base font-semibold">Manual Tests</h3>
					<ul class="text-text-dim space-y-1 pl-5 text-sm">
						{#each plan.testingStrategy.manual as item}
							<li>{item}</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		<!-- References -->
		{#if plan.references.length > 0}
			<section data-section="References">
				<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">References</h2>
				<ul class="text-text-dim space-y-1 pl-5 text-sm">
					{#each plan.references as ref}
						<li>{ref}</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>

	<!-- Feedback Panel (right sidebar) -->
	<FeedbackPanel
		comments={feedbackStore.comments}
		onUpdateComment={(id, text) => feedbackStore.updateComment(id, text)}
		onDeleteComment={(id) => feedbackStore.deleteComment(id)}
		onResolveComment={(id) => feedbackStore.resolveComment(id)}
		onAddComment={handleAddComment}
		{selectionText}
	/>

	<!-- Selection Toolbar -->
	<SelectionToolbar
		rect={selectionRect}
		onComment={handleAddComment}
	/>

	<!-- Approval Bar -->
	<ApprovalBar
		status={feedbackStore.status}
		commentCount={feedbackStore.comments.filter(c => !c.resolved).length}
		onApprove={() => feedbackStore.submitFeedback('approved')}
		onRequestChanges={() => feedbackStore.submitFeedback('needs-work')}
	/>
{:else}
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<p class="text-text-dim mb-2 text-lg">Waiting for plan data...</p>
			<p class="text-text-dim text-sm">
				Claude Code will write <code class="bg-surface2 text-accent rounded px-1 py-0.5 font-mono text-xs">plan.json</code> to this session.
			</p>
			<div class="text-text-dim mt-4 animate-pulse text-sm">Listening for updates via SSE</div>
		</div>
	</div>
{/if}

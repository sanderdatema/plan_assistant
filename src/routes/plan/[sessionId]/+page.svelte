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
	import HoverToolbar from '$lib/components/feedback/HoverToolbar.svelte';
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

	// Track the version we initialized feedback for
	let lastFeedbackVersion = $state(0);

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
			lastFeedbackVersion = data.plan.meta.version;
		}
	});

	// Reset feedback when plan version changes via SSE (new version = fresh review)
	$effect(() => {
		if (plan && plan.meta.version !== lastFeedbackVersion) {
			lastFeedbackVersion = plan.meta.version;
			feedbackStore.init(data.sessionId, plan.meta.title, plan.meta.version);
			if (liveRegion) {
				liveRegion.textContent = `Plan updated to version ${plan.meta.version}`;
			}
		}
	});

	onMount(() => {
		planStore.connectSSE(data.sessionId);
		return () => planStore.disconnectSSE();
	});

	let plan = $derived(planStore.plan);

	// Hover state for commenting
	let liveRegion = $state<HTMLDivElement | undefined>();

	let hoveredElement = $state<HTMLElement | null>(null);
	let hoverRect = $state<{ x: number; y: number; width: number; height: number } | null>(null);
	let planContentEl = $state<HTMLDivElement | undefined>();

	function handleMouseMove(event: MouseEvent) {
		const target = event.target as HTMLElement;
		// Don't highlight when hovering over interactive elements
		if (target.closest('button, input, a, select, textarea')) {
			hoveredElement = null;
			hoverRect = null;
			return;
		}
		const commentable = target.closest('[data-commentable]') as HTMLElement | null;

		if (commentable && planContentEl?.contains(commentable)) {
			if (commentable !== hoveredElement) {
				hoveredElement = commentable;
				const rect = commentable.getBoundingClientRect();
				hoverRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
			}
		} else {
			hoveredElement = null;
			hoverRect = null;
		}
	}

	function handleMouseLeave() {
		hoveredElement = null;
		hoverRect = null;
	}

	function handleFocusIn(event: FocusEvent) {
		const target = event.target as HTMLElement;
		if (target.closest('button, input, a, select, textarea')) return;
		const commentable = target.closest('[data-commentable]') as HTMLElement | null;
		if (commentable && planContentEl?.contains(commentable)) {
			hoveredElement = commentable;
			const rect = commentable.getBoundingClientRect();
			hoverRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
		}
	}

	function handleFocusOut(event: FocusEvent) {
		const related = event.relatedTarget as HTMLElement | null;
		// Keep toolbar visible if focus moved into the toolbar
		if (related?.closest('.fixed.z-50')) return;
		hoveredElement = null;
		hoverRect = null;
	}

	function handlePlanClick(event: MouseEvent) {
		if (!hoveredElement) return;

		// Don't comment when clicking buttons, inputs, or links
		const target = event.target as HTMLElement;
		if (target.closest('button, input, a, [data-feedback-panel]')) return;

		const label = hoveredElement.getAttribute('data-comment-label') ?? 'General';
		const quote = (hoveredElement.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);

		feedbackStore.addComment(label, quote, '');
	}

	function handleAddGeneralComment() {
		feedbackStore.addComment('General', '', '');
	}

	// Mark elements that have comments with a visual indicator
	$effect(() => {
		if (!planContentEl) return;
		const commentSections = new Set(
			feedbackStore.comments.filter(c => !c.resolved).map(c => c.section)
		);
		const elements = planContentEl.querySelectorAll('[data-comment-label]');
		for (const el of elements) {
			const label = el.getAttribute('data-comment-label');
			if (label && commentSections.has(label)) {
				el.classList.add('has-comments');
			} else {
				el.classList.remove('has-comments');
			}
		}
	});
</script>

{#if plan}
	<ProgressBar phases={plan.phases} phaseStatuses={feedbackStore.phaseStatuses} />

	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={planContentEl}
		role="region"
		aria-label="Plan content"
		class="min-h-screen pb-20 pr-[22rem] pl-8 pt-4"
		onmousemove={handleMouseMove}
		onmouseleave={handleMouseLeave}
		onfocusin={handleFocusIn}
		onfocusout={handleFocusOut}
		onclick={handlePlanClick}
		onkeydown={(e) => { if (e.key === 'Enter') handlePlanClick(e as unknown as MouseEvent); }}
	>
		<PlanHeader meta={plan.meta} status={feedbackStore.status} />

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
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<section data-section="Overview" data-commentable tabindex="0" data-comment-label="Overview">
			<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">Overview</h2>
			<MarkdownBlock content={plan.overview} sectionPrefix="Overview" />
		</section>

		<!-- Diagrams -->
		{#each plan.diagrams as diagram}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<section data-section="Diagrams" data-commentable tabindex="0" data-comment-label="Diagram: {diagram.title}">
				<h3 class="mt-6 mb-3 text-lg font-semibold">{diagram.title}</h3>
				<MermaidDiagram code={diagram.mermaidCode} id={diagram.id} />
			</section>
		{/each}

		<!-- Current State -->
		{#if plan.currentState}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<section data-section="Current State" data-commentable tabindex="0" data-comment-label="Current State">
				<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">Current State</h2>
				<MarkdownBlock content={plan.currentState} sectionPrefix="Current State" />

				{#if plan.keyDiscoveries.length > 0}
					<h3 class="mt-6 mb-3 text-lg font-semibold">Key Discoveries</h3>
					<ul class="text-text-dim space-y-1.5 pl-5 text-sm">
						{#each plan.keyDiscoveries as discovery}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<li data-commentable tabindex="0" data-comment-label="Key Discovery: {discovery.text.slice(0, 50)}">
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
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<section data-section="Scope Exclusions" data-commentable tabindex="0" data-comment-label="Scope Exclusions">
				<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">What We're NOT Doing</h2>
				<div class="grid grid-cols-2 gap-3">
					{#each plan.scopeExclusions as exclusion}
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<div class="bg-surface border-border rounded-lg border border-l-3 border-l-red p-4" data-commentable tabindex="0" data-comment-label="Scope > {exclusion.title}">
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
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<section data-section="Implementation Approach" data-commentable tabindex="0" data-comment-label="Implementation Approach">
				<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">Implementation Approach</h2>
				<MarkdownBlock content={plan.implementationApproach} sectionPrefix="Implementation Approach" />
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
				subItemStatuses={feedbackStore.subItemStatuses}
				onSetSubItemStatus={(subItemId, status) => feedbackStore.setSubItemStatus(subItemId, phase.id, status, phase.subItems.map(si => si.id))}
			/>
		{/each}

		<!-- Testing Strategy -->
		{#if plan.testingStrategy}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<section data-section="Testing Strategy" data-commentable tabindex="0" data-comment-label="Testing Strategy">
				<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">Testing Strategy</h2>
				{#if plan.testingStrategy.unit.length > 0}
					<h3 class="mt-4 mb-2 text-base font-semibold">Unit Tests</h3>
					<ul class="text-text-dim space-y-1 pl-5 text-sm">
						{#each plan.testingStrategy.unit as item}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<li data-commentable tabindex="0" data-comment-label="Testing > Unit > {item.slice(0, 40)}">{item}</li>
						{/each}
					</ul>
				{/if}
				{#if plan.testingStrategy.integration.length > 0}
					<h3 class="mt-4 mb-2 text-base font-semibold">Integration Tests</h3>
					<ul class="text-text-dim space-y-1 pl-5 text-sm">
						{#each plan.testingStrategy.integration as item}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<li data-commentable tabindex="0" data-comment-label="Testing > Integration > {item.slice(0, 40)}">{item}</li>
						{/each}
					</ul>
				{/if}
				{#if plan.testingStrategy.manual.length > 0}
					<h3 class="mt-4 mb-2 text-base font-semibold">Manual Tests</h3>
					<ul class="text-text-dim space-y-1 pl-5 text-sm">
						{#each plan.testingStrategy.manual as item}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<li data-commentable tabindex="0" data-comment-label="Testing > Manual > {item.slice(0, 40)}">{item}</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		<!-- References -->
		{#if plan.references.length > 0}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<section data-section="References" data-commentable tabindex="0" data-comment-label="References">
				<h2 class="text-accent mt-8 mb-4 border-b border-border pb-2 text-xl font-semibold">References</h2>
				<ul class="text-text-dim space-y-1 pl-5 text-sm">
					{#each plan.references as ref}
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<li data-commentable tabindex="0" data-comment-label="Reference: {ref.slice(0, 50)}">{ref}</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>

	<!-- Hover Highlight Overlay -->
	{#if hoverRect}
		<div
			class="pointer-events-none fixed z-30 rounded border-2 border-blue-500 transition-all duration-150 ease-out"
			style="left: {hoverRect.x}px; top: {hoverRect.y}px; width: {hoverRect.width}px; height: {hoverRect.height}px; background: rgba(59, 130, 246, 0.05);"
		></div>
	{/if}

	<!-- Hover Toolbar -->
	<HoverToolbar
		rect={hoverRect}
		onComment={() => {
			if (!hoveredElement) return;
			const label = hoveredElement.getAttribute('data-comment-label') ?? 'General';
			const quote = (hoveredElement.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
			feedbackStore.addComment(label, quote, '');
		}}
	/>

	<!-- Feedback Panel (right sidebar) -->
	<FeedbackPanel
		comments={feedbackStore.comments}
		onUpdateComment={(id, text) => feedbackStore.updateComment(id, text)}
		onDeleteComment={(id) => feedbackStore.deleteComment(id)}
		onResolveComment={(id) => feedbackStore.resolveComment(id)}
		onAddGeneralComment={handleAddGeneralComment}
	/>

	<!-- Approval Bar -->
	<ApprovalBar
		status={feedbackStore.status}
		commentCount={feedbackStore.comments.filter(c => !c.resolved).length}
		onApprove={() => feedbackStore.submitFeedback('approved')}
		onRequestChanges={() => feedbackStore.submitFeedback('needs-work')}
	/>

	<!-- Live region for screen reader announcements -->
	<div class="sr-only" aria-live="polite" bind:this={liveRegion}></div>
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

<style>
	:global(.has-comments) {
		border-left: 3px solid rgb(59, 130, 246);
		padding-left: 0.5rem;
	}
</style>

<script lang="ts">
	import type { FeedbackComment } from '$lib/types/feedback.js';
	import FeedbackItem from './FeedbackItem.svelte';

	interface Props {
		comments: FeedbackComment[];
		onUpdateComment: (id: string, text: string) => void;
		onDeleteComment: (id: string) => void;
		onResolveComment: (id: string) => void;
		onAddComment: () => void;
		selectionText: string;
	}

	let { comments, onUpdateComment, onDeleteComment, onResolveComment, onAddComment, selectionText }: Props = $props();

	let unresolvedCount = $derived(comments.filter(c => !c.resolved).length);
</script>

<aside
	data-feedback-panel
	class="fixed top-2 right-4 z-40 flex w-80 max-h-[calc(100vh-1rem)] flex-col rounded-xl bg-[#0f172a] shadow-xl shadow-black/35"
>
	<!-- Header -->
	<header class="border-b border-white/10 px-4 py-3">
		<h3 class="flex items-center gap-2 text-base font-semibold text-slate-200">
			Review
			<span class="bg-accent/15 text-accent inline-block rounded-full px-2 py-0.5 text-xs font-semibold">
				{unresolvedCount}
			</span>
		</h3>
		<p class="mt-1 text-xs text-slate-400">
			Select text to add inline comments. Click Submit when done.
		</p>
		<button
			class="mt-2 w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
			disabled={!selectionText}
			onclick={onAddComment}
		>
			Comment on selection
		</button>
	</header>

	<!-- Comment List -->
	<div class="flex-1 space-y-2 overflow-y-auto p-3">
		{#if comments.length === 0}
			<div class="rounded-lg border border-dashed border-slate-600 p-3 text-sm text-slate-400">
				No comments yet. Select text or right-click any element to start reviewing.
			</div>
		{:else}
			{#each comments as comment (comment.id)}
				<FeedbackItem
					{comment}
					onUpdate={(text) => onUpdateComment(comment.id, text)}
					onDelete={() => onDeleteComment(comment.id)}
					onResolve={() => onResolveComment(comment.id)}
				/>
			{/each}
		{/if}
	</div>
</aside>

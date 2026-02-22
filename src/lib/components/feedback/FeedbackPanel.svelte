<script lang="ts">
	import type { FeedbackComment } from '$lib/types/feedback.js';
	import FeedbackItem from './FeedbackItem.svelte';

	interface Props {
		comments: FeedbackComment[];
		onUpdateComment: (id: string, text: string) => void;
		onDeleteComment: (id: string) => void;
		onResolveComment: (id: string) => void;
		onAddGeneralComment: () => void;
	}

	let { comments, onUpdateComment, onDeleteComment, onResolveComment, onAddGeneralComment }: Props = $props();

	let unresolvedCount = $derived(comments.filter(c => !c.resolved).length);
</script>

<!-- svelte-ignore a11y_no_redundant_roles -->
<aside
	data-feedback-panel
	role="complementary"
	aria-label="Review comments"
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
			Hover over plan elements to comment. Click Submit when done.
		</p>
		<button
			class="mt-2 w-full cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
			onclick={onAddGeneralComment}
		>
			Add comment
		</button>
	</header>

	<!-- Comment List -->
	<div class="flex-1 space-y-2 overflow-y-auto p-3">
		{#if comments.length === 0}
			<div class="rounded-lg border border-dashed border-slate-600 p-3 text-sm text-slate-400">
				No comments yet. Hover and click on any plan element to add a comment.
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

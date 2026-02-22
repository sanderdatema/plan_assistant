<script lang="ts">
	import type { FeedbackComment } from '$lib/types/feedback.js';

	interface Props {
		comment: FeedbackComment;
		onUpdate: (text: string) => void;
		onDelete: () => void;
		onResolve: () => void;
	}

	let { comment, onUpdate, onDelete, onResolve }: Props = $props();

	let editing = $state(false);
	let editText = $state('');

	// Sync editText when comment prop changes (including initial)
	$effect(() => {
		editText = comment.comment;
	});

	function save() {
		onUpdate(editText);
		editing = false;
	}

	function cancel() {
		editText = comment.comment;
		editing = false;
	}

	// Auto-open edit mode for empty comments (just added)
	$effect(() => {
		if (!comment.comment) {
			editing = true;
		}
	});
</script>

<article
	class="rounded-lg border p-3 {comment.resolved
		? 'border-slate-700 bg-slate-800/40 opacity-60'
		: 'border-slate-600/40 bg-slate-800/90'}"
>
	<div class="mb-1 text-[0.7rem] text-blue-300">{comment.section}</div>

	{#if comment.quote}
		<p class="mb-2 rounded-md border border-slate-700 bg-[#0f172a] px-2 py-1.5 text-xs italic text-slate-300">
			"{comment.quote.length > 120 ? comment.quote.slice(0, 120) + '...' : comment.quote}"
		</p>
	{/if}

	{#if editing}
		<textarea
			class="w-full resize-y rounded-lg border border-slate-600 bg-[#0f172a] px-2 py-1.5 font-sans text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
			bind:value={editText}
			placeholder="Your comment..."
			rows="3"
			onkeydown={(e) => {
				if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); }
				if (e.key === 'Escape') { e.preventDefault(); cancel(); }
			}}
		></textarea>
		<div class="mt-1.5 flex gap-1.5">
			<button class="flex-1 rounded-md bg-green-600 px-2 py-1 text-xs text-green-50" onclick={save}>
				Save <kbd class="opacity-70">⌘↵</kbd>
			</button>
			<button class="flex-1 rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200" onclick={cancel}>
				Cancel <kbd class="opacity-70">Esc</kbd>
			</button>
		</div>
	{:else}
		<p class="text-xs text-slate-300">{comment.comment}</p>
		<div class="mt-1.5 flex gap-1.5">
			<button class="rounded-md bg-blue-700 px-2 py-1 text-xs text-white" onclick={() => editing = true}>
				Edit
			</button>
			<button
				class="rounded-md px-2 py-1 text-xs {comment.resolved ? 'bg-green-800 text-green-200' : 'bg-slate-700 text-slate-300'}"
				onclick={onResolve}
			>
				{comment.resolved ? 'Resolved' : 'Resolve'}
			</button>
			<button class="rounded-md bg-red-900 px-2 py-1 text-xs text-red-200" onclick={onDelete}>
				Delete
			</button>
		</div>
	{/if}
</article>

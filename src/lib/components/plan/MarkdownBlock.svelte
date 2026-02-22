<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import hljs from 'highlight.js';

	interface Props {
		content: string;
		sectionPrefix?: string;
	}

	let { content, sectionPrefix }: Props = $props();

	let html = $derived.by(() => {
		marked.setOptions({
			gfm: true,
			breaks: false
		});
		return marked.parse(content) as string;
	});

	let container: HTMLDivElement;

	// Highlight code blocks and add commentable attributes after render
	$effect(() => {
		if (container && html) {
			const blocks = container.querySelectorAll('pre code');
			blocks.forEach((block) => {
				hljs.highlightElement(block as HTMLElement);
			});

			// Add data-commentable to block-level elements
			const blockTags = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'table'];
			const blockEls = container.querySelectorAll(blockTags.join(', '));
			blockEls.forEach((el) => {
				el.setAttribute('data-commentable', '');
				const text = el.textContent?.trim().slice(0, 60) ?? '';
				const label = sectionPrefix ? `${sectionPrefix} > ${text}` : text;
				el.setAttribute('data-comment-label', label);
			});
		}
	});
</script>

<div
	bind:this={container}
	class="markdown-content text-text-dim text-sm leading-relaxed"
>
	{@html html}
</div>

<style>
	.markdown-content :global(h1),
	.markdown-content :global(h2),
	.markdown-content :global(h3) {
		color: var(--color-text);
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}
	.markdown-content :global(p) {
		margin-bottom: 0.5rem;
	}
	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		padding-left: 1.5rem;
		margin-bottom: 0.5rem;
	}
	.markdown-content :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
	}
	.markdown-content :global(p code),
	.markdown-content :global(li code) {
		background: var(--color-surface2);
		padding: 1px 5px;
		border-radius: 3px;
	}
	.markdown-content :global(pre) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 1rem;
		overflow-x: auto;
		margin: 0.75rem 0;
		font-size: 0.82rem;
	}
	.markdown-content :global(blockquote) {
		border-left: 3px solid var(--color-accent);
		padding-left: 1rem;
		margin: 1rem 0;
		color: var(--color-text-dim);
	}
	.markdown-content :global(a) {
		color: var(--color-accent);
		text-decoration: none;
	}
	.markdown-content :global(a:hover) {
		text-decoration: underline;
	}
	.markdown-content :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
		font-size: 0.85rem;
	}
	.markdown-content :global(th),
	.markdown-content :global(td) {
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}
	.markdown-content :global(th) {
		background: var(--color-surface2);
		color: var(--color-text);
		font-weight: 600;
	}
</style>

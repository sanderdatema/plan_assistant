<script lang="ts">
	import { marked } from 'marked';

	interface Props {
		content: string;
	}

	let { content }: Props = $props();

	// Inline-only rendering: no wrapping <p>, so this is safe inside <li>, <h4>, <span> etc.
	let html = $derived(marked.parseInline(content, { gfm: true }) as string);
</script>

<span class="inline-markdown">{@html html}</span>

<style>
	/* Mirrors the inline rules from MarkdownBlock.svelte so both render alike.
	   No color/size here on purpose: the surrounding element owns those. */
	.inline-markdown :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
		background: var(--color-surface2);
		padding: 1px 5px;
		border-radius: 3px;
	}
	.inline-markdown :global(a) {
		color: var(--color-accent);
		text-decoration: none;
	}
	.inline-markdown :global(a:hover) {
		text-decoration: underline;
	}
</style>

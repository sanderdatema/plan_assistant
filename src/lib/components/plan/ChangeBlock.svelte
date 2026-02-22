<script lang="ts">
	import type { Change } from '$lib/types/plan.js';
	import hljs from 'highlight.js';

	interface Props {
		change: Change;
		commentLabel?: string;
	}

	let { change, commentLabel }: Props = $props();
	let codeEl = $state<HTMLElement | undefined>();

	$effect(() => {
		if (codeEl && change.codeSnippet) {
			// Reset any previous highlighting
			codeEl.removeAttribute('data-highlighted');
			if (change.codeLanguage) {
				codeEl.className = `language-${change.codeLanguage}`;
			} else {
				codeEl.className = '';
			}
			hljs.highlightElement(codeEl);
		}
	});
</script>

<div class="mb-3" data-commentable data-comment-label={commentLabel ?? change.componentName}>
	<h4 class="text-text-dim mb-1 text-sm font-medium">{change.componentName}</h4>
	<p class="mb-1 text-sm">
		<strong>File:</strong>
		<code class="bg-surface2 text-accent rounded px-1 py-0.5 font-mono text-xs">{change.filePath}</code>
	</p>
	<p class="text-text-dim text-sm">{change.description}</p>
	{#if change.codeSnippet}
		<pre class="bg-surface border-border mt-2 overflow-x-auto rounded-md border p-3 text-xs"><code bind:this={codeEl} class={change.codeLanguage ? `language-${change.codeLanguage}` : ''}>{change.codeSnippet}</code></pre>
	{/if}
</div>

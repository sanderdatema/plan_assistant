<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		code: string;
		id: string;
	}

	let { code, id }: Props = $props();

	let container: HTMLDivElement;
	let rendered = $state(false);

	onMount(async () => {
		const mermaid = (await import('mermaid')).default;
		mermaid.initialize({
			startOnLoad: false,
			theme: 'dark',
			themeVariables: {
				primaryColor: '#1f6feb',
				primaryTextColor: '#e6edf3',
				primaryBorderColor: '#30363d',
				lineColor: '#8b949e',
				secondaryColor: '#161b22',
				tertiaryColor: '#1c2129'
			}
		});

		try {
			const { svg } = await mermaid.render(`mermaid-${id}`, code);
			container.innerHTML = svg;
			rendered = true;
		} catch (err) {
			container.textContent = `Diagram error: ${err}`;
		}
	});
</script>

<div class="bg-surface border-border overflow-x-auto rounded-lg border p-6">
	<div bind:this={container} class="flex justify-center">
		{#if !rendered}
			<p class="text-text-dim text-sm">Loading diagram...</p>
		{/if}
	</div>
</div>

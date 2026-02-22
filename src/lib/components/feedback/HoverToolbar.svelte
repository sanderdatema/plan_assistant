<script lang="ts">
	interface Props {
		rect: { x: number; y: number; width: number; height: number } | null;
		onComment: () => void;
	}

	let { rect, onComment }: Props = $props();
</script>

{#if rect}
	<div
		class="fixed z-50 pointer-events-auto"
		style="left: {rect.x + rect.width - 4}px; top: {rect.y - 4}px; transform: translate(-100%, -100%);"
	>
		<button
			class="cursor-pointer rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white shadow-lg shadow-black/30 hover:bg-blue-500 transition-colors"
			onclick={(e: MouseEvent) => { e.stopPropagation(); onComment(); }}
		>
			Comment
		</button>
	</div>
{/if}

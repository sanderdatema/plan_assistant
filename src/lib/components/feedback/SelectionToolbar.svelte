<script lang="ts">
	interface Props {
		rect: { x: number; y: number } | null;
		onComment: () => void;
	}

	let { rect, onComment }: Props = $props();
</script>

{#if rect}
	<div
		class="fixed z-50"
		style="left: {rect.x}px; top: {rect.y}px; transform: translateX(-50%); margin-top: -42px;"
	>
		<button
			class="cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white shadow-lg shadow-black/30"
			onclick={onComment}
		>
			Comment
		</button>
	</div>
{/if}

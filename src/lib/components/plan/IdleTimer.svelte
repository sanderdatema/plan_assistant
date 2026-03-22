<script lang="ts">
	import { getPlanStore } from '$lib/stores/plan.svelte.js';

	const store = getPlanStore();

	let display = $derived.by(() => {
		const ms = store.idleRemainingMs;
		if (ms === null) return null;

		if (store.serverShutdown) return 'Server stopped';

		const totalSec = Math.ceil(ms / 1000);
		const min = Math.floor(totalSec / 60);
		const sec = totalSec % 60;
		return `${min}:${sec.toString().padStart(2, '0')}`;
	});

	let isUrgent = $derived(
		store.idleRemainingMs !== null && store.idleRemainingMs < 60_000
	);
</script>

{#if display !== null}
	<span
		class="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
		class:bg-surface2={!isUrgent && !store.serverShutdown}
		class:text-text-dim={!isUrgent && !store.serverShutdown}
		class:bg-red-900={isUrgent || store.serverShutdown}
		class:text-red-200={isUrgent || store.serverShutdown}
		title={store.serverShutdown ? 'Server has shut down due to inactivity' : `Server idle timeout: ${display} remaining`}
	>
		{#if store.serverShutdown}
			Server stopped
		{:else}
			⏱ {display}
		{/if}
	</span>
{/if}

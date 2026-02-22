<script lang="ts">
	interface Props {
		versions: number[];
		currentVersion: number;
		onSelectVersion: (version: number) => void;
		onCompare: (oldVersion: number, newVersion: number) => void;
	}

	let { versions, currentVersion, onSelectVersion, onCompare }: Props = $props();

	let compareMode = $state(false);
	let compareFrom = $state(0);

	function handleCompare() {
		if (compareFrom > 0 && compareFrom !== currentVersion) {
			onCompare(compareFrom, currentVersion);
		}
	}
</script>

{#if versions.length > 0}
	<div class="flex items-center gap-3">
		<div class="flex items-center gap-2">
			<label class="text-text-dim text-xs" for="version-select">Version:</label>
			<select
				id="version-select"
				class="bg-surface2 border-border rounded px-2 py-1 text-xs text-text"
				value={currentVersion}
				onchange={(e) => onSelectVersion(parseInt(e.currentTarget.value, 10))}
			>
				<option value={currentVersion}>v{currentVersion} (current)</option>
				{#each [...versions].reverse() as v}
					{#if v !== currentVersion}
						<option value={v}>v{v}</option>
					{/if}
				{/each}
			</select>
		</div>

		{#if versions.length > 0}
			<button
				class="text-text-dim hover:text-accent rounded px-2 py-1 text-xs transition-colors"
				onclick={() => compareMode = !compareMode}
			>
				{compareMode ? 'Hide diff' : 'Compare versions'}
			</button>
		{/if}

		{#if compareMode}
			<div class="flex items-center gap-2">
				<select
					class="bg-surface2 border-border rounded px-2 py-1 text-xs text-text"
					bind:value={compareFrom}
				>
					<option value={0}>Select base...</option>
					{#each [...versions].reverse() as v}
						{#if v !== currentVersion}
							<option value={v}>v{v}</option>
						{/if}
					{/each}
				</select>
				<span class="text-text-dim text-xs">→ v{currentVersion}</span>
				<button
					class="bg-accent/15 text-accent rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
					disabled={!compareFrom}
					onclick={handleCompare}
				>
					Show diff
				</button>
			</div>
		{/if}
	</div>
{/if}

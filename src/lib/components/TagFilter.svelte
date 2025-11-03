<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import { X } from 'lucide-svelte';

	interface Props {
		availableTags?: string[];
		selectedTags?: string[];
		onTagToggle?: (tag: string) => void;
		onClear?: () => void;
		matchAllTags?: boolean;
		onMatchModeChange?: (matchAll: boolean) => void;
		maxDisplay?: number;
	}

	let {
		availableTags = [],
		selectedTags = [],
		onTagToggle,
		onClear,
		matchAllTags = false,
		onMatchModeChange,
		maxDisplay = 20
	}: Props = $props();

	const displayTags = $derived(availableTags.slice(0, maxDisplay));
	const hasMore = $derived(availableTags.length > maxDisplay);

	function handleTagClick(tag: string) {
		if (onTagToggle) {
			onTagToggle(tag);
		}
	}

	function handleClear() {
		if (onClear) {
			onClear();
		}
	}

	function handleMatchModeChange() {
		if (onMatchModeChange) {
			onMatchModeChange(!matchAllTags);
		}
	}
</script>

<div class="space-y-3" role="region" aria-label="Tag filter">
	<!-- Selected Tags -->
	{#if selectedTags.length > 0}
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm font-medium text-muted-foreground">Filtered by:</span>
			{#each selectedTags as tag (tag)}
				<Badge
					variant="default"
					class="cursor-pointer hover:opacity-80 pr-1"
					onclick={() => handleTagClick(tag)}
					role="button"
					aria-label={`Remove tag filter: ${tag}`}
				>
					{tag}
					<button
						class="ml-1.5 rounded-sm hover:bg-white/20 p-0.5"
						onclick|stopPropagation={() => handleTagClick(tag)}
						aria-label="Remove"
					>
						<X class="h-3 w-3" />
					</button>
				</Badge>
			{/each}

			<button
				class="text-xs text-muted-foreground hover:text-foreground underline"
				onclick={handleClear}
			>
				Clear all
			</button>
		</div>

		<!-- Match Mode Toggle -->
		{#if selectedTags.length > 1}
			<div class="flex items-center gap-2 text-sm">
				<span class="text-muted-foreground">Match:</span>
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={matchAllTags}
						onchange={handleMatchModeChange}
						class="rounded border-input"
					/>
					<span>All tags (AND)</span>
				</label>
				<span class="text-muted-foreground text-xs">
					{matchAllTags ? 'Conversations must have all selected tags' : 'Conversations can have any selected tag'}
				</span>
			</div>
		{/if}
	{/if}

	<!-- Available Tags -->
	{#if availableTags.length > 0}
		<div class="space-y-2">
			<span class="text-sm font-medium text-muted-foreground">Available tags:</span>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each displayTags as tag (tag)}
					<Badge
						variant={selectedTags.includes(tag) ? 'default' : 'outline'}
						class="cursor-pointer hover:opacity-80"
						onclick={() => handleTagClick(tag)}
						role="button"
						aria-label={selectedTags.includes(tag) ? `Remove tag filter: ${tag}` : `Add tag filter: ${tag}`}
						aria-pressed={selectedTags.includes(tag)}
					>
						{tag}
					</Badge>
				{/each}

				{#if hasMore}
					<span class="text-xs text-muted-foreground">
						+{availableTags.length - maxDisplay} more
					</span>
				{/if}
			</div>
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">No tags available</p>
	{/if}
</div>

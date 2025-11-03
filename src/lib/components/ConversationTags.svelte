<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';

	interface Props {
		tags?: string[];
		maxDisplay?: number;
		variant?: 'default' | 'secondary' | 'outline';
		size?: 'sm' | 'md';
		onClick?: (tag: string) => void;
	}

	let {
		tags = [],
		maxDisplay = 5,
		variant = 'secondary',
		size = 'sm',
		onClick
	}: Props = $props();

	const displayTags = $derived(tags.slice(0, maxDisplay));
	const remainingCount = $derived(Math.max(0, tags.length - maxDisplay));
	const hasMore = $derived(remainingCount > 0);

	function handleTagClick(tag: string) {
		if (onClick) {
			onClick(tag);
		}
	}
</script>

{#if tags.length > 0}
	<div class="flex flex-wrap items-center gap-1.5" role="list" aria-label="Conversation tags">
		{#each displayTags as tag (tag)}
			<Badge
				{variant}
				class={size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'}
				role="listitem"
				onclick={() => handleTagClick(tag)}
				class:cursor-pointer={!!onClick}
				class:hover:opacity-80={!!onClick}
			>
				{tag}
			</Badge>
		{/each}

		{#if hasMore}
			<Badge
				variant="outline"
				class={size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'}
				role="listitem"
			>
				+{remainingCount}
			</Badge>
		{/if}
	</div>
{/if}

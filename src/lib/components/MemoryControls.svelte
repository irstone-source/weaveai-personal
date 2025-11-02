<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Brain, Database, Lock, Unlock, Eye, EyeOff, Focus, X } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Input } from '$lib/components/ui/input';

	interface Props {
		userId?: string;
		onMemoryModeChange?: (mode: 'persistent' | 'humanized') => void;
		onFocusModeChange?: (categories: string[]) => void;
	}

	let { userId, onMemoryModeChange, onFocusModeChange }: Props = $props();

	// State
	let memoryMode: 'persistent' | 'humanized' = $state('humanized');
	let includePrivate = $state(false);
	let privateTags: string[] = $state([]);
	let newTag = $state('');
	let focusMode = $state({
		active: false,
		categories: [] as string[]
	});
	let memoryStats = $state({
		total: 0,
		byType: { working: 0, consolidated: 0, wisdom: 0 },
		byPrivacy: { public: 0, contextual: 0, private: 0, vault: 0 },
		avgImportance: 0,
		avgStrength: 0,
		permanent: 0
	});

	// Predefined focus categories
	const FOCUS_CATEGORIES = [
		{ id: 'health', label: 'Health', emoji: '💪' },
		{ id: 'wealth', label: 'Wealth', emoji: '💰' },
		{ id: 'happiness', label: 'Happiness', emoji: '😊' },
		{ id: 'stewart-golf', label: 'Stewart Golf', emoji: '⛳' },
		{ id: 'landscaping', label: 'Landscaping', emoji: '🌿' }
	];

	// Toggle memory mode
	async function toggleMemoryMode() {
		const newMode = memoryMode === 'persistent' ? 'humanized' : 'persistent';

		try {
			const response = await fetch('/api/memory/mode', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: newMode })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to toggle mode');
			}

			memoryMode = newMode;
			toast.success(
				newMode === 'persistent'
					? '📁 Persistent mode enabled: Perfect recall forever'
					: '🧠 Humanized mode enabled: Natural focus on what matters'
			);

			onMemoryModeChange?.(newMode);
		} catch (error) {
			console.error('Error toggling memory mode:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to toggle memory mode');
		}
	}

	// Toggle focus category
	async function toggleFocusCategory(categoryId: string) {
		let newCategories: string[];

		if (focusMode.categories.includes(categoryId)) {
			// Remove category
			newCategories = focusMode.categories.filter((c) => c !== categoryId);
		} else {
			// Add category
			newCategories = [...focusMode.categories, categoryId];
		}

		if (newCategories.length === 0) {
			// Deactivate focus mode
			await deactivateFocusMode();
		} else {
			// Update focus mode
			await activateFocusMode(newCategories);
		}
	}

	// Activate focus mode
	async function activateFocusMode(categories: string[]) {
		try {
			const response = await fetch('/api/memory/focus', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					categories,
					boostFactor: 2.0,
					durationHours: 4
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to activate focus mode');
			}

			focusMode = {
				active: true,
				categories
			};

			toast.success(`🎯 Focus mode: ${categories.join(', ')}`);
			onFocusModeChange?.(categories);
		} catch (error) {
			console.error('Error activating focus mode:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to activate focus mode');
		}
	}

	// Deactivate focus mode
	async function deactivateFocusMode() {
		try {
			const response = await fetch('/api/memory/focus', {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to deactivate focus mode');
			}

			focusMode = {
				active: false,
				categories: []
			};

			toast.success('Focus mode deactivated');
			onFocusModeChange?.([]);
		} catch (error) {
			console.error('Error deactivating focus mode:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to deactivate focus mode');
		}
	}

	// Add private tag
	function addPrivateTag() {
		if (newTag.trim() && !privateTags.includes(newTag.trim())) {
			privateTags = [...privateTags, newTag.trim()];
			newTag = '';
		}
	}

	// Remove private tag
	function removePrivateTag(tag: string) {
		privateTags = privateTags.filter((t) => t !== tag);
	}

	// Load memory stats
	async function loadMemoryStats() {
		if (!userId) return;

		try {
			const response = await fetch('/api/memory/mode');
			if (!response.ok) return;

			const data = await response.json();
			if (data.stats) {
				memoryStats = data.stats;
			}
		} catch (error) {
			console.error('Error loading memory stats:', error);
		}
	}

	// Load stats on mount
	$effect(() => {
		if (userId) {
			loadMemoryStats();
		}
	});
</script>

<div class="memory-controls border rounded-lg p-4 mb-4 bg-card">
	<!-- Header with Mode Toggle -->
	<div class="flex justify-between items-center mb-4">
		<h3 class="text-lg font-semibold flex items-center gap-2">
			<Brain class="w-5 h-5" />
			Memory System
		</h3>

		<!-- Mode Toggle -->
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-2">
				<Database
					class={`w-4 h-4 transition-colors ${memoryMode === 'persistent' ? 'text-blue-500' : 'text-gray-400'}`}
				/>
				<Switch checked={memoryMode === 'humanized'} onCheckedChange={toggleMemoryMode} />
				<Brain
					class={`w-4 h-4 transition-colors ${memoryMode === 'humanized' ? 'text-green-500' : 'text-gray-400'}`}
				/>
			</div>

			<Badge variant={memoryMode === 'persistent' ? 'default' : 'secondary'}>
				{memoryMode === 'persistent' ? '📁 Persistent' : '🧠 Humanized'}
			</Badge>
		</div>
	</div>

	<!-- Mode Description -->
	<div class="text-xs text-muted-foreground mb-4 p-3 bg-muted/50 rounded-md">
		{#if memoryMode === 'persistent'}
			<p>
				<strong>Persistent Mode:</strong> All memories saved forever. No degradation. Perfect recall.
				Ideal for research, documentation, and strategic planning.
			</p>
		{:else}
			<p>
				<strong>Humanized Mode:</strong> Important memories strengthen with use. Trivial details fade
				naturally over time. Focus on what matters most.
			</p>
		{/if}
	</div>

	<!-- Privacy Controls -->
	<div class="flex items-center justify-between py-2 border-t">
		<div class="flex items-center gap-2">
			{#if includePrivate}
				<Unlock class="w-4 h-4 text-green-500" />
				<span class="text-sm">Private memories accessible</span>
			{:else}
				<Lock class="w-4 h-4 text-gray-400" />
				<span class="text-sm text-muted-foreground">Private memories hidden</span>
			{/if}
		</div>

		<Button
			variant="ghost"
			size="sm"
			onclick={() => (includePrivate = !includePrivate)}
			class="flex items-center gap-2"
		>
			{#if includePrivate}
				<EyeOff class="w-4 h-4" />
				Hide Private
			{:else}
				<Eye class="w-4 h-4" />
				Show Private
			{/if}
		</Button>
	</div>

	<!-- Private Tags Input -->
	{#if includePrivate}
		<div class="mt-3 animate-in slide-in-from-top duration-200">
			<div class="flex gap-2">
				<Input
					type="text"
					placeholder="Enter private tags (e.g., client:stewart-golf, financial)"
					bind:value={newTag}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addPrivateTag();
						}
					}}
					class="text-sm"
				/>
				<Button size="sm" onclick={addPrivateTag}>Add</Button>
			</div>

			{#if privateTags.length > 0}
				<div class="flex gap-2 mt-2 flex-wrap">
					{#each privateTags as tag}
						<Badge variant="outline" class="flex items-center gap-1 pr-1">
							{tag}
							<button
								onclick={() => removePrivateTag(tag)}
								class="ml-1 hover:bg-destructive/20 rounded-sm p-0.5"
							>
								<X class="w-3 h-3" />
							</button>
						</Badge>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Focus Mode -->
	<div class="mt-4 pt-4 border-t">
		<div class="flex items-center justify-between mb-3">
			<h4 class="text-sm font-medium flex items-center gap-2">
				<Focus class="w-4 h-4" />
				Focus Mode
				{#if focusMode.active}
					<Badge variant="default" class="text-xs">Active</Badge>
				{/if}
			</h4>

			{#if focusMode.active}
				<Button variant="ghost" size="sm" onclick={deactivateFocusMode} class="text-xs">
					Clear All
				</Button>
			{/if}
		</div>

		<div class="flex gap-2 flex-wrap">
			{#each FOCUS_CATEGORIES as category}
				<button
					onclick={() => toggleFocusCategory(category.id)}
					class={`px-3 py-1.5 text-sm rounded-md transition-all hover:scale-105 ${
						focusMode.categories.includes(category.id)
							? 'bg-blue-500 text-white'
							: 'bg-muted hover:bg-muted/80'
					}`}
				>
					<span class="mr-1">{category.emoji}</span>
					{category.label}
				</button>
			{/each}
		</div>

		<p class="text-xs text-muted-foreground mt-2">
			Boost recall for selected categories (2x for 4 hours)
		</p>
	</div>

	<!-- Memory Statistics -->
	{#if memoryStats.total > 0}
		<div class="mt-4 pt-4 border-t">
			<h4 class="text-sm font-medium mb-2">Memory Statistics</h4>
			<div class="grid grid-cols-2 gap-2 text-xs">
				<div class="bg-muted/50 px-2 py-1 rounded">
					<span class="text-muted-foreground">Total:</span>
					<span class="ml-1 font-medium">{memoryStats.total}</span>
				</div>
				<div class="bg-muted/50 px-2 py-1 rounded">
					<span class="text-muted-foreground">Permanent:</span>
					<span class="ml-1 font-medium">{memoryStats.permanent}</span>
				</div>
				<div class="bg-muted/50 px-2 py-1 rounded">
					<span class="text-muted-foreground">Avg Importance:</span>
					<span class="ml-1 font-medium">{memoryStats.avgImportance.toFixed(1)}/10</span>
				</div>
				<div class="bg-muted/50 px-2 py-1 rounded">
					<span class="text-muted-foreground">Avg Strength:</span>
					<span class="ml-1 font-medium">{memoryStats.avgStrength.toFixed(1)}/10</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.memory-controls {
		animation: fadeIn 0.3s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>

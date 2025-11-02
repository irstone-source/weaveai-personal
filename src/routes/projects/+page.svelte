<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';

	// Import icons
	import { CirclePlusIcon, ExternalLinkIcon, CheckCircleIcon } from '$lib/icons/index.js';

	// Get data from server load function
	let { data } = $props();

	// Sync state
	let isSyncing = $state(false);
	let syncMessage = $state('');
	let syncError = $state('');

	// Format date helper
	function formatDate(date: Date | null): string {
		if (!date) return 'Not set';
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	// Get status badge variant
	function getStatusBadge(status: string) {
		const variants = {
			planning: { variant: 'secondary' as const, label: 'Planning' },
			active: { variant: 'default' as const, label: 'Active' },
			on_hold: { variant: 'outline' as const, label: 'On Hold' },
			completed: { variant: 'default' as const, label: 'Completed' },
			archived: { variant: 'secondary' as const, label: 'Archived' }
		};
		return variants[status as keyof typeof variants] || variants.active;
	}

	// Calculate project progress
	function calculateProgress(taskCounts: any): number {
		if (taskCounts.total === 0) return 0;
		return Math.round((taskCounts.done / taskCounts.total) * 100);
	}

	// Sync Linear issues
	async function syncLinear() {
		isSyncing = true;
		syncMessage = '';
		syncError = '';

		try {
			const response = await fetch('/api/integrations/linear/sync', {
				method: 'POST'
			});

			const result = await response.json();

			if (response.ok) {
				syncMessage = result.message || `Synced ${result.syncedCount} issues`;
				// Reload page to show new projects
				setTimeout(() => window.location.reload(), 1500);
			} else {
				syncError = result.message || 'Failed to sync Linear issues';
			}
		} catch (error) {
			syncError = 'Failed to sync Linear issues. Please try again.';
			console.error('Sync error:', error);
		} finally {
			isSyncing = false;
		}
	}

	// Handle Linear button click
	function handleLinearClick() {
		if (data.linearConnected) {
			syncLinear();
		} else {
			window.location.href = '/api/integrations/linear/auth';
		}
	}
</script>

<svelte:head>
	<title>Projects - WeaveAI</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Client Projects</h1>
			<p class="text-muted-foreground mt-1">
				Manage projects and collaborate with your clients
			</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={handleLinearClick} disabled={isSyncing}>
				<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
					<path d="M2.5 21.5L21.5 2.5M3 12c0-5 4-9 9-9M21 12c0 5-4 9-9 9"></path>
				</svg>
				{isSyncing ? 'Syncing...' : data.linearConnected ? 'Sync Linear' : 'Connect Linear'}
			</Button>
			<Button onclick={() => (window.location.href = '/projects/new')}>
				<CirclePlusIcon class="w-4 h-4 mr-2" />
				New Project
			</Button>
		</div>
	</div>

	<!-- Sync Status Messages -->
	{#if syncMessage}
		<div class="p-4 bg-green-50 border border-green-200 rounded-md">
			<div class="flex items-center gap-3">
				<CheckCircleIcon class="h-5 w-5 text-green-600 flex-shrink-0" />
				<p class="text-sm text-green-700">{syncMessage}</p>
			</div>
		</div>
	{/if}

	{#if syncError}
		<div class="p-4 bg-red-50 border border-red-200 rounded-md">
			<div class="flex items-center gap-3">
				<svg class="h-5 w-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
				</svg>
				<p class="text-sm text-red-700">{syncError}</p>
			</div>
		</div>
	{/if}

	<!-- Linear Connection Status -->
	{#if data.linearConnected}
		<div class="p-4 bg-green-50 border border-green-200 rounded-md">
			<div class="flex items-center gap-3">
				<CheckCircleIcon class="h-5 w-5 text-green-600 flex-shrink-0" />
				<div>
					<h3 class="font-medium text-green-900">Linear Connected</h3>
					<p class="text-sm text-green-700 mt-0.5">
						Connected to team: <strong>{data.linearTeam}</strong>
					</p>
				</div>
			</div>
		</div>
	{:else}
		<div class="p-4 bg-blue-50 border border-blue-200 rounded-md">
			<div class="flex items-center gap-3">
				<svg class="h-5 w-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
						clip-rule="evenodd"
					></path>
				</svg>
				<div>
					<h3 class="font-medium text-blue-900">Connect Linear</h3>
					<p class="text-sm text-blue-700 mt-0.5">
						Connect your Linear workspace to sync projects and issues automatically.
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Projects Grid -->
	{#if data.projects && data.projects.length > 0}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each data.projects as project}
				{@const statusBadge = getStatusBadge(project.status)}
				{@const progress = calculateProgress(project.taskCounts)}

				<Card.Root class="hover:shadow-lg transition-shadow cursor-pointer">
					<a href="/projects/{project.id}" class="block">
						<Card.Header>
							<div class="flex items-start justify-between mb-2">
								<div class="flex-1">
									<Card.Title class="text-lg font-semibold flex items-center gap-2">
										{project.name}
										{#if project.linearProjectId}
											<ExternalLinkIcon class="w-3 h-3 text-muted-foreground" />
										{/if}
									</Card.Title>
									<Card.Description class="text-sm mt-1">
										{project.clientName}
									</Card.Description>
								</div>
								<Badge variant={statusBadge.variant}>
									{statusBadge.label}
								</Badge>
							</div>
							{#if project.description}
								<p class="text-sm text-muted-foreground line-clamp-2">
									{project.description}
								</p>
							{/if}
						</Card.Header>

						<Card.Content>
							<!-- Task Summary -->
							<div class="space-y-3">
								<!-- Progress Bar -->
								<div>
									<div class="flex items-center justify-between text-xs mb-1">
										<span class="text-muted-foreground">Progress</span>
										<span class="font-medium">{progress}%</span>
									</div>
									<div class="w-full bg-secondary rounded-full h-2">
										<div
											class="bg-primary rounded-full h-2 transition-all"
											style="width: {progress}%"
										></div>
									</div>
								</div>

								<!-- Task Counts -->
								<div class="grid grid-cols-3 gap-2 text-xs">
									<div class="text-center p-2 bg-secondary/50 rounded">
										<div class="font-semibold">{project.taskCounts.in_progress}</div>
										<div class="text-muted-foreground">In Progress</div>
									</div>
									<div class="text-center p-2 bg-secondary/50 rounded">
										<div class="font-semibold">{project.taskCounts.todo}</div>
										<div class="text-muted-foreground">To Do</div>
									</div>
									<div class="text-center p-2 bg-secondary/50 rounded">
										<div class="font-semibold">{project.taskCounts.done}</div>
										<div class="text-muted-foreground">Done</div>
									</div>
								</div>
							</div>
						</Card.Content>

						<Card.Footer class="text-xs text-muted-foreground flex items-center justify-between">
							<div class="flex items-center gap-4">
								{#if project.projectMembers && project.projectMembers.length > 0}
									<div class="flex items-center gap-1">
										<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
											<path
												d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
											></path>
										</svg>
										<span>{project.projectMembers.length} members</span>
									</div>
								{/if}
								{#if project.targetDate}
									<div class="flex items-center gap-1">
										<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
												clip-rule="evenodd"
											></path>
										</svg>
										<span>Due {formatDate(project.targetDate)}</span>
									</div>
								{/if}
							</div>
							<div class="text-xs">
								Updated {formatDate(project.updatedAt)}
							</div>
						</Card.Footer>
					</a>
				</Card.Root>
			{/each}
		</div>
	{:else}
		<!-- Empty State -->
		<Card.Root class="border-dashed">
			<Card.Content class="flex flex-col items-center justify-center py-16 text-center">
				<div
					class="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4"
				>
					<svg class="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
						></path>
					</svg>
				</div>
				<h3 class="text-lg font-semibold mb-2">No projects yet</h3>
				<p class="text-sm text-muted-foreground mb-6 max-w-sm">
					{#if data.linearConnected}
						Click "Sync Linear" to import your projects, or create a new project manually.
					{:else}
						Connect your Linear workspace to import projects, or create a new project manually.
					{/if}
				</p>
				<div class="flex gap-3">
					{#if !data.linearConnected}
						<Button onclick={() => (window.location.href = '/api/integrations/linear/auth')}>
							<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
								<path d="M2.5 21.5L21.5 2.5M3 12c0-5 4-9 9-9M21 12c0 5-4 9-9 9"></path>
							</svg>
							Connect Linear
						</Button>
					{/if}
					<Button variant={data.linearConnected ? 'default' : 'outline'} onclick={() => (window.location.href = '/projects/new')}>
						<CirclePlusIcon class="w-4 h-4 mr-2" />
						Create Project
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Help Text -->
	<div class="text-sm text-muted-foreground mt-8">
		<p>
			<strong>Tip:</strong> Projects synced from Linear will automatically update when you sync.
			Manual projects can be managed independently. Use guest access tokens to share projects
			with clients without requiring them to create an account.
		</p>
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>

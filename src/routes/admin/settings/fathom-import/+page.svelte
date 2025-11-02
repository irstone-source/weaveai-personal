<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Card } from "$lib/components/ui/card";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Badge } from "$lib/components/ui/badge";
	import { Progress } from "$lib/components/ui/progress";
	import { RefreshCwIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from "lucide-svelte";

	let { data } = $props();

	// Import state
	let isImporting = $state(false);
	let importProgress = $state<{
		status: 'idle' | 'in_progress' | 'completed' | 'failed';
		total: number;
		imported: number;
		failed: number;
		errors: string[];
	}>({
		status: 'idle',
		total: 0,
		imported: 0,
		failed: 0,
		errors: []
	});

	// Import options
	let importDays = $state(30);
	let includeTranscripts = $state(true);
	let includeSummaries = $state(true);

	// Handle import
	async function handleImport() {
		isImporting = true;
		importProgress = {
			status: 'in_progress',
			total: 0,
			imported: 0,
			failed: 0,
			errors: []
		};

		try {
			const response = await fetch('/api/integrations/fathom/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					days: importDays,
					includeTranscripts,
					includeSummaries
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Import failed');
			}

			importProgress = result.progress;

			// Refresh stats after successful import
			await refreshStats();

		} catch (error) {
			importProgress.status = 'failed';
			importProgress.errors.push(error instanceof Error ? error.message : 'Unknown error');
		} finally {
			isImporting = false;
		}
	}

	// Refresh statistics
	async function refreshStats() {
		try {
			const response = await fetch('/api/integrations/fathom/import');
			const result = await response.json();

			if (response.ok) {
				data.stats = result.stats;
			}
		} catch (error) {
			console.error('Failed to refresh stats:', error);
		}
	}

	// Format date for display
	function formatDate(date: Date | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Calculate progress percentage
	let progressPercentage = $derived(importProgress.total > 0
		? Math.round((importProgress.imported / importProgress.total) * 100)
		: 0);
</script>

<div class="container mx-auto py-8 space-y-8">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold">Fathom Meeting Import</h1>
		<p class="text-muted-foreground mt-2">
			Import your historical Fathom meetings for client intelligence analysis
		</p>
	</div>

	<!-- Statistics Card -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title>Import Statistics</Card.Title>
				<Button variant="ghost" size="sm" onclick={refreshStats}>
					<RefreshCwIcon class="w-4 h-4 mr-2" />
					Refresh
				</Button>
			</div>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div class="space-y-1">
					<p class="text-sm text-muted-foreground">Total Meetings</p>
					<p class="text-2xl font-bold">{data.stats.totalMeetings}</p>
				</div>
				<div class="space-y-1">
					<p class="text-sm text-muted-foreground">With Transcripts</p>
					<p class="text-2xl font-bold">{data.stats.withTranscripts}</p>
				</div>
				<div class="space-y-1">
					<p class="text-sm text-muted-foreground">With Insights</p>
					<p class="text-2xl font-bold">{data.stats.withInsights}</p>
				</div>
				<div class="space-y-1">
					<p class="text-sm text-muted-foreground">Processed</p>
					<p class="text-2xl font-bold">{data.stats.processed}</p>
				</div>
			</div>

			{#if data.stats.totalMeetings > 0}
				<div class="mt-6 pt-6 border-t grid grid-cols-2 gap-4">
					<div>
						<p class="text-sm text-muted-foreground">Oldest Meeting</p>
						<p class="font-medium">{formatDate(data.stats.oldestMeeting)}</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">Newest Meeting</p>
						<p class="font-medium">{formatDate(data.stats.newestMeeting)}</p>
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Import Card -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Import Historical Meetings</Card.Title>
			<Card.Description>
				Import your past Fathom meetings to build client intelligence profiles
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<!-- Import Options -->
			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="importDays">Time Period (days)</Label>
					<Input
						id="importDays"
						type="number"
						bind:value={importDays}
						min={1}
						max={365}
						disabled={isImporting}
					/>
					<p class="text-xs text-muted-foreground">
						Import meetings from the last {importDays} days
					</p>
				</div>

				<div class="space-y-3">
					<div class="flex items-center space-x-2">
						<input
							type="checkbox"
							id="includeTranscripts"
							bind:checked={includeTranscripts}
							disabled={isImporting}
							class="w-4 h-4 rounded border-gray-300"
						/>
						<Label for="includeTranscripts" class="font-normal cursor-pointer">
							Include transcripts
						</Label>
					</div>

					<div class="flex items-center space-x-2">
						<input
							type="checkbox"
							id="includeSummaries"
							bind:checked={includeSummaries}
							disabled={isImporting}
							class="w-4 h-4 rounded border-gray-300"
						/>
						<Label for="includeSummaries" class="font-normal cursor-pointer">
							Include AI summaries and action items
						</Label>
					</div>
				</div>
			</div>

			<!-- Import Button -->
			<Button
				onclick={handleImport}
				disabled={isImporting}
				class="w-full"
			>
				{#if isImporting}
					<RefreshCwIcon class="w-4 h-4 mr-2 animate-spin" />
					Importing...
				{:else}
					<RefreshCwIcon class="w-4 h-4 mr-2" />
					Start Import
				{/if}
			</Button>

			<!-- Progress -->
			{#if importProgress.status !== 'idle'}
				<div class="space-y-4 pt-4 border-t">
					<div class="space-y-2">
						<div class="flex items-center justify-between text-sm">
							<span class="font-medium">
								{#if importProgress.status === 'in_progress'}
									Importing...
								{:else if importProgress.status === 'completed'}
									Import Completed
								{:else}
									Import Failed
								{/if}
							</span>
							<span class="text-muted-foreground">
								{importProgress.imported} / {importProgress.total}
							</span>
						</div>
						<Progress value={progressPercentage} class="h-2" />
					</div>

					<!-- Status Alert -->
					{#if importProgress.status === 'completed'}
						<div class="flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
							<CheckCircleIcon class="w-4 h-4" />
							<p class="text-sm">
								Successfully imported {importProgress.imported} meetings
								{#if importProgress.failed > 0}
									({importProgress.failed} failed)
								{/if}
							</p>
						</div>
					{:else if importProgress.status === 'failed'}
						<div class="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
							<AlertCircleIcon class="w-4 h-4" />
							<p class="text-sm">
								Import failed. Please check the errors below.
							</p>
						</div>
					{/if}

					<!-- Errors -->
					{#if importProgress.errors.length > 0}
						<div class="space-y-2">
							<p class="text-sm font-medium text-destructive">Errors:</p>
							<div class="space-y-1 max-h-40 overflow-y-auto">
								{#each importProgress.errors as error}
									<p class="text-xs text-muted-foreground bg-destructive/10 p-2 rounded">
										{error}
									</p>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Info Card -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<InfoIcon class="w-5 h-5" />
				What happens during import?
			</Card.Title>
		</Card.Header>
		<Card.Content>
			<ol class="space-y-3 text-sm">
				<li class="flex gap-3">
					<Badge variant="secondary" class="shrink-0">1</Badge>
					<div>
						<p class="font-medium">Fetch meetings from Fathom</p>
						<p class="text-muted-foreground">
							We'll retrieve all meetings from the specified time period
						</p>
					</div>
				</li>
				<li class="flex gap-3">
					<Badge variant="secondary" class="shrink-0">2</Badge>
					<div>
						<p class="font-medium">Import transcripts</p>
						<p class="text-muted-foreground">
							Full transcripts with speaker attribution will be stored
						</p>
					</div>
				</li>
				<li class="flex gap-3">
					<Badge variant="secondary" class="shrink-0">3</Badge>
					<div>
						<p class="font-medium">Extract insights</p>
						<p class="text-muted-foreground">
							AI-generated summaries, action items, and key points are saved
						</p>
					</div>
				</li>
				<li class="flex gap-3">
					<Badge variant="secondary" class="shrink-0">4</Badge>
					<div>
						<p class="font-medium">Build client profiles</p>
						<p class="text-muted-foreground">
							Client intelligence profiles are automatically created from meeting data
						</p>
					</div>
				</li>
			</ol>
		</Card.Content>
	</Card.Root>
</div>

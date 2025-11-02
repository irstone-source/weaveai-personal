<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Switch } from '$lib/components/ui/switch';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Loader2, RefreshCw, Database, Brain, FileText, MessageSquare } from 'lucide-svelte';

	interface TeamStats {
		projects: number;
		issues: number;
		interactions: number;
		vectors: number;
	}

	interface Team {
		id: string;
		linearTeamId: string;
		linearTeamName: string;
		projectId: string | null;
		syncEnabled: boolean;
		autoCreated: boolean;
		pineconeIndexName: string | null;
		lastSyncAt: string | null;
		stats: TeamStats;
	}

	let teams: Team[] = [];
	let loading = true;
	let syncing = false;
	let error: string | null = null;
	let syncResult: any = null;

	onMount(async () => {
		await loadTeams();
	});

	async function loadTeams() {
		try {
			loading = true;
			const response = await fetch('/api/linear/teams');
			if (!response.ok) throw new Error('Failed to load teams');
			const data = await response.json();
			teams = data.teams;
			error = null;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	async function triggerSync(type: 'full' | 'incremental' | 'embeddings-only' = 'full') {
		try {
			syncing = true;
			syncResult = null;
			error = null;

			const response = await fetch(`/api/linear/sync?type=${type}`, {
				method: 'POST'
			});

			if (!response.ok) throw new Error('Sync failed');

			syncResult = await response.json();
			await loadTeams(); // Reload teams to update stats
		} catch (err) {
			error = (err as Error).message;
		} finally {
			syncing = false;
		}
	}

	async function toggleTeamSync(team: Team) {
		try {
			const response = await fetch(`/api/linear/teams`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					teamId: team.id,
					syncEnabled: !team.syncEnabled
				})
			});

			if (!response.ok) throw new Error('Failed to update team');

			await loadTeams();
		} catch (err) {
			error = (err as Error).message;
		}
	}

	function formatDate(date: string | null): string {
		if (!date) return 'Never';
		const d = new Date(date);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days}d ago`;
		return d.toLocaleDateString();
	}
</script>

<div class="container mx-auto p-6 max-w-6xl space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold">Linear Intelligence</h1>
		<p class="text-muted-foreground mt-2">
			Manage Linear data sync and per-client Pinecone indexes for RAG-powered chat
		</p>
	</div>

	<!-- Error Alert -->
	{#if error}
		<Alert variant="destructive">
			<AlertDescription>{error}</AlertDescription>
		</Alert>
	{/if}

	<!-- Sync Result -->
	{#if syncResult}
		<Alert>
			<AlertDescription>
				<div class="space-y-2">
					<p class="font-semibold">{syncResult.message}</p>
					{#if syncResult.sync}
						<p class="text-sm">
							Linear: {syncResult.sync.stats.teamsCreated || 0} teams, {syncResult.sync.stats
								.projectsCreated || 0} projects, {syncResult.sync.stats.issuesCreated || 0} issues
						</p>
					{/if}
					{#if syncResult.interactions}
						<p class="text-sm">
							Interactions: {syncResult.interactions.linearComments.imported || 0} comments, {syncResult
								.interactions.meetings.imported || 0} meetings
						</p>
					{/if}
					{#if syncResult.embeddings}
						<p class="text-sm">
							Embeddings: {syncResult.embeddings.projects.processed || 0} projects, {syncResult
								.embeddings.issues.processed || 0} issues, {syncResult.embeddings.interactions
								.processed || 0} interactions
						</p>
					{/if}
					{#if syncResult.errors.length > 0}
						<p class="text-sm text-destructive">{syncResult.errors.length} errors occurred</p>
					{/if}
				</div>
			</AlertDescription>
		</Alert>
	{/if}

	<!-- Sync Actions -->
	<Card>
		<CardHeader>
			<CardTitle>Sync Actions</CardTitle>
			<CardDescription>Manually trigger data synchronization</CardDescription>
		</CardHeader>
		<CardContent class="flex flex-wrap gap-3">
			<Button on:click={() => triggerSync('full')} disabled={syncing}>
				{#if syncing}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<RefreshCw class="mr-2 h-4 w-4" />
				{/if}
				Full Sync
			</Button>
			<Button variant="secondary" on:click={() => triggerSync('incremental')} disabled={syncing}>
				<RefreshCw class="mr-2 h-4 w-4" />
				Incremental Sync
			</Button>
			<Button variant="outline" on:click={() => triggerSync('embeddings-only')} disabled={syncing}>
				<Brain class="mr-2 h-4 w-4" />
				Embeddings Only
			</Button>
		</CardContent>
	</Card>

	<!-- Teams List -->
	<Card>
		<CardHeader>
			<CardTitle>Linear Teams ({teams.length})</CardTitle>
			<CardDescription>Client teams synced from Linear</CardDescription>
		</CardHeader>
		<CardContent>
			{#if loading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if teams.length === 0}
				<div class="text-center py-8 text-muted-foreground">
					<p>No teams found. Run a full sync to discover teams from Linear.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each teams as team (team.id)}
						<div class="border rounded-lg p-4 space-y-3">
							<!-- Team Header -->
							<div class="flex items-start justify-between">
								<div class="space-y-1">
									<div class="flex items-center gap-2">
										<h3 class="font-semibold text-lg">{team.linearTeamName}</h3>
										{#if team.autoCreated}
											<Badge variant="secondary">Auto-created</Badge>
										{/if}
										{#if team.syncEnabled}
											<Badge variant="default">Syncing</Badge>
										{:else}
											<Badge variant="outline">Disabled</Badge>
										{/if}
									</div>
									<p class="text-sm text-muted-foreground">
										Last sync: {formatDate(team.lastSyncAt)}
									</p>
									{#if team.pineconeIndexName}
										<p class="text-xs text-muted-foreground font-mono">
											Index: {team.pineconeIndexName}
										</p>
									{/if}
								</div>

								<!-- Toggle Sync -->
								<div class="flex items-center gap-2">
									<span class="text-sm text-muted-foreground">Sync enabled</span>
									<Switch checked={team.syncEnabled} onCheckedChange={() => toggleTeamSync(team)} />
								</div>
							</div>

							<!-- Stats Grid -->
							<div class="grid grid-cols-4 gap-3">
								<div class="flex items-center gap-2 text-sm">
									<Database class="h-4 w-4 text-muted-foreground" />
									<span class="font-medium">{team.stats.projects}</span>
									<span class="text-muted-foreground">Projects</span>
								</div>
								<div class="flex items-center gap-2 text-sm">
									<FileText class="h-4 w-4 text-muted-foreground" />
									<span class="font-medium">{team.stats.issues}</span>
									<span class="text-muted-foreground">Issues</span>
								</div>
								<div class="flex items-center gap-2 text-sm">
									<MessageSquare class="h-4 w-4 text-muted-foreground" />
									<span class="font-medium">{team.stats.interactions}</span>
									<span class="text-muted-foreground">Interactions</span>
								</div>
								<div class="flex items-center gap-2 text-sm">
									<Brain class="h-4 w-4 text-muted-foreground" />
									<span class="font-medium">{team.stats.vectors}</span>
									<span class="text-muted-foreground">Vectors</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

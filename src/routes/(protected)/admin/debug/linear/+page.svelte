<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Card } from '$lib/components/ui/card';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';

	// Tool execution state
	let executing = false;
	let result = '';
	let error = '';

	// Tool parameters
	let teamId = '';
	let issueTitle = '';
	let issueDescription = '';
	let issuePriority = 0;
	let projectId = '';

	// Update issue parameters
	let updateIssueId = '';
	let updateTitle = '';
	let updateDescription = '';
	let updatePriority: number | undefined;
	let updateStateId = '';

	// Comment parameters
	let commentIssueId = '';
	let commentBody = '';

	// Team query parameters
	let queryTeamId = '';

	// User ID from session
	let userId = '';

	onMount(async () => {
		// Get session to retrieve userId
		const sessionResponse = await fetch('/api/auth/session');
		const sessionData = await sessionResponse.json();
		if (sessionData?.user?.id) {
			userId = sessionData.user.id;
		}
	});

	async function executeTool(toolName: string, args: any) {
		executing = true;
		result = '';
		error = '';

		try {
			const response = await fetch('/api/tools/execute', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					toolName,
					args: {
						...args,
						userId
					}
				})
			});

			const data = await response.json();

			if (data.success) {
				result = data.result;
			} else {
				error = data.error || 'Unknown error';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			executing = false;
		}
	}

	function handleCreateIssue() {
		executeTool('linear_create_issue', {
			teamId,
			title: issueTitle,
			description: issueDescription,
			priority: issuePriority,
			projectId: projectId || undefined
		});
	}

	function handleUpdateIssue() {
		executeTool('linear_update_issue', {
			issueId: updateIssueId,
			title: updateTitle || undefined,
			description: updateDescription || undefined,
			priority: updatePriority,
			stateId: updateStateId || undefined
		});
	}

	function handleAddComment() {
		executeTool('linear_add_comment', {
			issueId: commentIssueId,
			body: commentBody
		});
	}

	function handleGetTeamStates() {
		executeTool('linear_get_team_states', {
			teamId: queryTeamId
		});
	}

	function handleGetTeamMembers() {
		executeTool('linear_get_team_members', {
			teamId: queryTeamId
		});
	}
</script>

<div class="container mx-auto p-6 space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Linear Tools Debug Panel</h1>
			<p class="text-muted-foreground mt-2">
				Test Linear mutation tools manually without AI
			</p>
		</div>
		{#if userId}
			<div class="text-sm text-muted-foreground">
				User ID: <code class="bg-muted px-2 py-1 rounded">{userId}</code>
			</div>
		{/if}
	</div>

	<!-- Results Panel -->
	{#if result}
		<Alert>
			<AlertDescription>
				<div class="font-mono text-sm whitespace-pre-wrap">{result}</div>
			</AlertDescription>
		</Alert>
	{/if}

	{#if error}
		<Alert variant="destructive">
			<AlertDescription>
				<div class="font-mono text-sm">{error}</div>
			</AlertDescription>
		</Alert>
	{/if}

	<!-- Create Issue -->
	<Card class="p-6">
		<h2 class="text-xl font-semibold mb-4">Create Issue</h2>
		<div class="space-y-4">
			<div>
				<Label for="teamId">Team ID</Label>
				<Input id="teamId" bind:value={teamId} placeholder="e.g., team_abc123" />
			</div>
			<div>
				<Label for="issueTitle">Title</Label>
				<Input id="issueTitle" bind:value={issueTitle} placeholder="Issue title" />
			</div>
			<div>
				<Label for="issueDescription">Description (optional)</Label>
				<Textarea id="issueDescription" bind:value={issueDescription} placeholder="Issue description" rows={3} />
			</div>
			<div>
				<Label for="issuePriority">Priority (0-4)</Label>
				<Input id="issuePriority" type="number" min="0" max="4" bind:value={issuePriority} />
			</div>
			<div>
				<Label for="projectId">Project ID (optional)</Label>
				<Input id="projectId" bind:value={projectId} placeholder="e.g., proj_xyz789" />
			</div>
			<Button on:click={handleCreateIssue} disabled={executing || !teamId || !issueTitle}>
				{executing ? 'Executing...' : 'Create Issue'}
			</Button>
		</div>
	</Card>

	<!-- Update Issue -->
	<Card class="p-6">
		<h2 class="text-xl font-semibold mb-4">Update Issue</h2>
		<div class="space-y-4">
			<div>
				<Label for="updateIssueId">Issue ID</Label>
				<Input id="updateIssueId" bind:value={updateIssueId} placeholder="e.g., TEAM-123" />
			</div>
			<div>
				<Label for="updateTitle">New Title (optional)</Label>
				<Input id="updateTitle" bind:value={updateTitle} placeholder="New title" />
			</div>
			<div>
				<Label for="updateDescription">New Description (optional)</Label>
				<Textarea id="updateDescription" bind:value={updateDescription} placeholder="New description" rows={3} />
			</div>
			<div>
				<Label for="updatePriority">New Priority (0-4, optional)</Label>
				<Input id="updatePriority" type="number" min="0" max="4" bind:value={updatePriority} />
			</div>
			<div>
				<Label for="updateStateId">New State ID (optional)</Label>
				<Input id="updateStateId" bind:value={updateStateId} placeholder="e.g., state_abc123" />
			</div>
			<Button on:click={handleUpdateIssue} disabled={executing || !updateIssueId}>
				{executing ? 'Executing...' : 'Update Issue'}
			</Button>
		</div>
	</Card>

	<!-- Add Comment -->
	<Card class="p-6">
		<h2 class="text-xl font-semibold mb-4">Add Comment</h2>
		<div class="space-y-4">
			<div>
				<Label for="commentIssueId">Issue ID</Label>
				<Input id="commentIssueId" bind:value={commentIssueId} placeholder="e.g., TEAM-123" />
			</div>
			<div>
				<Label for="commentBody">Comment</Label>
				<Textarea id="commentBody" bind:value={commentBody} placeholder="Comment text" rows={3} />
			</div>
			<Button on:click={handleAddComment} disabled={executing || !commentIssueId || !commentBody}>
				{executing ? 'Executing...' : 'Add Comment'}
			</Button>
		</div>
	</Card>

	<!-- Query Tools -->
	<Card class="p-6">
		<h2 class="text-xl font-semibold mb-4">Query Team Info</h2>
		<div class="space-y-4">
			<div>
				<Label for="queryTeamId">Team ID</Label>
				<Input id="queryTeamId" bind:value={queryTeamId} placeholder="e.g., team_abc123" />
			</div>
			<div class="flex gap-2">
				<Button on:click={handleGetTeamStates} disabled={executing || !queryTeamId}>
					{executing ? 'Executing...' : 'Get Team States'}
				</Button>
				<Button on:click={handleGetTeamMembers} disabled={executing || !queryTeamId} variant="secondary">
					{executing ? 'Executing...' : 'Get Team Members'}
				</Button>
			</div>
		</div>
	</Card>

	<!-- Instructions -->
	<Card class="p-6 bg-muted">
		<h3 class="font-semibold mb-2">How to use:</h3>
		<ol class="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
			<li>Make sure you have a Linear integration connected in Settings</li>
			<li>Get your Team ID from Linear (Settings → Teams)</li>
			<li>Fill in the required fields above</li>
			<li>Click the button to execute the tool</li>
			<li>Check the result panel at the top</li>
			<li>Verify in Linear that the changes were made</li>
		</ol>
	</Card>
</div>

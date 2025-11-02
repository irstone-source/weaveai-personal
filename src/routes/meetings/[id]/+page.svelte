<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Card } from "$lib/components/ui/card";
	import { Badge } from "$lib/components/ui/badge";
	import {
		ArrowLeftIcon,
		CalendarIcon,
		ClockIcon,
		UsersIcon,
		ExternalLinkIcon,
		FileTextIcon,
		LightbulbIcon,
		AlertTriangleIcon,
		CheckCircleIcon,
		HelpCircleIcon,
		TargetIcon
	} from "lucide-svelte";
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	// Format date for display
	function formatDate(date: Date | null): string {
		if (!date) return 'N/A';
		const d = new Date(date);
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Format duration (minutes) to readable format
	function formatDuration(minutes: number | null): string {
		if (!minutes) return 'N/A';
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) {
			return `${hours}h ${mins}m`;
		}
		return `${mins}m`;
	}

	// Parse transcript segments
	let transcriptSegments = $derived.by(() => {
		if (!data.transcript?.segments) return [];
		try {
			return Array.isArray(data.transcript.segments)
				? data.transcript.segments
				: JSON.parse(data.transcript.segments as any);
		} catch {
			return [];
		}
	});

	// Get icon for insight type
	function getInsightIcon(type: string) {
		switch (type) {
			case 'decision': return CheckCircleIcon;
			case 'action_item': return TargetIcon;
			case 'risk': return AlertTriangleIcon;
			case 'opportunity': return LightbulbIcon;
			case 'question': return HelpCircleIcon;
			default: return FileTextIcon;
		}
	}

	// Get badge variant for insight type
	function getInsightVariant(type: string): "default" | "secondary" | "outline" | "destructive" {
		switch (type) {
			case 'decision': return 'default';
			case 'action_item': return 'secondary';
			case 'risk': return 'destructive';
			case 'opportunity': return 'default';
			default: return 'outline';
		}
	}
</script>

<div class="container mx-auto py-8 space-y-8">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<Button href="/meetings" variant="ghost" size="sm">
			<ArrowLeftIcon class="w-4 h-4 mr-2" />
			Back to Meetings
		</Button>
	</div>

	<!-- Meeting Header Card -->
	<Card.Root>
		<Card.Content class="pt-6">
			<div class="space-y-6">
				<!-- Title and Actions -->
				<div class="flex items-start justify-between">
					<div class="flex-1">
						<h1 class="text-3xl font-bold">
							{data.meeting.title || 'Untitled Meeting'}
						</h1>
						<div class="flex items-center gap-2 mt-3">
							{#if data.meeting.hasTranscript}
								<Badge variant="outline">
									<FileTextIcon class="w-3 h-3 mr-1" />
									Has Transcript
								</Badge>
							{/if}
							{#if data.meeting.hasInsights}
								<Badge variant="outline">
									<LightbulbIcon class="w-3 h-3 mr-1" />
									Has Insights
								</Badge>
							{/if}
							{#if data.meeting.isProcessed}
								<Badge variant="default">Processed</Badge>
							{/if}
						</div>
					</div>
					{#if data.meeting.fathomUrl}
						<Button
							href={data.meeting.fathomUrl}
							variant="outline"
							target="_blank"
							rel="noopener noreferrer"
						>
							<ExternalLinkIcon class="w-4 h-4 mr-2" />
							Open in Fathom
						</Button>
					{/if}
				</div>

				<!-- Meeting Metadata -->
				<div class="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t">
					<div class="space-y-1">
						<p class="text-sm text-muted-foreground flex items-center gap-2">
							<CalendarIcon class="w-4 h-4" />
							Date & Time
						</p>
						<p class="font-medium">{formatDate(data.meeting.startTime)}</p>
					</div>
					{#if data.meeting.duration}
						<div class="space-y-1">
							<p class="text-sm text-muted-foreground flex items-center gap-2">
								<ClockIcon class="w-4 h-4" />
								Duration
							</p>
							<p class="font-medium">{formatDuration(data.meeting.duration)}</p>
						</div>
					{/if}
					{#if data.meeting.attendees && Array.isArray(data.meeting.attendees)}
						<div class="space-y-1">
							<p class="text-sm text-muted-foreground flex items-center gap-2">
								<UsersIcon class="w-4 h-4" />
								Attendees
							</p>
							<p class="font-medium">{data.meeting.attendees.length} people</p>
						</div>
					{/if}
					{#if data.meeting.recordedBy}
						<div class="space-y-1">
							<p class="text-sm text-muted-foreground">Recorded By</p>
							<p class="font-medium">{data.meeting.recordedBy}</p>
						</div>
					{/if}
				</div>

				<!-- Summary -->
				{#if data.meeting.summary}
					<div class="pt-6 border-t">
						<h3 class="text-lg font-semibold mb-2">Summary</h3>
						<p class="text-muted-foreground">{data.meeting.summary}</p>
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Transcript Section -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Meeting Transcript</Card.Title>
					{#if data.transcript}
						<Card.Description>
							{data.transcript.wordCount ? `${data.transcript.wordCount.toLocaleString()} words` : ''}
							{#if data.transcript.language}
								• Language: {data.transcript.language}
							{/if}
						</Card.Description>
					{/if}
				</Card.Header>
				<Card.Content>
					{#if !data.transcript}
						<div class="text-center py-12">
							<FileTextIcon class="w-16 h-16 mx-auto text-muted-foreground opacity-30 mb-4" />
							<p class="text-muted-foreground">No transcript available for this meeting</p>
						</div>
					{:else if transcriptSegments.length > 0}
						<div class="space-y-4 max-h-[600px] overflow-y-auto pr-4">
							{#each transcriptSegments as segment}
								<div class="space-y-2">
									<div class="flex items-center gap-3">
										{#if segment.speaker}
											<Badge variant="secondary">{segment.speaker}</Badge>
										{/if}
										{#if segment.timestamp}
											<span class="text-xs text-muted-foreground">{segment.timestamp}</span>
										{/if}
									</div>
									<p class="text-sm leading-relaxed pl-4">
										{segment.text || segment.content || ''}
									</p>
								</div>
							{/each}
						</div>
					{:else if data.transcript.fullTranscript}
						<div class="prose prose-sm max-w-none max-h-[600px] overflow-y-auto">
							<p class="whitespace-pre-wrap">{data.transcript.fullTranscript}</p>
						</div>
					{:else}
						<div class="text-center py-12">
							<p class="text-muted-foreground">Transcript content is not available</p>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

	<!-- Insights Section -->
			<div class="space-y-6">
				{#if !data.meeting.hasInsights}
					<Card.Root>
						<Card.Content class="py-12">
							<div class="text-center">
								<LightbulbIcon class="w-16 h-16 mx-auto text-muted-foreground opacity-30 mb-4" />
								<p class="text-muted-foreground">No insights available for this meeting</p>
							</div>
						</Card.Content>
					</Card.Root>
				{:else}
					<!-- Decisions -->
					{#if data.insights.decisions.length > 0}
						<Card.Root>
							<Card.Header>
								<Card.Title class="flex items-center gap-2">
									<CheckCircleIcon class="w-5 h-5" />
									Decisions ({data.insights.decisions.length})
								</Card.Title>
							</Card.Header>
							<Card.Content>
								<div class="space-y-3">
									{#each data.insights.decisions as insight}
										<div class="p-4 rounded-lg border bg-card">
											<p class="text-sm">{insight.content}</p>
											{#if insight.speaker}
												<p class="text-xs text-muted-foreground mt-2">— {insight.speaker}</p>
											{/if}
										</div>
									{/each}
								</div>
							</Card.Content>
						</Card.Root>
					{/if}

					<!-- Action Items -->
					{#if data.insights.actionItems.length > 0}
						<Card.Root>
							<Card.Header>
								<Card.Title class="flex items-center gap-2">
									<TargetIcon class="w-5 h-5" />
									Action Items ({data.insights.actionItems.length})
								</Card.Title>
							</Card.Header>
							<Card.Content>
								<div class="space-y-3">
									{#each data.insights.actionItems as insight}
										<div class="p-4 rounded-lg border bg-card">
											<p class="text-sm">{insight.content}</p>
											{#if insight.speaker}
												<p class="text-xs text-muted-foreground mt-2">— {insight.speaker}</p>
											{/if}
										</div>
									{/each}
								</div>
							</Card.Content>
						</Card.Root>
					{/if}

					<!-- Risks -->
					{#if data.insights.risks.length > 0}
						<Card.Root>
							<Card.Header>
								<Card.Title class="flex items-center gap-2">
									<AlertTriangleIcon class="w-5 h-5 text-destructive" />
									Risks ({data.insights.risks.length})
								</Card.Title>
							</Card.Header>
							<Card.Content>
								<div class="space-y-3">
									{#each data.insights.risks as insight}
										<div class="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
											<p class="text-sm">{insight.content}</p>
											{#if insight.speaker}
												<p class="text-xs text-muted-foreground mt-2">— {insight.speaker}</p>
											{/if}
										</div>
									{/each}
								</div>
							</Card.Content>
						</Card.Root>
					{/if}

					<!-- Opportunities -->
					{#if data.insights.opportunities.length > 0}
						<Card.Root>
							<Card.Header>
								<Card.Title class="flex items-center gap-2">
									<LightbulbIcon class="w-5 h-5" />
									Opportunities ({data.insights.opportunities.length})
								</Card.Title>
							</Card.Header>
							<Card.Content>
								<div class="space-y-3">
									{#each data.insights.opportunities as insight}
										<div class="p-4 rounded-lg border bg-card">
											<p class="text-sm">{insight.content}</p>
											{#if insight.speaker}
												<p class="text-xs text-muted-foreground mt-2">— {insight.speaker}</p>
											{/if}
										</div>
									{/each}
								</div>
							</Card.Content>
						</Card.Root>
					{/if}

					<!-- Key Points -->
					{#if data.insights.keyPoints.length > 0}
						<Card.Root>
							<Card.Header>
								<Card.Title class="flex items-center gap-2">
									<FileTextIcon class="w-5 h-5" />
									Key Points ({data.insights.keyPoints.length})
								</Card.Title>
							</Card.Header>
							<Card.Content>
								<div class="space-y-3">
									{#each data.insights.keyPoints as insight}
										<div class="p-4 rounded-lg border bg-card">
											<p class="text-sm">{insight.content}</p>
											{#if insight.speaker}
												<p class="text-xs text-muted-foreground mt-2">— {insight.speaker}</p>
											{/if}
										</div>
									{/each}
								</div>
							</Card.Content>
						</Card.Root>
					{/if}

					<!-- Questions -->
					{#if data.insights.questions.length > 0}
						<Card.Root>
							<Card.Header>
								<Card.Title class="flex items-center gap-2">
									<HelpCircleIcon class="w-5 h-5" />
									Questions ({data.insights.questions.length})
								</Card.Title>
							</Card.Header>
							<Card.Content>
								<div class="space-y-3">
									{#each data.insights.questions as insight}
										<div class="p-4 rounded-lg border bg-card">
											<p class="text-sm">{insight.content}</p>
											{#if insight.speaker}
												<p class="text-xs text-muted-foreground mt-2">— {insight.speaker}</p>
											{/if}
										</div>
									{/each}
								</div>
							</Card.Content>
						</Card.Root>
					{/if}
				{/if}
			</div>

	<!-- Attendees Section -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Meeting Attendees</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if !data.meeting.attendees || !Array.isArray(data.meeting.attendees) || data.meeting.attendees.length === 0}
						<div class="text-center py-12">
							<UsersIcon class="w-16 h-16 mx-auto text-muted-foreground opacity-30 mb-4" />
							<p class="text-muted-foreground">No attendee information available</p>
						</div>
					{:else}
						<div class="grid gap-4">
							{#each data.meeting.attendees as attendee}
								<div class="flex items-center gap-4 p-4 rounded-lg border bg-card">
									<div class="flex-1">
										<p class="font-medium">
											{attendee.name || attendee.email || 'Unknown'}
										</p>
										{#if attendee.email && attendee.name}
											<p class="text-sm text-muted-foreground">{attendee.email}</p>
										{/if}
										{#if attendee.role}
											<Badge variant="outline" class="mt-2">{attendee.role}</Badge>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
</div>

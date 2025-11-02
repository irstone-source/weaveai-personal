<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Card } from "$lib/components/ui/card";
	import { Badge } from "$lib/components/ui/badge";
	import { CalendarIcon, ClockIcon, UsersIcon, FileTextIcon, LightbulbIcon, ExternalLinkIcon } from "lucide-svelte";
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	// Format date for display
	function formatDate(date: Date | null): string {
		if (!date) return 'N/A';
		const d = new Date(date);
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
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

	// Get meeting status badge
	function getMeetingStatus(meeting: any) {
		if (meeting.isProcessed) {
			return { text: 'Processed', variant: 'default' as const };
		} else if (meeting.hasTranscript) {
			return { text: 'Has Transcript', variant: 'secondary' as const };
		} else {
			return { text: 'Not Processed', variant: 'outline' as const };
		}
	}
</script>

<div class="container mx-auto py-8 space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Meetings</h1>
			<p class="text-muted-foreground mt-2">
				View and manage your Fathom meeting recordings and insights
			</p>
		</div>
		<Button href="/admin/settings/fathom-import">
			Import Meetings
		</Button>
	</div>

	<!-- Statistics Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<Card.Root>
			<Card.Content class="pt-6">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<p class="text-sm text-muted-foreground">Total Meetings</p>
						<p class="text-3xl font-bold">{data.stats.total}</p>
					</div>
					<CalendarIcon class="w-10 h-10 text-muted-foreground opacity-50" />
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-6">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<p class="text-sm text-muted-foreground">With Transcripts</p>
						<p class="text-3xl font-bold">{data.stats.withTranscripts}</p>
					</div>
					<FileTextIcon class="w-10 h-10 text-muted-foreground opacity-50" />
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-6">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<p class="text-sm text-muted-foreground">With Insights</p>
						<p class="text-3xl font-bold">{data.stats.withInsights}</p>
					</div>
					<LightbulbIcon class="w-10 h-10 text-muted-foreground opacity-50" />
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Meetings List -->
	{#if data.meetings.length === 0}
		<Card.Root>
			<Card.Content class="py-16">
				<div class="text-center space-y-4">
					<CalendarIcon class="w-16 h-16 mx-auto text-muted-foreground opacity-30" />
					<div>
						<h3 class="text-xl font-semibold">No meetings found</h3>
						<p class="text-muted-foreground mt-2">
							Import your Fathom meetings to get started
						</p>
					</div>
					<Button href="/admin/settings/fathom-import">
						Import Meetings
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-4">
			{#each data.meetings as meeting}
				<Card.Root class="hover:shadow-md transition-shadow">
					<Card.Content class="p-6">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 space-y-3">
								<!-- Title and Status -->
								<div class="flex items-start gap-3">
									<div class="flex-1">
										<h3 class="text-lg font-semibold">
											{meeting.title || 'Untitled Meeting'}
										</h3>
										<div class="flex items-center gap-2 mt-1">
											<Badge variant={getMeetingStatus(meeting).variant}>
												{getMeetingStatus(meeting).text}
											</Badge>
											{#if meeting.hasTranscript}
												<Badge variant="outline">
													<FileTextIcon class="w-3 h-3 mr-1" />
													Transcript
												</Badge>
											{/if}
											{#if meeting.hasInsights}
												<Badge variant="outline">
													<LightbulbIcon class="w-3 h-3 mr-1" />
													Insights
												</Badge>
											{/if}
										</div>
									</div>
								</div>

								<!-- Meeting Details -->
								<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
									<div class="flex items-center gap-2 text-muted-foreground">
										<CalendarIcon class="w-4 h-4" />
										<span>{formatDate(meeting.startTime)}</span>
									</div>
									{#if meeting.duration}
										<div class="flex items-center gap-2 text-muted-foreground">
											<ClockIcon class="w-4 h-4" />
											<span>{formatDuration(meeting.duration)}</span>
										</div>
									{/if}
									{#if meeting.attendees && Array.isArray(meeting.attendees) && meeting.attendees.length > 0}
										<div class="flex items-center gap-2 text-muted-foreground">
											<UsersIcon class="w-4 h-4" />
											<span>{meeting.attendees.length} attendees</span>
										</div>
									{/if}
									{#if meeting.recordedBy}
										<div class="text-muted-foreground">
											<span class="text-xs">Recorded by: {meeting.recordedBy}</span>
										</div>
									{/if}
								</div>

								<!-- Summary -->
								{#if meeting.summary}
									<p class="text-sm text-muted-foreground line-clamp-2">
										{meeting.summary}
									</p>
								{/if}
							</div>

							<!-- Actions -->
							<div class="flex flex-col gap-2">
								<Button href="/meetings/{meeting.id}" variant="default" size="sm">
									View Details
								</Button>
								{#if meeting.fathomUrl}
									<Button
										href={meeting.fathomUrl}
										variant="outline"
										size="sm"
										target="_blank"
										rel="noopener noreferrer"
									>
										<ExternalLinkIcon class="w-3 h-3 mr-1" />
										Open in Fathom
									</Button>
								{/if}
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>

<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Card } from "$lib/components/ui/card";
	import { Badge } from "$lib/components/ui/badge";
	import {
		LightbulbIcon,
		CheckCircleIcon,
		TargetIcon,
		AlertTriangleIcon,
		HelpCircleIcon,
		FileTextIcon,
		TrendingUpIcon,
		ArrowLeftIcon
	} from "lucide-svelte";
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	// Format date for display
	function formatDate(date: Date | null): string {
		if (!date) return 'N/A';
		const d = new Date(date);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

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

	// Get badge variant
	function getInsightVariant(type: string): "default" | "secondary" | "outline" | "destructive" {
		switch (type) {
			case 'decision': return 'default';
			case 'action_item': return 'secondary';
			case 'risk': return 'destructive';
			case 'opportunity': return 'default';
			default: return 'outline';
		}
	}

	// Get readable type name
	function getInsightTypeName(type: string): string {
		switch (type) {
			case 'action_item': return 'Action Item';
			case 'key_point': return 'Key Point';
			default: return type.charAt(0).toUpperCase() + type.slice(1);
		}
	}
</script>

<div class="container mx-auto py-8 space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Meeting Insights Dashboard</h1>
			<p class="text-muted-foreground mt-2">
				Aggregate view of decisions, action items, risks, and opportunities across all meetings
			</p>
		</div>
		<Button href="/meetings" variant="ghost">
			<ArrowLeftIcon class="w-4 h-4 mr-2" />
			Back to Meetings
		</Button>
	</div>

	<!-- Statistics Cards -->
	<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
		<Card.Root>
			<Card.Content class="pt-6">
				<div class="text-center space-y-2">
					<TrendingUpIcon class="w-8 h-8 mx-auto text-primary" />
					<p class="text-3xl font-bold">{data.stats.totalInsights}</p>
					<p class="text-xs text-muted-foreground">Total Insights</p>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-6">
				<div class="text-center space-y-2">
					<CheckCircleIcon class="w-8 h-8 mx-auto text-green-600" />
					<p class="text-3xl font-bold">{data.stats.decisions}</p>
					<p class="text-xs text-muted-foreground">Decisions</p>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-6">
				<div class="text-center space-y-2">
					<TargetIcon class="w-8 h-8 mx-auto text-blue-600" />
					<p class="text-3xl font-bold">{data.stats.actionItems}</p>
					<p class="text-xs text-muted-foreground">Action Items</p>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-6">
				<div class="text-center space-y-2">
					<AlertTriangleIcon class="w-8 h-8 mx-auto text-red-600" />
					<p class="text-3xl font-bold">{data.stats.risks}</p>
					<p class="text-xs text-muted-foreground">Risks</p>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-6">
				<div class="text-center space-y-2">
					<LightbulbIcon class="w-8 h-8 mx-auto text-yellow-600" />
					<p class="text-3xl font-bold">{data.stats.opportunities}</p>
					<p class="text-xs text-muted-foreground">Opportunities</p>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-6">
				<div class="text-center space-y-2">
					<FileTextIcon class="w-8 h-8 mx-auto text-purple-600" />
					<p class="text-3xl font-bold">{data.stats.keyPoints}</p>
					<p class="text-xs text-muted-foreground">Key Points</p>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-6">
				<div class="text-center space-y-2">
					<HelpCircleIcon class="w-8 h-8 mx-auto text-gray-600" />
					<p class="text-3xl font-bold">{data.stats.questions}</p>
					<p class="text-xs text-muted-foreground">Questions</p>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Recent Insights -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Recent Insights</Card.Title>
			<Card.Description>Latest insights extracted from your meetings</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.recentInsights.length === 0}
				<div class="text-center py-12">
					<LightbulbIcon class="w-16 h-16 mx-auto text-muted-foreground opacity-30 mb-4" />
					<p class="text-muted-foreground">No insights available yet</p>
					<p class="text-sm text-muted-foreground mt-2">
						Import meetings to start extracting insights
					</p>
					<Button href="/admin/settings/fathom-import" class="mt-4">
						Import Meetings
					</Button>
				</div>
			{:else}
				<div class="space-y-4">
					{#each data.recentInsights.slice(0, 10) as item}
						{@const Icon = getInsightIcon(item.insight.insightType)}
						<div class="flex gap-4 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
							<div class="flex-shrink-0">
								<Icon class="w-5 h-5 mt-1" />
							</div>
							<div class="flex-1 space-y-2">
								<div class="flex items-start justify-between gap-4">
									<div class="flex-1">
										<p class="text-sm leading-relaxed">{item.insight.content}</p>
										{#if item.insight.speaker}
											<p class="text-xs text-muted-foreground mt-1">— {item.insight.speaker}</p>
										{/if}
									</div>
									<Badge variant={getInsightVariant(item.insight.insightType)}>
										{getInsightTypeName(item.insight.insightType)}
									</Badge>
								</div>
								<div class="flex items-center gap-3 text-xs text-muted-foreground">
									<Button
										href="/meetings/{item.meeting.id}"
										variant="link"
										size="sm"
										class="h-auto p-0 text-xs"
									>
										{item.meeting.title || 'Untitled Meeting'}
									</Button>
									<span>•</span>
									<span>{formatDate(item.meeting.startTime)}</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Insights by Meeting -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Insights by Meeting</Card.Title>
			<Card.Description>Summary of insights grouped by meeting</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.insightsByMeeting.length === 0}
				<div class="text-center py-12">
					<p class="text-muted-foreground">No meetings with insights yet</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each data.insightsByMeeting as item}
						<div class="p-4 rounded-lg border bg-card">
							<div class="flex items-start justify-between gap-4 mb-4">
								<div class="flex-1">
									<h3 class="font-semibold">
										{item.meeting?.title || 'Untitled Meeting'}
									</h3>
									<p class="text-sm text-muted-foreground">
										{formatDate(item.meeting?.startTime)}
									</p>
								</div>
								<Button href="/meetings/{item.meetingId}" variant="outline" size="sm">
									View Meeting
								</Button>
							</div>
							<div class="flex gap-3 flex-wrap">
								{#if item.decisions > 0}
									<Badge variant="outline" class="gap-1">
										<CheckCircleIcon class="w-3 h-3" />
										{item.decisions} Decision{item.decisions !== 1 ? 's' : ''}
									</Badge>
								{/if}
								{#if item.actionItems > 0}
									<Badge variant="outline" class="gap-1">
										<TargetIcon class="w-3 h-3" />
										{item.actionItems} Action Item{item.actionItems !== 1 ? 's' : ''}
									</Badge>
								{/if}
								{#if item.risks > 0}
									<Badge variant="destructive" class="gap-1">
										<AlertTriangleIcon class="w-3 h-3" />
										{item.risks} Risk{item.risks !== 1 ? 's' : ''}
									</Badge>
								{/if}
								{#if item.opportunities > 0}
									<Badge variant="default" class="gap-1">
										<LightbulbIcon class="w-3 h-3" />
										{item.opportunities} Opportunit{item.opportunities !== 1 ? 'ies' : 'y'}
									</Badge>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

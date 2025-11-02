<script lang="ts">
  import { getRecommendedAgents, type Agent } from '$lib/config/agents';
  import Button from '$lib/components/ui/button/button.svelte';
  import * as Card from '$lib/components/ui/card';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import { Sparkles, Play, Edit, Users, Settings } from 'lucide-svelte';
  import AgentSelector from './AgentSelector.svelte';

  interface Props {
    prompt: string;
    onRun: (refinedPrompt: string, selectedAgents: Agent[], settings: any) => void;
    onEdit: () => void;
  }

  let { prompt, onRun, onEdit }: Props = $props();

  // Analyze prompt and get recommendations
  let recommendedAgents = $derived(getRecommendedAgents(prompt));
  let selectedAgents = $state<Agent[]>([]);
  let refinedPrompt = $state(prompt);
  let isRefining = $state(false);

  // Initialize selectedAgents with top recommendation when recommendedAgents changes
  $effect(() => {
    if (recommendedAgents.length > 0 && selectedAgents.length === 0) {
      selectedAgents = recommendedAgents.slice(0, 1);
    }
  });

  // Recommended settings based on prompt analysis
  let recommendedSettings = $derived.by(() => {
    const settings: any = {
      temperature: 0.7,
      maxTokens: 2048,
      useMemory: false,
      useFocus: false
    };

    // Adjust based on selected agents
    if (selectedAgents.length > 0) {
      const primaryAgent = selectedAgents[0];
      settings.temperature = primaryAgent.temperature || 0.7;
    }

    // Detect if prompt needs memory
    if (prompt.toLowerCase().includes('remember') || prompt.toLowerCase().includes('recall')) {
      settings.useMemory = true;
    }

    // Detect if prompt needs long output
    if (prompt.toLowerCase().includes('detailed') || prompt.toLowerCase().includes('comprehensive')) {
      settings.maxTokens = 4096;
    }

    return settings;
  });

  // Analyze prompt complexity
  let promptAnalysis = $derived.by(() => {
    const wordCount = prompt.split(/\s+/).length;
    const hasQuestions = prompt.includes('?');
    const hasCode = /```|`/.test(prompt);
    const hasData = /data|table|csv|json/.test(prompt.toLowerCase());

    return {
      complexity: wordCount > 50 ? 'complex' : wordCount > 20 ? 'medium' : 'simple',
      hasQuestions,
      hasCode,
      hasData,
      suggestedImprovement: generateSuggestion()
    };
  });

  function generateSuggestion(): string {
    const lower = prompt.toLowerCase();

    if (prompt.length < 10) {
      return 'Consider adding more context to get a better response';
    }

    if (!prompt.includes('?') && prompt.split(/\s+/).length < 20) {
      return 'Try being more specific about what you want';
    }

    if (lower.includes('code') && !lower.includes('language')) {
      return 'Specify the programming language for better code assistance';
    }

    if (lower.includes('explain') && !lower.includes('like')) {
      return 'Consider adding "explain like I\'m..." for tailored explanations';
    }

    return '';
  }

  // Auto-refine prompt with AI suggestions
  async function refinePromptWithAI() {
    isRefining = true;

    // Simulate AI refinement (in production, call an API)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simple refinement logic
    let refined = prompt;

    // Add context if missing
    if (prompt.split(/\s+/).length < 15 && !prompt.includes('?')) {
      refined = `${prompt}. Please provide a detailed, well-structured response.`;
    }

    // Add language spec for code requests
    if (prompt.toLowerCase().includes('code') && !prompt.toLowerCase().includes('javascript') && !prompt.toLowerCase().includes('python')) {
      refined = `${prompt} (in JavaScript)`;
    }

    refinedPrompt = refined;
    isRefining = false;
  }

  function handleRun() {
    onRun(refinedPrompt, selectedAgents, recommendedSettings);
  }
</script>

<div class="w-full max-w-4xl mx-auto p-6 space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Sparkles class="w-6 h-6 text-primary" />
      <h2 class="text-2xl font-bold">Prompt Refinement</h2>
    </div>
    <Badge variant="outline" class="text-xs">
      {promptAnalysis.complexity.toUpperCase()} TASK
    </Badge>
  </div>

  <!-- Original Prompt -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center justify-between">
        <span class="text-sm font-medium">Your Prompt</span>
        <Button variant="ghost" size="sm" onclick={onEdit}>
          <Edit class="w-4 h-4 mr-2" />
          Edit
        </Button>
      </Card.Title>
    </Card.Header>
    <Card.Content>
      <div class="bg-muted p-4 rounded-md text-sm">
        {prompt}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Prompt Analysis -->
  {#if promptAnalysis.suggestedImprovement}
    <Card.Root class="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
      <Card.Header>
        <Card.Title class="text-sm font-medium flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-amber-500" />
          Suggestion
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <p class="text-sm text-muted-foreground mb-3">
          {promptAnalysis.suggestedImprovement}
        </p>
        <Button
          variant="outline"
          size="sm"
          onclick={refinePromptWithAI}
          disabled={isRefining}
        >
          {#if isRefining}
            <span class="animate-pulse">Refining...</span>
          {:else}
            <Sparkles class="w-4 h-4 mr-2" />
            Auto-Refine Prompt
          {/if}
        </Button>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Refined Prompt (if different) -->
  {#if refinedPrompt !== prompt}
    <Card.Root class="border-green-500/50">
      <Card.Header>
        <Card.Title class="text-sm font-medium flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-green-500" />
          Refined Prompt
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="bg-muted p-4 rounded-md text-sm">
          {refinedPrompt}
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Agent Selection -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2 text-sm font-medium">
        <Users class="w-4 h-4" />
        Recommended Agents
      </Card.Title>
      <Card.Description class="text-xs">
        Select one or more specialized agents for your task
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <AgentSelector
        {recommendedAgents}
        bind:selectedAgents={selectedAgents}
      />
    </Card.Content>
  </Card.Root>

  <!-- Recommended Settings -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2 text-sm font-medium">
        <Settings class="w-4 h-4" />
        Recommended Settings
      </Card.Title>
    </Card.Header>
    <Card.Content class="space-y-3">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">Temperature</div>
          <div class="text-sm font-medium">{recommendedSettings.temperature}</div>
          <div class="text-xs text-muted-foreground">
            {recommendedSettings.temperature > 0.7 ? 'Creative' : 'Precise'}
          </div>
        </div>
        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">Max Tokens</div>
          <div class="text-sm font-medium">{recommendedSettings.maxTokens}</div>
          <div class="text-xs text-muted-foreground">
            {recommendedSettings.maxTokens > 2048 ? 'Long response' : 'Standard'}
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        {#if recommendedSettings.useMemory}
          <Badge variant="secondary" class="text-xs">
            <span class="mr-1">🧠</span> Memory Enabled
          </Badge>
        {/if}
        {#if recommendedSettings.useFocus}
          <Badge variant="secondary" class="text-xs">
            <span class="mr-1">🎯</span> Focus Mode
          </Badge>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Action Buttons -->
  <div class="flex items-center justify-between pt-4">
    <Button variant="outline" onclick={onEdit}>
      <Edit class="w-4 h-4 mr-2" />
      Edit Prompt
    </Button>

    <Button
      onclick={handleRun}
      class="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
      size="lg"
    >
      <Play class="w-5 h-5 mr-2" />
      Run Prompt
    </Button>
  </div>
</div>

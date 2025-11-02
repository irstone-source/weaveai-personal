<script lang="ts">
  import type { Agent } from '$lib/config/agents';
  import { Check } from 'lucide-svelte';

  interface Props {
    recommendedAgents: Agent[];
    selectedAgents: Agent[];
  }

  let { recommendedAgents, selectedAgents = $bindable() }: Props = $props();

  function toggleAgent(agent: Agent) {
    const index = selectedAgents.findIndex(a => a.id === agent.id);
    if (index > -1) {
      // Remove agent
      selectedAgents = selectedAgents.filter(a => a.id !== agent.id);
    } else {
      // Add agent
      selectedAgents = [...selectedAgents, agent];
    }
  }

  function isSelected(agent: Agent): boolean {
    return selectedAgents.some(a => a.id === agent.id);
  }

  function getColorClass(color: string, selected: boolean): string {
    const colors = {
      blue: selected ? 'bg-blue-500 text-white border-blue-600' : 'border-blue-300 hover:border-blue-500',
      purple: selected ? 'bg-purple-500 text-white border-purple-600' : 'border-purple-300 hover:border-purple-500',
      green: selected ? 'bg-green-500 text-white border-green-600' : 'border-green-300 hover:border-green-500',
      pink: selected ? 'bg-pink-500 text-white border-pink-600' : 'border-pink-300 hover:border-pink-500',
      indigo: selected ? 'bg-indigo-500 text-white border-indigo-600' : 'border-indigo-300 hover:border-indigo-500',
      amber: selected ? 'bg-amber-500 text-white border-amber-600' : 'border-amber-300 hover:border-amber-500',
      cyan: selected ? 'bg-cyan-500 text-white border-cyan-600' : 'border-cyan-300 hover:border-cyan-500',
      emerald: selected ? 'bg-emerald-500 text-white border-emerald-600' : 'border-emerald-300 hover:border-emerald-500',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  }
</script>

<div class="space-y-4">
  <!-- Recommended Agents (Top picks) -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
    {#each recommendedAgents as agent}
      {@const selected = isSelected(agent)}
      <button
        onclick={() => toggleAgent(agent)}
        class={`relative p-4 rounded-lg border-2 transition-all hover:scale-105 text-left ${getColorClass(agent.color, selected)}`}
      >
        {#if selected}
          <div class="absolute top-2 right-2">
            <div class="bg-white text-green-600 rounded-full p-1">
              <Check class="w-4 h-4" />
            </div>
          </div>
        {/if}

        <div class="flex items-center gap-3 mb-2">
          <span class="text-2xl">{agent.emoji}</span>
          <div>
            <div class="font-semibold text-sm">{agent.name}</div>
            <div class="text-xs opacity-75">Recommended</div>
          </div>
        </div>

        <div class="text-xs opacity-90 line-clamp-2">
          {agent.description}
        </div>

        <div class="mt-3 flex flex-wrap gap-1">
          {#each agent.capabilities.slice(0, 3) as capability}
            <span class="text-xs px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
              {capability}
            </span>
          {/each}
        </div>
      </button>
    {/each}
  </div>

  <!-- Selected Agents Summary -->
  {#if selectedAgents.length > 0}
    <div class="p-4 bg-muted rounded-lg">
      <div class="text-sm font-medium mb-2">
        Selected: {selectedAgents.length} {selectedAgents.length === 1 ? 'agent' : 'agents'}
      </div>
      <div class="flex flex-wrap gap-2">
        {#each selectedAgents as agent}
          <div class="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md text-sm">
            <span>{agent.emoji}</span>
            <span>{agent.name}</span>
            <button
              onclick={() => toggleAgent(agent)}
              class="ml-1 hover:text-destructive"
              aria-label="Remove {agent.name}"
            >
              ×
            </button>
          </div>
        {/each}
      </div>

      {#if selectedAgents.length > 1}
        <div class="mt-3 text-xs text-muted-foreground">
          <strong>Multi-agent mode:</strong> Agents will collaborate on your task,
          each contributing their specialized expertise.
        </div>
      {/if}
    </div>
  {:else}
    <div class="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <div class="text-sm text-amber-800 dark:text-amber-200">
        Please select at least one agent to proceed
      </div>
    </div>
  {/if}
</div>

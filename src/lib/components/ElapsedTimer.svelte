<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    startTime: number;
  }

  let { startTime }: Props = $props();

  let elapsed = $state(0);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const deciseconds = Math.floor((ms % 1000) / 100);

    if (seconds === 0) {
      return `${deciseconds * 100}ms`;
    }

    return `${seconds}.${deciseconds}s`;
  }

  onMount(() => {
    // Update elapsed time every 100ms for smooth display
    intervalId = setInterval(() => {
      elapsed = Date.now() - startTime;
    }, 100);
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });
</script>

<span class="text-xs text-muted-foreground font-mono">
  ({formatElapsed(elapsed)})
</span>

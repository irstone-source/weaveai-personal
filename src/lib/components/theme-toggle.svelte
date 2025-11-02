<script lang="ts">
	import { mode, setMode } from "mode-watcher";
	import Button from "$lib/components/ui/button/button.svelte";
	import SunIcon from "@lucide/svelte/icons/sun";
	import MoonIcon from "@lucide/svelte/icons/moon";

	function toggleMode() {
		setMode(mode.current === "light" ? "dark" : "light");
	}
</script>

<Button
	variant="ghost"
	size="icon"
	onclick={toggleMode}
	class="h-9 w-9"
	aria-label="Toggle theme"
>
	{#if mode.current === "light"}
		<MoonIcon class="h-4 w-4" />
	{:else}
		<SunIcon class="h-4 w-4" />
	{/if}
</Button>
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	type $$Props = HTMLAttributes<HTMLDivElement> & {
		variant?: 'default' | 'destructive';
	};

	let className: $$Props['class'] = undefined;
	export { className as class };
	export let variant: $$Props['variant'] = 'default';

	const variantStyles = {
		default: 'bg-background text-foreground',
		destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive'
	};
</script>

<div
	class={cn(
		'relative w-full rounded-lg border p-4',
		variantStyles[variant],
		className
	)}
	role="alert"
	{...$$restProps}
>
	<slot />
</div>

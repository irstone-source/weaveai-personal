import type { CachedSettings } from '$lib/server/settings-store';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			settings: CachedSettings;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

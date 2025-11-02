import { SvelteKitAuth } from "@auth/sveltekit"
import { getAuthConfig } from "./lib/server/auth-config.js"

export const { handle, signIn, signOut } = SvelteKitAuth(async () => {
    return await getAuthConfig();
})
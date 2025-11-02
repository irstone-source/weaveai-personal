import type { DefaultSession } from "@auth/core/types"

declare module "@auth/core/types" {
  interface User {
    isAdmin: boolean
    emailVerified?: Date | null
    createdAt?: Date
    planTier?: string
    marketingConsent?: boolean
  }

  interface AdapterUser {
    isAdmin: boolean
  }

  interface Session extends DefaultSession {
    user: {
      id: string
      isAdmin: boolean
      planTier?: string
    } & DefaultSession["user"]
  }

  interface JWT {
    id: string
    isAdmin: boolean
  }
}
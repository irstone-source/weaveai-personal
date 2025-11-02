import { error } from '@sveltejs/kit'
import { verifyToken, cleanupExpiredTokens } from '$lib/server/email-verification.js'
import { AUTH_ERRORS, sanitizeErrorForLogging } from '$lib/utils/error-handling.js'

export const load = async ({ url, locals }: { url: URL, locals: any }) => {
  const token = url.searchParams.get('token')
  
  // If no token provided, show error
  if (!token) {
    throw error(400, AUTH_ERRORS.VERIFICATION_ERROR)
  }

  // Clean up expired tokens periodically
  try {
    await cleanupExpiredTokens()
  } catch (cleanupError) {
    const sanitizedError = sanitizeErrorForLogging(cleanupError);
    console.error('Failed to cleanup expired tokens:', sanitizedError);
  }

  // Verify the token
  const result = await verifyToken(token)
  
  // Get current user session
  const session = await locals.auth()

  return {
    verification: result,
    isLoggedIn: !!session?.user,
    userEmail: session?.user?.email || null
  }
}
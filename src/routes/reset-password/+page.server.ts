import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { createPasswordResetToken, getUserForReset, generateResetUrl } from '$lib/server/password-reset.js'
import { sendPasswordResetEmail } from '$lib/server/email.js'
import { getSiteSettings } from '$lib/server/settings-store.js'
import { createAuthError, handleDatabaseError, AUTH_ERRORS, AUTH_STATUS_CODES, createGenericSuccessResponse, sanitizeErrorForLogging } from '$lib/utils/error-handling.js'

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth()

  // If user is already logged in, redirect to index page
  if (session?.user) {
    throw redirect(302, '/')
  }

  const settings = await getSiteSettings()

  return {
    settings: {
      siteName: settings.siteName || 'AI Models Platform',
      siteDescription: settings.siteDescription || 'Reset your password'
    }
  }
}

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData()
    const email = data.get('email') as string

    // Validate email
    if (!email) {
      return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, AUTH_ERRORS.MISSING_FIELDS, { email: '' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, AUTH_ERRORS.INVALID_EMAIL, { email });
    }

    try {
      // Get user data (this will throw if user doesn't exist)
      const userData = await getUserForReset(email)

      if (!userData) {
        // For security, we don't reveal if an email exists or not
        // Return success message even if user doesn't exist
        return createGenericSuccessResponse(AUTH_ERRORS.PASSWORD_RESET_SENT);
      }

      // Create password reset token
      const { token } = await createPasswordResetToken(email)

      // Generate reset URL
      const resetUrl = generateResetUrl(token)

      // Send password reset email
      const emailSent = await sendPasswordResetEmail({
        name: userData.name,
        email: userData.email,
        resetUrl
      })

      if (!emailSent) {
        console.error('[Password Reset] Failed to send reset email');
        return createAuthError(AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR, AUTH_ERRORS.PASSWORD_RESET_ERROR, { email });
      }

      console.log('[Password Reset] Reset email sent successfully');

      return createGenericSuccessResponse(AUTH_ERRORS.PASSWORD_RESET_SENT);

    } catch (error) {
      const sanitizedError = sanitizeErrorForLogging(error);
      console.error('[Password Reset] Error processing request:', sanitizedError);

      // Handle rate limiting error
      if (error instanceof Error && error.message.includes('Too many password reset requests')) {
        return createAuthError(AUTH_STATUS_CODES.TOO_MANY_REQUESTS, AUTH_ERRORS.RATE_LIMITED, { email });
      }

      // For other errors, show generic success message for security
      return createGenericSuccessResponse(AUTH_ERRORS.PASSWORD_RESET_SENT);
    }
  }
} satisfies Actions
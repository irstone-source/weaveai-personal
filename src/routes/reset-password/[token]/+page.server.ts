import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { validateResetToken, resetPassword } from '$lib/server/password-reset.js'
import { getSiteSettings } from '$lib/server/settings-store.js'
import { createAuthError, handleDatabaseError, AUTH_ERRORS, AUTH_STATUS_CODES, sanitizeErrorForLogging } from '$lib/utils/error-handling.js'

export const load: PageServerLoad = async ({ params, locals }) => {
  const session = await locals.auth()

  // If user is already logged in, redirect to index page
  if (session?.user) {
    throw redirect(302, '/')
  }

  const token = params.token
  const settings = await getSiteSettings()

  // Validate token on page load
  const validation = await validateResetToken(token)

  if (!validation.success) {
    // Token is invalid or expired, redirect to reset request page without exposing error details
    throw redirect(302, '/reset-password')
  }

  return {
    token,
    userEmail: validation.userEmail,
    settings: {
      siteName: settings.siteName || 'AI Models Platform',
      siteDescription: settings.siteDescription || 'Set your new password'
    }
  }
}

export const actions = {
  default: async ({ request, params }) => {
    const token = params.token
    const data = await request.formData()
    const password = data.get('password') as string
    const confirmPassword = data.get('confirmPassword') as string

    // Validate form data
    if (!password || !confirmPassword) {
      return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, AUTH_ERRORS.MISSING_FIELDS, {
        password: '',
        confirmPassword: ''
      });
    }

    if (password !== confirmPassword) {
      return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, 'Passwords do not match', {
        password: '',
        confirmPassword: ''
      });
    }

    // Password strength validation
    if (password.length < 8) {
      return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, AUTH_ERRORS.INVALID_PASSWORD, {
        password: '',
        confirmPassword: ''
      });
    }

    // Check for at least one number, one letter
    const hasNumber = /\d/.test(password)
    const hasLetter = /[a-zA-Z]/.test(password)

    if (!hasNumber || !hasLetter) {
      return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, AUTH_ERRORS.INVALID_PASSWORD, {
        password: '',
        confirmPassword: ''
      });
    }

    // Reset the password
    let result
    try {
      result = await resetPassword(token, password)
    } catch (error) {
      const sanitizedError = sanitizeErrorForLogging(error);
      console.error('[Password Reset] Error resetting password:', sanitizedError);

      return createAuthError(AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR, AUTH_ERRORS.PASSWORD_RESET_ERROR, {
        password: '',
        confirmPassword: ''
      });
    }

    if (!result.success) {
      return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, AUTH_ERRORS.PASSWORD_RESET_ERROR, {
        password: '',
        confirmPassword: ''
      });
    }

    // Success - redirect to login with success message
    throw redirect(302, '/login?message=Password+reset+successfully.+Please+log+in+with+your+new+password.')
  }
} satisfies Actions
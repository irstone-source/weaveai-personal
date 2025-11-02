/**
 * Standardized error handling utilities for authentication security
 * Prevents information disclosure while maintaining good user experience
 */

import { fail } from '@sveltejs/kit';

/**
 * Security-focused error level types
 */
export type SecurityErrorLevel = 'user' | 'system' | 'security';

/**
 * Standard authentication error responses
 */
export const AUTH_ERRORS = {
  // Generic authentication errors
  INVALID_CREDENTIALS: 'Invalid email or password.',
  GENERIC_AUTH_ERROR: 'Authentication failed. Please try again.',

  // Generic form validation errors
  MISSING_FIELDS: 'Please fill in all required fields.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_PASSWORD: 'Password does not meet security requirements.',
  EMAIL_ALREADY_EXISTS: 'An account with this email address already exists.',

  // Generic rate limiting
  RATE_LIMITED: 'Too many attempts. Please try again later.',

  // Generic server errors
  SERVER_ERROR: 'An error occurred. Please try again.',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',

  // Generic success messages (for cases where we don't want to reveal user existence)
  GENERIC_SUCCESS: 'If an account exists with that email address, we have sent you instructions.',

  // Generic verification messages
  VERIFICATION_REQUIRED: 'Please check your email for verification instructions.',
  VERIFICATION_ERROR: 'Verification failed. Please try again or request a new verification email.',

  // Generic password reset messages
  PASSWORD_RESET_SENT: 'If an account exists with that email address, we have sent you a password reset link.',
  PASSWORD_RESET_ERROR: 'Password reset failed. Please try again.',

  // Generic OAuth errors
  OAUTH_ERROR: 'Authentication with external provider failed. Please try again.',
  OAUTH_UNAVAILABLE: 'This authentication method is currently unavailable.',
} as const;

/**
 * Standard HTTP status codes for authentication errors
 */
export const AUTH_STATUS_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Create standardized authentication error response
 */
export function createAuthError(
  statusCode: number,
  message: string,
  fieldData?: Record<string, any>
) {
  return fail(statusCode, {
    error: message,
    ...fieldData
  });
}

/**
 * Handle authentication errors with consistent security-focused responses
 */
export function handleAuthError(
  error: unknown,
  context: string,
  level: SecurityErrorLevel = 'user'
): ReturnType<typeof fail> {
  // Log error details for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Auth Error - ${context}]:`, error);
  }

  // Security-focused error logging for production
  if (level === 'security') {
    console.warn(`[Security] Authentication error in ${context}: ${getErrorType(error)}`);
  }

  // Determine appropriate user-facing message
  const userMessage = getUserMessage(error, level);
  const statusCode = getStatusCode(error);

  return createAuthError(statusCode, userMessage);
}

/**
 * Get appropriate user-facing error message based on error type and security level
 */
function getUserMessage(error: unknown, level: SecurityErrorLevel): string {
  if (level === 'security') {
    // For security-sensitive operations, always return generic messages
    return AUTH_ERRORS.GENERIC_AUTH_ERROR;
  }

  // For user-level errors, provide helpful but safe messages
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Rate limiting errors
    if (message.includes('rate limit') || message.includes('too many')) {
      return AUTH_ERRORS.RATE_LIMITED;
    }

    // Validation errors (safe to show specific validation issues)
    if (message.includes('email') && message.includes('invalid')) {
      return AUTH_ERRORS.INVALID_EMAIL;
    }

    if (message.includes('password') && message.includes('requirement')) {
      return AUTH_ERRORS.INVALID_PASSWORD;
    }

    // Missing field errors
    if (message.includes('required') || message.includes('missing')) {
      return AUTH_ERRORS.MISSING_FIELDS;
    }
  }

  // Default to generic error for unknown cases
  return AUTH_ERRORS.SERVER_ERROR;
}

/**
 * Get appropriate HTTP status code for error
 */
function getStatusCode(error: unknown): number {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('too many')) {
      return AUTH_STATUS_CODES.TOO_MANY_REQUESTS;
    }

    if (message.includes('invalid') || message.includes('required')) {
      return AUTH_STATUS_CODES.BAD_REQUEST;
    }

    if (message.includes('unauthorized') || message.includes('credentials')) {
      return AUTH_STATUS_CODES.UNAUTHORIZED;
    }

    if (message.includes('forbidden') || message.includes('access denied')) {
      return AUTH_STATUS_CODES.FORBIDDEN;
    }

    if (message.includes('not found')) {
      return AUTH_STATUS_CODES.NOT_FOUND;
    }
  }

  // Default to 500 for unknown errors
  return AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR;
}

/**
 * Get error type for logging purposes (sanitized)
 */
function getErrorType(error: unknown): string {
  if (error instanceof Error) {
    // Sanitize error name/type for logging
    const errorType = error.constructor.name;

    // Don't log sensitive error details
    if (errorType.includes('Database') || errorType.includes('SQL')) {
      return 'DatabaseError';
    }

    if (errorType.includes('Network') || errorType.includes('Fetch')) {
      return 'NetworkError';
    }

    if (errorType.includes('Auth') || errorType.includes('Credential')) {
      return 'AuthenticationError';
    }

    return errorType;
  }

  return 'UnknownError';
}

/**
 * Sanitize error messages for logging (remove sensitive information)
 */
export function sanitizeErrorForLogging(error: unknown): string {
  if (error instanceof Error) {
    let message = error.message;

    // Remove potential sensitive information from logs
    message = message.replace(/password\s*[:=]\s*[^\s]+/gi, 'password: [REDACTED]');
    message = message.replace(/token\s*[:=]\s*[^\s]+/gi, 'token: [REDACTED]');
    message = message.replace(/secret\s*[:=]\s*[^\s]+/gi, 'secret: [REDACTED]');
    message = message.replace(/key\s*[:=]\s*[^\s]+/gi, 'key: [REDACTED]');
    message = message.replace(/email\s*[:=]\s*[^\s@]+@[^\s]+/gi, 'email: [REDACTED]');

    // Truncate very long messages
    if (message.length > 200) {
      message = message.substring(0, 200) + '...';
    }

    return message;
  }

  return 'Unknown error occurred';
}

/**
 * Create success response with standardized format
 */
export function createAuthSuccess<T = any>(
  data: T,
  message?: string
): { success: true; data: T; message?: string } {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

/**
 * Security utility: Generic success message for operations where user existence should not be revealed
 */
export function createGenericSuccessResponse(message: string = AUTH_ERRORS.GENERIC_SUCCESS) {
  return {
    success: true,
    message
  };
}

/**
 * Utility function for consistent field clearing on errors
 */
export function clearSensitiveFields(formData: Record<string, any>): Record<string, any> {
  const cleared = { ...formData };

  // Clear sensitive fields
  if (cleared.password) cleared.password = '';
  if (cleared.confirmPassword) cleared.confirmPassword = '';
  if (cleared.token) cleared.token = '';

  return cleared;
}

/**
 * Rate limiting specific error handler
 */
export function handleRateLimitError(identifier: string, operation: string) {
  console.warn(`[Security] Rate limit exceeded for ${operation}: ${identifier.substring(0, 3)}***`);
  return createAuthError(
    AUTH_STATUS_CODES.TOO_MANY_REQUESTS,
    AUTH_ERRORS.RATE_LIMITED
  );
}

/**
 * Database error handler that prevents information disclosure
 */
export function handleDatabaseError(error: unknown, context: string) {
  const sanitizedError = sanitizeErrorForLogging(error);
  console.error(`[Database Error - ${context}]:`, sanitizedError);

  // Never expose database structure or query details to users
  return createAuthError(
    AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR,
    AUTH_ERRORS.SERVER_ERROR
  );
}

/**
 * OAuth provider error handler
 */
export function handleOAuthError(provider: string, error: unknown) {
  const sanitizedError = sanitizeErrorForLogging(error);
  console.error(`[OAuth Error - ${provider}]:`, sanitizedError);

  // Don't expose OAuth configuration details
  return createAuthError(
    AUTH_STATUS_CODES.BAD_REQUEST,
    AUTH_ERRORS.OAUTH_ERROR
  );
}
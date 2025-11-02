import DOMPurify from 'dompurify';
import { browser } from '$app/environment';
import { validateEmailForAuth, normalizeEmail } from './email-validation.js';

/**
 * Comprehensive input sanitization utility for security hardening
 * Prevents XSS attacks by sanitizing user input across the application
 */

/**
 * Safe DOMPurify configuration for different contexts
 */
const SANITIZE_CONFIG = {
  // For general text that should only contain text content
  TEXT_ONLY: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  },

  // For safe HTML content (very restrictive)
  SAFE_HTML: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  },

  // For error messages and notifications
  ERROR_MESSAGE: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM: false
  }
};

/**
 * Sanitize text content to prevent XSS
 * Removes all HTML tags and dangerous content
 * @param input - The text to sanitize
 * @returns Sanitized text content
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Only run DOMPurify in browser environment
  if (browser) {
    return DOMPurify.sanitize(input, SANITIZE_CONFIG.TEXT_ONLY);
  }

  // Server-side fallback: basic HTML entity encoding
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize HTML content with very restrictive rules
 * Only allows safe formatting tags
 * @param input - The HTML to sanitize
 * @returns Sanitized HTML
 */
export function sanitizeHTML(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  if (browser) {
    return DOMPurify.sanitize(input, SANITIZE_CONFIG.SAFE_HTML);
  }

  // Server-side fallback: strip all HTML tags
  return sanitizeText(input);
}

/**
 * Sanitize error messages to prevent XSS through error content
 * @param input - The error message to sanitize
 * @returns Sanitized error message
 */
export function sanitizeErrorMessage(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return 'An error occurred';
  }

  if (browser) {
    return DOMPurify.sanitize(input, SANITIZE_CONFIG.ERROR_MESSAGE);
  }

  return sanitizeText(input);
}

/**
 * Sanitize email addresses
 * Uses RFC-compliant validation and normalization
 * @param email - Email address to sanitize
 * @returns Sanitized and normalized email address
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  // First, basic sanitization to remove HTML tags
  const basicSanitized = sanitizeText(email);

  // Use RFC-compliant validation and normalization
  const validation = validateEmailForAuth(basicSanitized);

  if (validation.isValid) {
    return validation.normalizedEmail;
  }

  // If validation fails, return empty string (invalid email)
  return '';
}

/**
 * Sanitize URL parameters to prevent XSS through URL manipulation
 * @param param - URL parameter to sanitize
 * @returns Sanitized parameter
 */
export function sanitizeURLParam(param: string | null | undefined): string {
  if (!param || typeof param !== 'string') {
    return '';
  }

  // URL decode and then sanitize
  try {
    const decoded = decodeURIComponent(param);
    return sanitizeText(decoded);
  } catch {
    // If URL decoding fails, just sanitize the original
    return sanitizeText(param);
  }
}

/**
 * Sanitize user input for form fields
 * Comprehensive sanitization for form data
 * @param input - Form field value
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized form input
 */
export function sanitizeFormInput(input: string | null | undefined, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Truncate to maximum length
  const truncated = input.length > maxLength ? input.substring(0, maxLength) : input;

  // Sanitize content
  return sanitizeText(truncated);
}

/**
 * Sanitize search queries to prevent XSS through search functionality
 * @param query - Search query to sanitize
 * @returns Sanitized search query
 */
export function sanitizeSearchQuery(query: string | null | undefined): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters while preserving search functionality
  const sanitized = sanitizeText(query);

  // Only allow alphanumeric characters, spaces, and common search operators
  return sanitized.replace(/[^a-zA-Z0-9\s\-_\.]/g, '');
}

/**
 * Sanitize file names to prevent path traversal and XSS
 * @param filename - File name to sanitize
 * @returns Sanitized file name
 */
export function sanitizeFilename(filename: string | null | undefined): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = sanitizeText(filename);

  // Remove dangerous file path characters
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');

  // Remove path traversal attempts
  sanitized = sanitized.replace(/\.\./g, '');

  // Limit length
  return sanitized.substring(0, 255);
}

/**
 * Comprehensive sanitization for authentication-related inputs
 * Special handling for sensitive authentication data
 */
export const authSanitizers = {
  /**
   * Sanitize email for authentication with comprehensive validation
   */
  email: (email: string | null | undefined): string => {
    if (!email || typeof email !== 'string') {
      return '';
    }

    // Use comprehensive RFC-compliant validation
    const validation = validateEmailForAuth(email);
    return validation.isValid ? validation.normalizedEmail : '';
  },

  /**
   * Sanitize display name
   */
  displayName: (name: string | null | undefined): string => {
    return sanitizeFormInput(name, 100);
  },

  /**
   * Sanitize error messages in auth context
   */
  errorMessage: (message: string | null | undefined): string => {
    return sanitizeErrorMessage(message);
  },

  /**
   * Sanitize success messages
   */
  successMessage: (message: string | null | undefined): string => {
    return sanitizeText(message);
  },

  /**
   * Sanitize redirect URLs to prevent open redirect attacks
   */
  redirectUrl: (url: string | null | undefined): string => {
    if (!url || typeof url !== 'string') {
      return '/';
    }

    const sanitized = sanitizeText(url);

    // Only allow relative URLs or same-origin URLs
    if (sanitized.startsWith('/') && !sanitized.startsWith('//')) {
      return sanitized;
    }

    // Default to safe redirect
    return '/';
  }
};

/**
 * Validate and sanitize password input
 * Note: Passwords should generally not be sanitized as they might contain special characters
 * This function only does basic safety checks
 * @param password - Password to validate
 * @returns Validation result
 */
export function validatePasswordSafety(password: string | null | undefined): {
  isValid: boolean;
  sanitized: string;
  error?: string;
} {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      sanitized: '',
      error: 'Password is required'
    };
  }

  // Check for obviously malicious content without breaking password functionality
  if (password.includes('<script') || password.includes('javascript:') || password.includes('data:')) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Password contains invalid characters'
    };
  }

  // Length validation
  if (password.length > 128) { // Reasonable password length limit
    return {
      isValid: false,
      sanitized: '',
      error: 'Password is too long'
    };
  }

  // Check for null bytes and control characters
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(password)) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Password contains invalid characters'
    };
  }

  return {
    isValid: true,
    sanitized: password // Don't sanitize passwords as they might need special characters
  };
}
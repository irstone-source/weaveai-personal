/**
 * RFC-compliant email validation utility
 * Based on RFC 5322 specifications with practical security considerations
 */

export interface EmailValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedEmail: string;
  domain: string;
  localPart: string;
}

/**
 * RFC 5322 compliant email validation
 * Implements practical validation based on the official email specification
 */

// RFC 5322 specifications
const MAX_EMAIL_LENGTH = 254; // RFC 5321 limit
const MAX_LOCAL_PART_LENGTH = 64; // RFC 5321 limit
const MAX_DOMAIN_LENGTH = 253; // RFC 1035 limit
const MAX_LABEL_LENGTH = 63; // RFC 1035 limit

/**
 * Valid characters for the local part (before @)
 * RFC 5322 allows more characters, but we use a practical subset for security
 */
const LOCAL_PART_CHARS = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+$/;

/**
 * Valid characters for quoted local parts
 */
const QUOTED_LOCAL_PART_CHARS = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~\s\-.@]+$/;

/**
 * Domain validation regex (practical subset of RFC specifications)
 */
const DOMAIN_PART_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

/**
 * Top-level domain validation
 */
const TLD_REGEX = /^[a-zA-Z]{2,}$/;

/**
 * Common disposable email domains to flag (security consideration)
 */
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'tempmail.org',
  'temp-mail.org', 'throwaway.email', 'getnada.com', 'maildrop.cc',
  'yopmail.com', 'dispostable.com', 'tempail.com', 'sharklasers.com'
]);

/**
 * Validate email address according to RFC 5322 with practical security considerations
 */
export function validateEmail(email: string | null | undefined): EmailValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let normalizedEmail = '';
  let domain = '';
  let localPart = '';

  // Initial validation
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      errors: ['Email address is required'],
      warnings: [],
      normalizedEmail: '',
      domain: '',
      localPart: ''
    };
  }

  // Normalize email (trim and lowercase)
  normalizedEmail = email.trim().toLowerCase();

  // Length validation
  if (normalizedEmail.length === 0) {
    errors.push('Email address cannot be empty');
  }

  if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
    errors.push(`Email address cannot exceed ${MAX_EMAIL_LENGTH} characters`);
  }

  // Basic format validation
  const atCount = (normalizedEmail.match(/@/g) || []).length;
  if (atCount !== 1) {
    if (atCount === 0) {
      errors.push('Email address must contain an @ symbol');
    } else {
      errors.push('Email address must contain exactly one @ symbol');
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
      normalizedEmail,
      domain,
      localPart
    };
  }

  // Split into local and domain parts
  const atIndex = normalizedEmail.indexOf('@');
  localPart = normalizedEmail.substring(0, atIndex);
  domain = normalizedEmail.substring(atIndex + 1);

  // Validate local part
  validateLocalPart(localPart, errors, warnings);

  // Validate domain part
  validateDomainPart(domain, errors, warnings);

  // Additional security checks
  performSecurityChecks(domain, errors, warnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    normalizedEmail,
    domain,
    localPart
  };
}

/**
 * Validate the local part (before @) of an email address
 */
function validateLocalPart(localPart: string, errors: string[], warnings: string[]): void {
  if (localPart.length === 0) {
    errors.push('Email address cannot start with @');
    return;
  }

  if (localPart.length > MAX_LOCAL_PART_LENGTH) {
    errors.push(`Local part cannot exceed ${MAX_LOCAL_PART_LENGTH} characters`);
  }

  // Check for consecutive dots
  if (localPart.includes('..')) {
    errors.push('Email address cannot contain consecutive dots');
  }

  // Check for leading/trailing dots
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    errors.push('Email address cannot start or end with a dot');
  }

  // Handle quoted local parts
  if (localPart.startsWith('"') && localPart.endsWith('"')) {
    validateQuotedLocalPart(localPart, errors, warnings);
  } else {
    validateUnquotedLocalPart(localPart, errors, warnings);
  }
}

/**
 * Validate unquoted local part
 */
function validateUnquotedLocalPart(localPart: string, errors: string[], warnings: string[]): void {
  // Split by dots and validate each part
  const parts = localPart.split('.');

  for (const part of parts) {
    if (part.length === 0) {
      errors.push('Email address cannot contain empty parts between dots');
      continue;
    }

    // Check for valid characters
    if (!LOCAL_PART_CHARS.test(part)) {
      errors.push('Email address contains invalid characters in local part');
    }
  }

  // Security considerations
  if (localPart.includes('+')) {
    warnings.push('Email address contains + character (alias/tag)');
  }

  if (localPart.length < 2) {
    warnings.push('Very short local part may indicate a suspicious email');
  }
}

/**
 * Validate quoted local part
 */
function validateQuotedLocalPart(localPart: string, errors: string[], warnings: string[]): void {
  // Remove quotes for validation
  const content = localPart.slice(1, -1);

  if (content.length === 0) {
    errors.push('Quoted local part cannot be empty');
    return;
  }

  // Check for valid characters in quoted content
  if (!QUOTED_LOCAL_PART_CHARS.test(content)) {
    errors.push('Quoted local part contains invalid characters');
  }

  // Check for unescaped quotes
  if (content.includes('"') && !content.includes('\\"')) {
    errors.push('Unescaped quotes in quoted local part');
  }

  warnings.push('Email address uses quoted local part (less common)');
}

/**
 * Validate the domain part (after @) of an email address
 */
function validateDomainPart(domain: string, errors: string[], warnings: string[]): void {
  if (domain.length === 0) {
    errors.push('Email address cannot end with @');
    return;
  }

  if (domain.length > MAX_DOMAIN_LENGTH) {
    errors.push(`Domain cannot exceed ${MAX_DOMAIN_LENGTH} characters`);
  }

  // Check for consecutive dots
  if (domain.includes('..')) {
    errors.push('Domain cannot contain consecutive dots');
  }

  // Check for leading/trailing dots or hyphens
  if (domain.startsWith('.') || domain.endsWith('.')) {
    errors.push('Domain cannot start or end with a dot');
  }

  if (domain.startsWith('-') || domain.endsWith('-')) {
    errors.push('Domain cannot start or end with a hyphen');
  }

  // Handle IP address domains (less common but valid)
  if (domain.startsWith('[') && domain.endsWith(']')) {
    validateIPDomain(domain, errors, warnings);
    return;
  }

  // Validate regular domain
  validateRegularDomain(domain, errors, warnings);
}

/**
 * Validate IP address domain
 */
function validateIPDomain(domain: string, errors: string[], warnings: string[]): void {
  const ipContent = domain.slice(1, -1);

  // Basic IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ipContent)) {
    const parts = ipContent.split('.');
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (num > 255) {
        errors.push('Invalid IPv4 address in domain');
        return;
      }
    }
    warnings.push('Email address uses IP address domain (uncommon)');
  } else {
    errors.push('Invalid IP address format in domain');
  }
}

/**
 * Validate regular domain name
 */
function validateRegularDomain(domain: string, errors: string[], warnings: string[]): void {
  const labels = domain.split('.');

  if (labels.length < 2) {
    errors.push('Domain must have at least two parts (e.g., example.com)');
    return;
  }

  // Validate each label
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];

    if (label.length === 0) {
      errors.push('Domain cannot contain empty labels');
      continue;
    }

    if (label.length > MAX_LABEL_LENGTH) {
      errors.push(`Domain label cannot exceed ${MAX_LABEL_LENGTH} characters`);
    }

    // Validate label characters
    if (!DOMAIN_PART_REGEX.test(label)) {
      errors.push('Domain contains invalid characters');
    }

    // Validate TLD (last label)
    if (i === labels.length - 1) {
      if (!TLD_REGEX.test(label)) {
        errors.push('Invalid top-level domain');
      }

      if (label.length < 2) {
        errors.push('Top-level domain must be at least 2 characters');
      }
    }
  }
}

/**
 * Perform additional security checks
 */
function performSecurityChecks(domain: string, errors: string[], warnings: string[]): void {
  // Check for disposable email domains
  if (DISPOSABLE_DOMAINS.has(domain)) {
    warnings.push('Email address appears to be from a disposable email service');
  }

  // Check for suspicious patterns
  if (domain.includes('xn--')) {
    warnings.push('Domain contains internationalized characters (punycode)');
  }

  // Check for very long subdomains (potential security issue)
  const labels = domain.split('.');
  if (labels.length > 5) {
    warnings.push('Domain has many subdomains (potentially suspicious)');
  }

  // Check for localhost/test domains
  if (domain === 'localhost' || domain.endsWith('.local') || domain.endsWith('.test')) {
    warnings.push('Email address uses localhost or test domain');
  }
}

/**
 * Simple email validation for basic use cases
 * Less strict than full RFC validation
 */
export function isValidEmailSimple(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Basic format check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(normalizedEmail) && normalizedEmail.length <= MAX_EMAIL_LENGTH;
}

/**
 * Get a normalized email address for storage/comparison
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
}

/**
 * Extract domain from email address
 */
export function extractEmailDomain(email: string): string {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.indexOf('@');

  if (atIndex === -1) {
    return '';
  }

  return normalized.substring(atIndex + 1);
}

/**
 * Check if email is from a business domain (heuristic)
 */
export function isBusinessEmail(email: string): boolean {
  const domain = extractEmailDomain(email);

  // Common personal email domains
  const personalDomains = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'aol.com', 'protonmail.com', 'mail.com', 'gmx.com', 'yandex.com'
  ]);

  return !personalDomains.has(domain) && !DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Validate email for authentication context
 * Includes additional security considerations
 */
export function validateEmailForAuth(email: string | null | undefined): EmailValidationResult {
  const result = validateEmail(email);

  // Additional auth-specific validations
  if (result.isValid) {
    // Check for potential security issues
    if (result.domain.length < 4) {
      result.warnings.push('Very short domain may indicate suspicious email');
    }

    if (result.localPart.includes('admin') || result.localPart.includes('test')) {
      result.warnings.push('Email contains admin/test keywords');
    }

    // Stricter validation for auth
    if (result.localPart.length < 2) {
      result.errors.push('Email local part too short for authentication');
      result.isValid = false;
    }
  }

  return result;
}
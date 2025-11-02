/**
 * Comprehensive password validation utility with security best practices
 * Based on OWASP and NIST guidelines
 */

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-100 strength score
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  minSpecialChars: number;
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
  preventRepeatingChars: boolean;
  preventSequentialChars: boolean;
}

/**
 * Default secure password policy
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  minSpecialChars: 1,
  preventCommonPasswords: true,
  preventUserInfo: true,
  preventRepeatingChars: true,
  preventSequentialChars: true
};

/**
 * Relaxed password policy for better user experience while maintaining security
 */
export const BALANCED_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: false, // Made optional for better UX
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // Made optional for better UX
  minSpecialChars: 0,
  preventCommonPasswords: true,
  preventUserInfo: true,
  preventRepeatingChars: true,
  preventSequentialChars: true
};

/**
 * Most common weak passwords to check against
 */
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
  'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
  'qwerty123', 'admin123', 'root', 'toor', 'pass', 'test', 'guest',
  'user', 'login', '12345', '111111', '000000', 'dragon', 'soccer',
  'football', 'baseball', 'mustang', 'access', 'master', 'michael',
  'superman', 'batman', 'trustno1', 'hello', 'charlie', 'aa123456',
  'donald', 'password12', 'qwerty12'
]);

/**
 * Special characters allowed in passwords
 */
const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;

/**
 * Check for sequential characters (abc, 123, qwe, etc.)
 */
function hasSequentialChars(password: string, minLength: number = 3): boolean {
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz',
    'qwertyuiopasdfghjklzxcvbnm',
    '1234567890',
    '0987654321'
  ];

  const lower = password.toLowerCase();

  for (const sequence of sequences) {
    for (let i = 0; i <= sequence.length - minLength; i++) {
      const substring = sequence.substring(i, i + minLength);
      if (lower.includes(substring)) {
        return true;
      }
      // Check reverse sequence
      const reversed = substring.split('').reverse().join('');
      if (lower.includes(reversed)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check for repeating characters (aaa, 111, etc.)
 */
function hasRepeatingChars(password: string, minLength: number = 3): boolean {
  for (let i = 0; i <= password.length - minLength; i++) {
    const char = password[i];
    let repeating = true;

    for (let j = 1; j < minLength; j++) {
      if (password[i + j] !== char) {
        repeating = false;
        break;
      }
    }

    if (repeating) {
      return true;
    }
  }

  return false;
}

/**
 * Check if password contains user information
 */
function containsUserInfo(password: string, userInfo: { email?: string; name?: string }): boolean {
  const lower = password.toLowerCase();

  if (userInfo.email) {
    const emailParts = userInfo.email.toLowerCase().split('@');
    const username = emailParts[0];

    // Check if password contains username or parts of it
    if (username.length >= 3 && lower.includes(username)) {
      return true;
    }

    // Check domain
    if (emailParts[1] && emailParts[1].length >= 3 && lower.includes(emailParts[1].split('.')[0])) {
      return true;
    }
  }

  if (userInfo.name) {
    const nameParts = userInfo.name.toLowerCase().split(' ');
    for (const part of nameParts) {
      if (part.length >= 3 && lower.includes(part)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate password strength score
 */
function calculateStrengthScore(password: string, policy: PasswordPolicy): number {
  let score = 0;

  // Length score (40% of total)
  const lengthScore = Math.min((password.length / 12) * 40, 40);
  score += lengthScore;

  // Character variety score (40% of total)
  let varietyScore = 0;
  if (/[a-z]/.test(password)) varietyScore += 10;
  if (/[A-Z]/.test(password)) varietyScore += 10;
  if (/[0-9]/.test(password)) varietyScore += 10;
  if (SPECIAL_CHARS.test(password)) varietyScore += 10;
  score += varietyScore;

  // Pattern avoidance score (20% of total)
  let patternScore = 20;
  if (hasRepeatingChars(password)) patternScore -= 5;
  if (hasSequentialChars(password)) patternScore -= 5;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) patternScore -= 10;
  score += Math.max(patternScore, 0);

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Validate password against policy
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy = BALANCED_PASSWORD_POLICY,
  userInfo?: { email?: string; name?: string }
): PasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Basic checks
  if (!password) {
    return {
      isValid: false,
      score: 0,
      errors: ['Password is required'],
      warnings: [],
      suggestions: ['Please enter a password']
    };
  }

  // Length validation
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }

  if (password.length > policy.maxLength) {
    errors.push(`Password must be no more than ${policy.maxLength} characters long`);
  }

  // Character requirements
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
    suggestions.push('Add some lowercase letters (a-z)');
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
    suggestions.push('Add some uppercase letters (A-Z)');
  }

  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
    suggestions.push('Add some numbers (0-9)');
  }

  if (policy.requireSpecialChars) {
    const specialCharCount = (password.match(SPECIAL_CHARS) || []).length;
    if (specialCharCount < policy.minSpecialChars) {
      if (policy.minSpecialChars === 1) {
        errors.push('Password must contain at least one special character');
        suggestions.push('Add a special character (!@#$%^&*...)');
      } else {
        errors.push(`Password must contain at least ${policy.minSpecialChars} special characters`);
        suggestions.push(`Add ${policy.minSpecialChars - specialCharCount} more special characters`);
      }
    }
  }

  // Pattern checks
  if (policy.preventRepeatingChars && hasRepeatingChars(password)) {
    warnings.push('Password contains repeating characters');
    suggestions.push('Avoid repeating the same character multiple times');
  }

  if (policy.preventSequentialChars && hasSequentialChars(password)) {
    warnings.push('Password contains sequential characters');
    suggestions.push('Avoid sequences like "abc" or "123"');
  }

  // Common password check
  if (policy.preventCommonPasswords && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common and easily guessable');
    suggestions.push('Choose a more unique password');
  }

  // User info check
  if (policy.preventUserInfo && userInfo && containsUserInfo(password, userInfo)) {
    errors.push('Password should not contain your personal information');
    suggestions.push('Avoid using your name or email in your password');
  }

  // Additional security suggestions
  if (password.length < 12) {
    suggestions.push('Consider using a longer password (12+ characters) for better security');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    suggestions.push('Consider adding special characters for stronger security');
  }

  const score = calculateStrengthScore(password, policy);
  const isValid = errors.length === 0;

  return {
    isValid,
    score,
    errors,
    warnings,
    suggestions
  };
}

/**
 * Get password strength description
 */
export function getPasswordStrengthDescription(score: number): {
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  description: string;
  color: string;
} {
  if (score < 25) {
    return {
      level: 'very-weak',
      description: 'Very Weak',
      color: '#dc2626' // red-600
    };
  } else if (score < 50) {
    return {
      level: 'weak',
      description: 'Weak',
      color: '#ea580c' // orange-600
    };
  } else if (score < 70) {
    return {
      level: 'fair',
      description: 'Fair',
      color: '#ca8a04' // yellow-600
    };
  } else if (score < 85) {
    return {
      level: 'good',
      description: 'Good',
      color: '#16a34a' // green-600
    };
  } else {
    return {
      level: 'strong',
      description: 'Strong',
      color: '#059669' // emerald-600
    };
  }
}

/**
 * Generate secure random password suggestion
 */
export function generateSecurePassword(length: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = lowercase + uppercase + numbers + special;

  let password = '';

  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Check if password has been compromised (basic check against common patterns)
 * In production, you might want to integrate with HaveIBeenPwned API
 */
export function checkPasswordCompromise(password: string): {
  isCompromised: boolean;
  reason?: string;
} {
  // Check against common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      isCompromised: true,
      reason: 'This password appears in lists of commonly used passwords'
    };
  }

  // Check for simple patterns
  if (/^(.)\1+$/.test(password)) {
    return {
      isCompromised: true,
      reason: 'Password consists of repeating characters'
    };
  }

  if (/^\d+$/.test(password)) {
    return {
      isCompromised: true,
      reason: 'Password consists only of numbers'
    };
  }

  if (/^[a-zA-Z]+$/.test(password)) {
    return {
      isCompromised: true,
      reason: 'Password consists only of letters'
    };
  }

  return {
    isCompromised: false
  };
}
import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Example database helper tests
 * These demonstrate testing database-related utilities
 */

// Example database helpers
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function generateUserId(prefix: string = 'user'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 15)}`;
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Tests
describe('Database Helpers', () => {
  describe('sanitizeEmail', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com');
    });

    it('should handle already clean email', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
    });
  });

  describe('generateUserId', () => {
    it('should generate ID with default prefix', () => {
      const id = generateUserId();
      expect(id).toMatch(/^user_[a-z0-9]+$/);
    });

    it('should generate ID with custom prefix', () => {
      const id = generateUserId('admin');
      expect(id).toMatch(/^admin_[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateUserId();
      const id2 = generateUserId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('validatePassword', () => {
    it('should accept valid password', () => {
      const result = validatePassword('Test123456');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short password', () => {
      const result = validatePassword('Test12');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('test123456');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain an uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = validatePassword('TEST123456');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain a lowercase letter');
    });

    it('should reject password without numbers', () => {
      const result = validatePassword('TestPassword');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain a number');
    });

    it('should return multiple errors', () => {
      const result = validatePassword('test');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});

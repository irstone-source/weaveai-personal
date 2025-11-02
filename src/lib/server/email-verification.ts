import { randomBytes } from 'crypto'
import { db, users, verificationTokens } from './db/index.js'
import { eq, lt } from 'drizzle-orm'
import { env } from '$env/dynamic/private'
import { AUTH_ERRORS, sanitizeErrorForLogging } from '../utils/error-handling.js'

/**
 * Result of creating a verification token
 */
export interface VerificationTokenResult {
  token: string
  expires: Date
}

/**
 * Result of email verification attempt
 */
export interface VerificationResult {
  success: boolean
  message: string
  userId?: string
}

/**
 * Email verification service for managing verification tokens
 */
class EmailVerificationService {
  private readonly TOKEN_EXPIRY_HOURS = 24

  /**
   * Generate a secure verification token
   * @returns Hexadecimal token string
   */
  generateToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Calculate token expiry date
   * @returns Date object set to expire in TOKEN_EXPIRY_HOURS
   */
  private getTokenExpiry(): Date {
    const expiry = new Date()
    expiry.setHours(expiry.getHours() + this.TOKEN_EXPIRY_HOURS)
    return expiry
  }

  /**
   * Create and store verification token for user
   * @param userEmail - User's email address
   * @returns Promise with token and expiration date
   */
  async createVerificationToken(userEmail: string): Promise<VerificationTokenResult> {
    const token = this.generateToken()
    const expires = this.getTokenExpiry()

    try {
      // Clean up any existing tokens for this user
      await this.cleanupUserTokens(userEmail)

      // Insert new verification token
      await db.insert(verificationTokens).values({
        identifier: userEmail,
        token,
        expires
      })

      console.log(`[Email Verification] Created verification token`)
      return { token, expires }
    } catch (error) {
      console.error('[Email Verification] Failed to create verification token:', error)
      throw new Error('Failed to create verification token')
    }
  }

  /**
   * Verify token and update user's emailVerified status
   * @param token - Verification token to validate
   * @returns Promise with verification result
   */
  async verifyToken(token: string): Promise<VerificationResult> {
    try {
      // Find the token in database
      const verificationToken = await db
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.token, token))
        .limit(1)

      if (verificationToken.length === 0) {
        return {
          success: false,
          message: AUTH_ERRORS.VERIFICATION_ERROR
        }
      }

      const tokenData = verificationToken[0]

      // Check if token has expired
      if (new Date() > tokenData.expires) {
        // Clean up expired token
        await this.deleteToken(token)
        return {
          success: false,
          message: AUTH_ERRORS.VERIFICATION_ERROR
        }
      }

      // Find user by email (identifier)
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, tokenData.identifier))
        .limit(1)

      if (user.length === 0) {
        return {
          success: false,
          message: AUTH_ERRORS.VERIFICATION_ERROR
        }
      }

      const userData = user[0]

      // Check if email is already verified
      if (userData.emailVerified) {
        // Clean up token since email is already verified
        await this.deleteToken(token)
        return {
          success: true,
          message: 'Your email has already been verified.',
          userId: userData.id
        }
      }

      // Update user's emailVerified timestamp
      await db
        .update(users)
        .set({
          emailVerified: new Date()
        })
        .where(eq(users.email, tokenData.identifier))

      // Clean up the used token
      await this.deleteToken(token)

      console.log(`[Email Verification] Successfully verified email`)

      return {
        success: true,
        message: 'Your email has been successfully verified!',
        userId: userData.id
      }

    } catch (error) {
      const sanitizedError = sanitizeErrorForLogging(error);
      console.error('[Email Verification] Failed to verify token:', sanitizedError);
      return {
        success: false,
        message: AUTH_ERRORS.VERIFICATION_ERROR
      }
    }
  }

  // Delete a specific token
  private async deleteToken(token: string): Promise<void> {
    try {
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.token, token))
    } catch (error) {
      console.error('[Email Verification] Failed to delete token:', error)
    }
  }

  // Clean up all tokens for a user (used when creating new token)
  private async cleanupUserTokens(userEmail: string): Promise<void> {
    try {
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, userEmail))
    } catch (error) {
      console.error('[Email Verification] Failed to cleanup user tokens:', error)
    }
  }

  // Clean up expired tokens (maintenance function)
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const now = new Date()
      await db
        .delete(verificationTokens)
        .where(lt(verificationTokens.expires, now))

      console.log(`[Email Verification] Cleaned up expired tokens`)
    } catch (error) {
      console.error('[Email Verification] Failed to cleanup expired tokens:', error)
    }
  }

  // Generate verification URL
  generateVerificationUrl(token: string): string {
    const baseUrl = env.PUBLIC_ORIGIN || 'http://localhost:5173'
    return `${baseUrl}/verify-email?token=${token}`
  }

  // Check if user's email is verified
  async isEmailVerified(userEmail: string): Promise<boolean> {
    try {
      const user = await db
        .select({ emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.email, userEmail))
        .limit(1)

      return user.length > 0 && user[0].emailVerified !== null
    } catch (error) {
      console.error('[Email Verification] Failed to check verification status:', error)
      return false
    }
  }

  // Mark user email as verified (for social auth)
  async markEmailAsVerified(userEmail: string): Promise<boolean> {
    try {
      await db
        .update(users)
        .set({
          emailVerified: new Date()
        })
        .where(eq(users.email, userEmail))

      console.log(`[Email Verification] Marked email as verified for social auth user`)
      return true
    } catch (error) {
      console.error('[Email Verification] Failed to mark email as verified:', error)
      return false
    }
  }
}

// Create singleton instance
export const emailVerificationService = new EmailVerificationService()

// Export utility functions
export const createVerificationToken = (userEmail: string) =>
  emailVerificationService.createVerificationToken(userEmail)

export const verifyToken = (token: string) =>
  emailVerificationService.verifyToken(token)

export const generateVerificationUrl = (token: string) =>
  emailVerificationService.generateVerificationUrl(token)

export const isEmailVerified = (userEmail: string) =>
  emailVerificationService.isEmailVerified(userEmail)

export const markEmailAsVerified = (userEmail: string) =>
  emailVerificationService.markEmailAsVerified(userEmail)

export const cleanupExpiredTokens = () =>
  emailVerificationService.cleanupExpiredTokens()
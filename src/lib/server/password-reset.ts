import { randomBytes } from 'crypto'
import { db, users, passwordResetTokens } from './db/index.js'
import { eq, lt, gt, and } from 'drizzle-orm'
import { env } from '$env/dynamic/private'
import bcrypt from 'bcryptjs'

/**
 * Result of creating a password reset token
 */
export interface PasswordResetTokenResult {
  token: string
  expires: Date
}

/**
 * Result of password reset attempt
 */
export interface PasswordResetResult {
  success: boolean
  message: string
  userId?: string
}

/**
 * Data for password reset email
 */
export interface PasswordResetEmailData {
  name: string
  email: string
  resetUrl: string
}

/**
 * Password reset service for managing reset tokens and password updates
 */
class PasswordResetService {
  private readonly TOKEN_EXPIRY_HOURS = 24
  private readonly RATE_LIMIT_HOURS = 1

  /**
   * Generate a secure password reset token
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
   * Check if user is rate limited for password reset requests
   * @param userEmail - User's email address
   * @returns Promise<boolean> - true if rate limited
   */
  private async isRateLimited(userEmail: string): Promise<boolean> {
    try {
      const oneHourAgo = new Date()
      oneHourAgo.setHours(oneHourAgo.getHours() - this.RATE_LIMIT_HOURS)

      const recentTokens = await db
        .select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.identifier, userEmail),
          gt(passwordResetTokens.createdAt, oneHourAgo)
        ))
        .limit(1)

      return recentTokens.length > 0
    } catch (error) {
      console.error('[Password Reset] Failed to check rate limit:', error)
      return false
    }
  }

  /**
   * Create and store password reset token for user
   * @param userEmail - User's email address
   * @returns Promise with token and expiration date
   */
  async createPasswordResetToken(userEmail: string): Promise<PasswordResetTokenResult> {
    // Check if user exists
    const user = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1)

    if (user.length === 0) {
      throw new Error('User not found')
    }

    // Check rate limiting
    if (await this.isRateLimited(userEmail)) {
      throw new Error('Too many password reset requests. Please wait before requesting another reset.')
    }

    const token = this.generateToken()
    const expires = this.getTokenExpiry()

    try {
      // Clean up any existing tokens for this user
      await this.cleanupUserTokens(userEmail)

      // Insert new password reset token
      await db.insert(passwordResetTokens).values({
        identifier: userEmail,
        token,
        expires
      })

      console.log(`[Password Reset] Created reset token`)
      return { token, expires }
    } catch (error) {
      console.error('[Password Reset] Failed to create reset token:', error)
      throw new Error('Failed to create password reset token')
    }
  }

  /**
   * Validate password reset token
   * @param token - Reset token to validate
   * @returns Promise with validation result including user data
   */
  async validateResetToken(token: string): Promise<{ success: boolean; message: string; userEmail?: string; userId?: string }> {
    try {
      // Find the token in database
      const resetToken = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token))
        .limit(1)

      if (resetToken.length === 0) {
        return {
          success: false,
          message: 'Invalid reset token. Please request a new password reset.'
        }
      }

      const tokenData = resetToken[0]

      // Check if token has expired
      if (new Date() > tokenData.expires) {
        // Clean up expired token
        await this.deleteToken(token)
        return {
          success: false,
          message: 'Reset token has expired. Please request a new password reset.'
        }
      }

      // Find user by email (identifier)
      const user = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.email, tokenData.identifier))
        .limit(1)

      if (user.length === 0) {
        return {
          success: false,
          message: 'User not found. Please contact support.'
        }
      }

      return {
        success: true,
        message: 'Token is valid',
        userEmail: user[0].email || undefined,
        userId: user[0].id
      }

    } catch (error) {
      console.error('[Password Reset] Failed to validate token:', error)
      return {
        success: false,
        message: 'An error occurred during validation. Please try again.'
      }
    }
  }

  /**
   * Reset user password using valid token
   * @param token - Reset token
   * @param newPassword - New password to set
   * @returns Promise with reset result
   */
  async resetPassword(token: string, newPassword: string): Promise<PasswordResetResult> {
    // Validate token first
    const validation = await this.validateResetToken(token)
    if (!validation.success || !validation.userEmail) {
      return {
        success: false,
        message: validation.message
      }
    }

    try {
      // Hash the new password
      const saltRounds = 12
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

      // Update user's password
      await db
        .update(users)
        .set({
          password: hashedPassword
        })
        .where(eq(users.email, validation.userEmail))

      // Clean up the used token
      await this.deleteToken(token)

      console.log(`[Password Reset] Successfully reset password`)

      return {
        success: true,
        message: 'Your password has been successfully reset!',
        userId: validation.userId
      }

    } catch (error) {
      console.error('[Password Reset] Failed to reset password:', error)
      return {
        success: false,
        message: 'An error occurred while resetting your password. Please try again.'
      }
    }
  }

  /**
   * Delete a specific token
   * @param token - Token to delete
   */
  private async deleteToken(token: string): Promise<void> {
    try {
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token))
    } catch (error) {
      console.error('[Password Reset] Failed to delete token:', error)
    }
  }

  /**
   * Clean up all tokens for a user (used when creating new token)
   * @param userEmail - User's email address
   */
  private async cleanupUserTokens(userEmail: string): Promise<void> {
    try {
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.identifier, userEmail))
    } catch (error) {
      console.error('[Password Reset] Failed to cleanup user tokens:', error)
    }
  }

  /**
   * Clean up expired tokens (maintenance function)
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const now = new Date()
      await db
        .delete(passwordResetTokens)
        .where(lt(passwordResetTokens.expires, now))

      console.log(`[Password Reset] Cleaned up expired tokens`)
    } catch (error) {
      console.error('[Password Reset] Failed to cleanup expired tokens:', error)
    }
  }

  /**
   * Generate password reset URL
   * @param token - Reset token
   * @returns Reset URL
   */
  generateResetUrl(token: string): string {
    const baseUrl = env.PUBLIC_ORIGIN || 'http://localhost:5173'
    return `${baseUrl}/reset-password/${token}`
  }

  /**
   * Get user data for password reset email
   * @param userEmail - User's email address
   * @returns Promise with user data
   */
  async getUserForReset(userEmail: string): Promise<{ name: string; email: string } | null> {
    try {
      const user = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.email, userEmail))
        .limit(1)

      if (user.length === 0) {
        return null
      }

      const userData = user[0]
      if (!userData.email) {
        return null
      }

      return {
        name: userData.name || userData.email.split('@')[0],
        email: userData.email
      }
    } catch (error) {
      console.error('[Password Reset] Failed to get user data:', error)
      return null
    }
  }
}

// Create singleton instance
export const passwordResetService = new PasswordResetService()

// Export utility functions
export const createPasswordResetToken = (userEmail: string) =>
  passwordResetService.createPasswordResetToken(userEmail)

export const validateResetToken = (token: string) =>
  passwordResetService.validateResetToken(token)

export const resetPassword = (token: string, newPassword: string) =>
  passwordResetService.resetPassword(token, newPassword)

export const generateResetUrl = (token: string) =>
  passwordResetService.generateResetUrl(token)

export const getUserForReset = (userEmail: string) =>
  passwordResetService.getUserForReset(userEmail)

export const cleanupExpiredPasswordResetTokens = () =>
  passwordResetService.cleanupExpiredTokens()
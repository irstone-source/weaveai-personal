import nodemailer from 'nodemailer'
import { env } from '$env/dynamic/private'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getMailingSettings } from './admin-settings'

// Email configuration types
/**
 * Email message configuration
 */
export interface EmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Welcome email template data
 */
export interface WelcomeEmailData {
  name: string
  email: string
  verificationUrl?: string // Optional verification URL for email/password registrations
}

/**
 * Password reset email template data
 */
export interface PasswordResetEmailData {
  name: string
  email: string
  resetUrl: string
}

// Template utility functions
/**
 * Load an email template from the sys-email-templates directory
 * @param templateName - Name of the template file (without .html extension)
 * @returns HTML content of the template
 */
function loadEmailTemplate(templateName: string): string {
  try {
    const templatePath = join(process.cwd(), 'src', 'lib', 'server', 'sys-email-templates', `${templateName}.html`)
    const templateContent = readFileSync(templatePath, 'utf-8')

    // Basic validation that we loaded actual content
    if (!templateContent || templateContent.trim().length === 0) {
      throw new Error(`Template ${templateName} is empty or invalid`)
    }

    console.log(`[Email Service] Successfully loaded template: ${templateName}`)
    return templateContent
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Email Service] Failed to load template ${templateName}: ${errorMessage}`)
    throw new Error(`Failed to load email template: ${templateName} - ${errorMessage}`)
  }
}

/**
 * Validate that a template contains all required placeholders
 * @param template - HTML template content
 * @param requiredVariables - Array of required variable names
 * @returns Array of missing variables, empty if all present
 */
function validateTemplate(template: string, requiredVariables: string[]): string[] {
  const missing: string[] = []

  for (const variable of requiredVariables) {
    const placeholder = `{{${variable}}}`
    if (!template.includes(placeholder)) {
      missing.push(variable)
    }
  }

  return missing
}

/**
 * Process an email template by replacing placeholders with actual values
 * @param template - HTML template content
 * @param variables - Object containing variable values
 * @returns Processed HTML content
 */
function processEmailTemplate(template: string, variables: Record<string, any>): string {
  // Validate required placeholders for welcome email
  const requiredVars = ['platformName', 'displayName', 'publicOrigin']
  const missingVars = validateTemplate(template, requiredVars)

  if (missingVars.length > 0) {
    console.warn(`[Email Service] Template missing required placeholders: ${missingVars.join(', ')}`)
  }

  let processedTemplate = template

  // Replace simple variables
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), String(value || ''))
  })

  // Handle conditional blocks for verification
  if (variables.isVerificationRequired) {
    // Show verification content
    processedTemplate = processedTemplate.replace(
      /{{#if isVerificationRequired}}([\s\S]*?){{\/if}}/g,
      '$1'
    )
    // Hide non-verification content
    processedTemplate = processedTemplate.replace(
      /{{#unless isVerificationRequired}}([\s\S]*?){{\/unless}}/g,
      ''
    )
  } else {
    // Hide verification content
    processedTemplate = processedTemplate.replace(
      /{{#if isVerificationRequired}}([\s\S]*?){{\/if}}/g,
      ''
    )
    // Show non-verification content
    processedTemplate = processedTemplate.replace(
      /{{#unless isVerificationRequired}}([\s\S]*?){{\/unless}}/g,
      '$1'
    )
  }

  // Clean up any remaining unmatched placeholders
  processedTemplate = processedTemplate.replace(/{{[^}]*}}/g, '')

  return processedTemplate
}

/**
 * Email service for sending transactional emails via SMTP
 */
class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private isConfigured = false
  private cachedSmtpConfig: any = null
  private cacheTimestamp: number = 0
  private readonly CACHE_DURATION = 30000 // 30 seconds

  constructor() {
    // Initialize asynchronously - the service will be marked as not configured until initialization completes
    this.initializeTransporter()
  }

  // Get SMTP configuration with fallback logic: admin settings first, then environment variables
  private async getSmtpConfig() {
    // Check if we have a valid cached config
    const now = Date.now()
    if (this.cachedSmtpConfig && (now - this.cacheTimestamp < this.CACHE_DURATION)) {
      return this.cachedSmtpConfig
    }

    let smtpConfig: any

    try {
      // Try to get settings from admin dashboard first
      const adminSettings = await getMailingSettings()

      if (adminSettings.smtp_host && adminSettings.smtp_user && adminSettings.smtp_pass) {
        console.log('[Email Service] Using SMTP configuration from admin settings')
        smtpConfig = {
          host: adminSettings.smtp_host,
          port: parseInt(adminSettings.smtp_port || '587'),
          secure: adminSettings.smtp_secure === 'true',
          user: adminSettings.smtp_user,
          pass: adminSettings.smtp_pass,
          fromEmail: adminSettings.from_email,
          fromName: adminSettings.from_name,
          source: 'admin settings'
        }
      }
    } catch (error) {
      console.warn('[Email Service] Failed to load admin settings, falling back to environment variables:', error)
    }

    // Fall back to environment variables if admin settings are not available
    if (!smtpConfig) {
      console.log('[Email Service] Using SMTP configuration from environment variables')
      smtpConfig = {
        host: env.SMTP_HOST || '',
        port: parseInt(env.SMTP_PORT || '587'),
        secure: env.SMTP_SECURE === 'true',
        user: env.SMTP_USER || '',
        pass: env.SMTP_PASS || '',
        fromEmail: env.FROM_EMAIL,
        fromName: env.FROM_NAME,
        source: 'environment variables'
      }
    }

    // Cache the configuration
    this.cachedSmtpConfig = smtpConfig
    this.cacheTimestamp = now

    return smtpConfig
  }

  private async initializeTransporter() {
    try {
      // Get SMTP configuration with fallback logic
      const smtpConfig = await this.getSmtpConfig()

      if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
        console.warn('[Email Service] SMTP configuration not found. Email service will be disabled.')
        return
      }

      // Create reusable transporter object using SMTP transport
      this.transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
        // Additional options for better compatibility
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates (for development)
        }
      })

      this.isConfigured = true
      console.log(`[Email Service] SMTP transporter configured successfully using ${smtpConfig.source}`)
    } catch (error) {
      console.error('[Email Service] Failed to configure SMTP transporter:', error)
      this.transporter = null
      this.isConfigured = false
    }
  }

  // Test SMTP connection
  async testConnection(): Promise<boolean> {
    if (!this.transporter || !this.isConfigured) {
      console.warn('[Email Service] Transporter not configured')
      return false
    }

    try {
      await this.transporter.verify()
      console.log('[Email Service] SMTP connection verified successfully')
      return true
    } catch (error) {
      console.error('[Email Service] SMTP connection test failed:', error)
      return false
    }
  }

  // Send email with retry logic
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter || !this.isConfigured) {
      console.warn('[Email Service] Cannot send email - service not configured')
      return false
    }

    try {
      // Get current SMTP configuration for "from" fields
      const smtpConfig = await this.getSmtpConfig()
      const fromEmail = smtpConfig.fromEmail || smtpConfig.user
      const fromName = smtpConfig.fromName || 'AI Models Platform'

      const mailOptions = {
        from: `${fromName} <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }

      const info = await this.transporter.sendMail(mailOptions)
      console.log('[Email Service] Email sent successfully:', {
        messageId: info.messageId,
        to: options.to,
        subject: options.subject
      })
      return true
    } catch (error) {
      console.error('[Email Service] Failed to send email:', error)
      return false
    }
  }

  // Welcome email template
  async generateWelcomeEmail(data: WelcomeEmailData): Promise<{ html: string; text: string }> {
    const { name, email, verificationUrl } = data
    const smtpConfig = await this.getSmtpConfig()
    const platformName = smtpConfig.fromName || 'AI Models Platform'
    const displayName = name || email.split('@')[0]
    const isVerificationRequired = !!verificationUrl

    let html: string

    try {
      // Load and process the HTML template
      console.log(`[Email Service] Generating welcome email (verification: ${isVerificationRequired})`)
      const template = loadEmailTemplate('welcome-verify-email')
      html = processEmailTemplate(template, {
        platformName,
        displayName,
        verificationUrl: verificationUrl || '',
        isVerificationRequired,
        publicOrigin: env.PUBLIC_ORIGIN || 'http://localhost:5173'
      })
      console.log('[Email Service] Successfully processed welcome email template')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Email Service] Template processing failed for welcome email: ${errorMessage}`)
      console.log('[Email Service] Using fallback template for welcome email')
      // Fallback to a simple but complete HTML template
      html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${platformName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .container { background: #f9f9f9; padding: 30px; border-radius: 8px; }
    .button { background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
    .verify-button { background: #059669; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome, ${displayName}! 🎉</h1>
    <p>Thank you for joining our AI models platform!</p>
    ${isVerificationRequired ? `
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 15px 0;">
      <strong>Please verify your email address</strong><br>
      <small>Click the button below to complete your account setup.</small>
    </div>
    <a href="${verificationUrl}" class="button verify-button">✉️ Verify Email Address</a><br>
    ` : ''}
    <a href="${env.PUBLIC_ORIGIN || 'http://localhost:5173'}" class="button">Start Creating</a>
    <p><small>Welcome to the future of AI interaction!</small></p>
  </div>
</body>
</html>`
    }

    const text = `
Welcome to ${platformName}, ${displayName}! 🎉

Thank you for joining our AI models platform! We're excited to have you on board.

${isVerificationRequired ? `
⚠️  IMPORTANT: Please verify your email address
To complete your account setup, please visit the verification link below:
${verificationUrl}

` : ''}You now have access to:
• 65+ AI models from 9 different providers
• Text generation with Claude, GPT, Gemini, and more
• Image generation with DALL-E, Stable Diffusion, FLUX
• Video generation with cutting-edge AI models
• Seamless conversation history across all models
• Multimodal chat with image and text support

${isVerificationRequired ? 'After verifying your email, start creating at:' : 'Ready to start creating? Visit:'} ${env.PUBLIC_ORIGIN || 'http://localhost:5173'}

Welcome to the future of AI interaction!

If you have any questions, feel free to reach out to our support team.

---
${platformName}
`

    return { html, text }
  }

  // Password reset email template
  async generatePasswordResetEmail(data: PasswordResetEmailData): Promise<{ html: string; text: string }> {
    const { name, email, resetUrl } = data
    const smtpConfig = await this.getSmtpConfig()
    const platformName = smtpConfig.fromName || 'AI Models Platform'
    const displayName = name || email.split('@')[0]

    let html: string

    try {
      // Load and process the HTML template
      console.log(`[Email Service] Generating password reset email`)
      const template = loadEmailTemplate('reset-password')
      html = processEmailTemplate(template, {
        platformName,
        displayName,
        resetUrl,
        publicOrigin: env.PUBLIC_ORIGIN || 'http://localhost:5173'
      })
      console.log('[Email Service] Successfully processed password reset email template')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Email Service] Template processing failed for password reset email: ${errorMessage}`)
      console.log('[Email Service] Using fallback template for password reset email')
      // Fallback to a simple but complete HTML template
      html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - ${platformName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .container { background: #f9f9f9; padding: 30px; border-radius: 8px; }
    .button { background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 15px 0; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 15px 0; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reset Your Password 🔐</h1>
    <p>Hello ${displayName},</p>
    <p>We received a request to reset your password for your ${platformName} account.</p>
    <div class="warning">
      <strong>Security Notice:</strong> This link expires in 24 hours and can only be used once.
    </div>
    <a href="${resetUrl}" class="button">Reset My Password</a>
    <p><strong>Didn't request this?</strong> You can safely ignore this email.</p>
    <p><small>If you have questions, contact our support team.</small></p>
  </div>
</body>
</html>`
    }

    const text = `
Reset Your Password - ${platformName}

Hello ${displayName},

We received a request to reset the password for your ${platformName} account.

If you requested this password reset, click the link below to create a new password:
${resetUrl}

SECURITY NOTICE:
- This password reset link will expire in 24 hours
- The link can only be used once
- If you didn't request this, you can safely ignore this email

Security Tips:
• Choose a strong password with at least 8 characters
• Use a mix of letters, numbers, and special characters
• Don't reuse passwords from other accounts
• Consider using a password manager

If you continue to receive these emails or have concerns about your account security, please contact our support team immediately.

---
${platformName}
${env.PUBLIC_ORIGIN || 'http://localhost:5173'}
`

    return { html, text }
  }

  /**
   * Send welcome email to new users
   * @param userData - User data for email personalization
   * @returns Promise indicating success/failure
   */
  async sendWelcomeEmail(userData: WelcomeEmailData): Promise<boolean> {
    const { html, text } = await this.generateWelcomeEmail(userData)
    const smtpConfig = await this.getSmtpConfig()
    const platformName = smtpConfig.fromName || 'AI Models Platform'

    return await this.sendEmail({
      to: userData.email,
      subject: `Welcome to ${platformName}! 🚀`,
      html,
      text
    })
  }

  /**
   * Send password reset email to users
   * @param userData - User data for email personalization
   * @returns Promise indicating success/failure
   */
  async sendPasswordResetEmail(userData: PasswordResetEmailData): Promise<boolean> {
    const { html, text } = await this.generatePasswordResetEmail(userData)
    const smtpConfig = await this.getSmtpConfig()
    const platformName = smtpConfig.fromName || 'AI Models Platform'

    return await this.sendEmail({
      to: userData.email,
      subject: `Reset Your Password - ${platformName}`,
      html,
      text
    })
  }

  /**
   * Reconfigure the email service when settings change
   * This method should be called when admin settings are updated
   */
  async reconfigure(): Promise<boolean> {
    console.log('[Email Service] Reconfiguring email service due to settings change')

    // Clear the cached configuration
    this.cachedSmtpConfig = null
    this.cacheTimestamp = 0

    // Reset transporter
    this.transporter = null
    this.isConfigured = false

    // Initialize with new settings
    await this.initializeTransporter()
    return this.isConfigured
  }
}

// Create singleton instance
export const emailService = new EmailService()

// Export utility functions
export const sendWelcomeEmail = (userData: WelcomeEmailData) => emailService.sendWelcomeEmail(userData)
export const sendPasswordResetEmail = (userData: PasswordResetEmailData) => emailService.sendPasswordResetEmail(userData)
export const testEmailConnection = () => emailService.testConnection()
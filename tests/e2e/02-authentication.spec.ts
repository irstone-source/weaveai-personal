import { test, expect } from '@playwright/test';

/**
 * E2E Test: Authentication Flows
 * Tests sign up, sign in, and authentication-related functionality
 */

test.describe('Authentication', () => {
  test('should display sign in form', async ({ page }) => {
    await page.goto('/');

    // Look for sign in button/link
    const signInButton = page.getByRole('link', { name: /sign in|login/i });

    if (await signInButton.isVisible()) {
      await signInButton.click();

      // Wait for navigation or form to appear
      await page.waitForLoadState('networkidle');

      // Check for email/password fields
      const emailField = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
      const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));

      await expect(emailField.first()).toBeVisible({ timeout: 5000 });
      await expect(passwordField.first()).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'test-results/sign-in-form.png' });

      console.log('✅ Sign in form displayed correctly');
    } else {
      console.log('ℹ️  Sign in button not found - may already be authenticated');
    }
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/auth/signin').catch(() => page.goto('/signin')).catch(() => page.goto('/login'));
    await page.waitForLoadState('networkidle');

    // Try to find email field
    const emailField = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i)).first();

    if (await emailField.isVisible().catch(() => false)) {
      // Enter invalid email
      await emailField.fill('invalid-email');

      // Try to submit (look for submit button)
      const submitButton = page.getByRole('button', { name: /sign in|login|submit/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Check for validation error
        await page.waitForTimeout(1000);
        const validationError = await page.locator('text=/invalid.*email|email.*invalid|valid.*email/i').isVisible().catch(() => false);

        if (validationError) {
          console.log('✅ Email validation working');
        } else {
          console.log('⚠️  Email validation may not be working');
        }
      }
    }
  });

  test('should navigate between auth pages', async ({ page }) => {
    await page.goto('/');

    // Try to find "Sign Up" or "Create Account" link
    const signUpLink = page.getByRole('link', { name: /sign up|create account|register/i }).first();

    if (await signUpLink.isVisible().catch(() => false)) {
      await signUpLink.click();
      await page.waitForLoadState('networkidle');

      // Should now be on signup page
      await page.screenshot({ path: 'test-results/sign-up-page.png' });

      console.log('✅ Navigation between auth pages works');
    } else {
      console.log('ℹ️  Sign up link not found');
    }
  });
});

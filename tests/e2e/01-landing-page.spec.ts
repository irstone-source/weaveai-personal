import { test, expect } from '@playwright/test';

/**
 * E2E Test: Landing Page
 * Tests that the landing page loads correctly and displays expected content
 */

test.describe('Landing Page', () => {
  test('should load the landing page', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check that we're on a page (not a blank screen or error)
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/landing-page.png' });

    console.log('✅ Landing page loaded successfully');
  });

  test('should display navigation elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for common navigation elements
    // Adjust selectors based on your actual UI
    const hasSignIn = await page.getByText('Sign In').isVisible().catch(() => false);
    const hasSignUp = await page.getByText('Sign Up').isVisible().catch(() => false);
    const hasLogin = await page.getByText('Login').isVisible().catch(() => false);

    // At least one auth button should be visible
    expect(hasSignIn || hasSignUp || hasLogin).toBeTruthy();

    console.log('✅ Navigation elements found');
  });

  test('should not show errors on initial load', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for visible error messages on page
    const errorElements = await page.locator('[role="alert"]').count();
    expect(errorElements).toBe(0);

    console.log('✅ No errors on page load');
    if (errors.length > 0) {
      console.warn('⚠️  Console errors detected:', errors);
    }
  });
});

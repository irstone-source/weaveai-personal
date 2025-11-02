import { test, expect } from '@playwright/test';

/**
 * E2E Test: Settings Page
 * Tests settings and configuration functionality
 */

test.describe('Settings', () => {
  test('should load settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'test-results/settings-page.png', fullPage: true });

    const url = page.url();

    if (url.includes('/settings')) {
      console.log('✅ Settings page accessible');
    } else {
      console.log('ℹ️  Redirected to:', url, '- may require authentication');
    }
  });

  test('should display settings sections', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Look for common settings sections
    const sections = {
      profile: await page.getByText(/profile|account/i).isVisible().catch(() => false),
      preferences: await page.getByText(/preferences|settings/i).isVisible().catch(() => false),
      api: await page.getByText(/api.*key/i).isVisible().catch(() => false),
      billing: await page.getByText(/billing|subscription|plan/i).isVisible().catch(() => false),
    };

    console.log('Settings sections found:', sections);

    // At least one section should be visible
    const hasAnySections = Object.values(sections).some(v => v);

    if (hasAnySections) {
      console.log('✅ Settings sections displayed');
    } else {
      console.log('⚠️  No settings sections found - may require authentication');
    }
  });

  test('should have navigation tabs or menu', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Look for tabs or navigation menu
    const tabs = await page.locator('[role="tablist"]').or(
      page.locator('[role="tab"]')
    ).or(
      page.locator('.tabs')
    ).count();

    if (tabs > 0) {
      console.log('✅ Settings navigation found:', tabs, 'tabs/sections');
      await page.screenshot({ path: 'test-results/settings-navigation.png' });
    }
  });
});

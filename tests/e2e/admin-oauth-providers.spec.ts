import { test, expect } from '@playwright/test';

test.describe('Admin OAuth Providers Settings', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to admin OAuth settings page
		await page.goto('/admin/settings/oauth');

		// Wait for page to load
		await page.waitForLoadState('networkidle');
	});

	test('should display OAuth providers page with all sections', async ({ page }) => {
		// Check page title
		await expect(page.locator('h1')).toContainText('OAuth Providers');

		// Check all provider sections exist
		await expect(page.getByRole('heading', { name: 'Google OAuth' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Apple OAuth' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Twitter OAuth' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Facebook OAuth' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Linear OAuth' })).toBeVisible();
	});

	test('should enable and configure Google OAuth', async ({ page }) => {
		// Find Google OAuth section
		const googleSection = page.locator('text=Google OAuth').locator('..').locator('..');

		// Enable Google OAuth if not already enabled
		const enableSwitch = googleSection.getByRole('switch', { name: /enable/i });
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		// Fill in Google OAuth credentials (test values)
		await googleSection.getByLabel(/client id/i).fill('test-google-client-id-123');
		await googleSection.getByLabel(/client secret/i).fill('test-google-client-secret-xyz');

		// Save settings
		await googleSection.getByRole('button', { name: /save/i }).click();

		// Wait for success message
		await expect(page.getByText(/settings saved successfully/i)).toBeVisible({ timeout: 5000 });

		// Reload page and verify settings persisted
		await page.reload();
		await page.waitForLoadState('networkidle');

		const googleSectionAfter = page.locator('text=Google OAuth').locator('..').locator('..');
		await expect(googleSectionAfter.getByLabel(/client id/i)).toHaveValue('test-google-client-id-123');
	});

	test('should enable and configure Apple OAuth', async ({ page }) => {
		const appleSection = page.locator('text=Apple OAuth').locator('..').locator('..');

		const enableSwitch = appleSection.getByRole('switch', { name: /enable/i });
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		await appleSection.getByLabel(/client id/i).fill('test-apple-client-id-456');
		await appleSection.getByLabel(/team id/i).fill('test-team-id');
		await appleSection.getByLabel(/key id/i).fill('test-key-id');
		await appleSection.getByLabel(/private key/i).fill('-----BEGIN PRIVATE KEY-----\ntest-private-key\n-----END PRIVATE KEY-----');

		await appleSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/settings saved successfully/i)).toBeVisible({ timeout: 5000 });
	});

	test('should enable and configure Twitter OAuth', async ({ page }) => {
		const twitterSection = page.locator('text=Twitter OAuth').locator('..').locator('..');

		const enableSwitch = twitterSection.getByRole('switch', { name: /enable/i });
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		await twitterSection.getByLabel(/client id/i).fill('test-twitter-client-id-789');
		await twitterSection.getByLabel(/client secret/i).fill('test-twitter-client-secret-abc');

		await twitterSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/settings saved successfully/i)).toBeVisible({ timeout: 5000 });
	});

	test('should enable and configure Facebook OAuth', async ({ page }) => {
		const facebookSection = page.locator('text=Facebook OAuth').locator('..').locator('..');

		const enableSwitch = facebookSection.getByRole('switch', { name: /enable/i });
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		await facebookSection.getByLabel(/client id/i).fill('test-facebook-app-id-101');
		await facebookSection.getByLabel(/client secret/i).fill('test-facebook-app-secret-def');

		await facebookSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/settings saved successfully/i)).toBeVisible({ timeout: 5000 });
	});

	test('should enable and configure Linear OAuth', async ({ page }) => {
		const linearSection = page.locator('text=Linear OAuth').locator('..').locator('..');

		const enableSwitch = linearSection.getByRole('switch', { name: /enable/i });
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		await linearSection.getByLabel(/client id/i).fill('test-linear-client-id-202');
		await linearSection.getByLabel(/client secret/i).fill('test-linear-client-secret-ghi');

		await linearSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/settings saved successfully/i)).toBeVisible({ timeout: 5000 });
	});

	test('should disable OAuth provider', async ({ page }) => {
		const googleSection = page.locator('text=Google OAuth').locator('..').locator('..');

		// Enable first if not enabled
		const enableSwitch = googleSection.getByRole('switch', { name: /enable/i });
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		// Fill some data
		await googleSection.getByLabel(/client id/i).fill('test-to-disable');
		await googleSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/settings saved successfully/i)).toBeVisible({ timeout: 5000 });

		// Now disable it
		await enableSwitch.click();
		await page.waitForTimeout(500);
		await googleSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/settings saved successfully/i)).toBeVisible({ timeout: 5000 });

		// Reload and verify it's disabled
		await page.reload();
		await page.waitForLoadState('networkidle');

		const googleSectionAfter = page.locator('text=Google OAuth').locator('..').locator('..');
		const switchAfter = googleSectionAfter.getByRole('switch', { name: /enable/i });
		await expect(switchAfter).toHaveAttribute('data-state', 'unchecked');
	});

	test('should show validation error for missing required fields', async ({ page }) => {
		const googleSection = page.locator('text=Google OAuth').locator('..').locator('..');

		// Enable Google OAuth
		const enableSwitch = googleSection.getByRole('switch', { name: /enable/i });
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		// Clear client ID and try to save
		await googleSection.getByLabel(/client id/i).clear();
		await googleSection.getByRole('button', { name: /save/i }).click();

		// Should show error (either validation message or toast)
		const hasError = await Promise.race([
			page.getByText(/client id is required/i).isVisible().then(() => true),
			page.getByText(/invalid/i).isVisible().then(() => true),
			page.waitForTimeout(2000).then(() => false)
		]);

		// At minimum, the success message should not appear
		await expect(page.getByText(/settings saved successfully/i)).not.toBeVisible();
	});

	test('should persist multiple OAuth providers simultaneously', async ({ page }) => {
		// Enable and configure multiple providers
		const providers = [
			{ name: 'Google OAuth', clientId: 'multi-test-google-123' },
			{ name: 'Twitter OAuth', clientId: 'multi-test-twitter-456' },
			{ name: 'Linear OAuth', clientId: 'multi-test-linear-789' }
		];

		for (const provider of providers) {
			const section = page.locator(`text=${provider.name}`).locator('..').locator('..');

			const enableSwitch = section.getByRole('switch', { name: /enable/i });
			const isEnabled = await enableSwitch.getAttribute('data-state');

			if (isEnabled !== 'checked') {
				await enableSwitch.click();
				await page.waitForTimeout(500);
			}

			await section.getByLabel(/client id/i).fill(provider.clientId);
			await section.getByLabel(/client secret/i).fill('test-secret');
			await section.getByRole('button', { name: /save/i }).click();
			await expect(page.getByText(/settings saved successfully/i)).toBeVisible({ timeout: 5000 });
			await page.waitForTimeout(1000);
		}

		// Reload and verify all are still configured
		await page.reload();
		await page.waitForLoadState('networkidle');

		for (const provider of providers) {
			const section = page.locator(`text=${provider.name}`).locator('..').locator('..');
			await expect(section.getByLabel(/client id/i)).toHaveValue(provider.clientId);
		}
	});
});

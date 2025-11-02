import { test, expect } from '@playwright/test';

/**
 * Authenticated Production Verification
 * This test actually logs in and verifies pages work end-to-end
 *
 * REQUIRES: Admin credentials in environment variables
 * PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.greensignals.io';
const TEST_EMAIL = process.env.PLAYWRIGHT_EMAIL;
const TEST_PASSWORD = process.env.PLAYWRIGHT_PASSWORD;

test.describe('Authenticated Admin Page Verification', () => {
	test.beforeEach(async ({ page }) => {
		test.setTimeout(120000); // 2 minutes for auth flow

		// Skip if no credentials provided
		if (!TEST_EMAIL || !TEST_PASSWORD) {
			test.skip();
			return;
		}

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.waitForLoadState('networkidle');

		// Try to fill login form
		try {
			// Look for email input
			const emailInput = page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first();
			if (await emailInput.isVisible({ timeout: 5000 })) {
				await emailInput.fill(TEST_EMAIL);

				// Look for password input
				const passwordInput = page.locator('input[type="password"], input[name*="password"], input[id*="password"]').first();
				if (await passwordInput.isVisible({ timeout: 5000 })) {
					await passwordInput.fill(TEST_PASSWORD);

					// Click submit button
					const submitButton = page.locator('button[type="submit"]').first();
					await submitButton.click();

					// Wait for navigation after login
					await page.waitForURL(/\/(admin|chat|dashboard|$)/, { timeout: 30000 });
				}
			}
		} catch (error) {
			console.log('Login flow error:', error);
			// Continue - some auth methods might redirect automatically
		}
	});

	test('Fathom Import page renders after login', async ({ page }) => {
		// Navigate directly to Fathom Import page
		const response = await page.goto(`${BASE_URL}/admin/settings/fathom-import`);
		await page.waitForLoadState('networkidle');

		// Get final URL and status
		const finalUrl = page.url();
		const status = response?.status();

		console.log(`Final URL: ${finalUrl}`);
		console.log(`HTTP Status: ${status}`);

		// Check if we got redirected to login (meaning page doesn't work)
		if (finalUrl.includes('/login')) {
			throw new Error('FAILED: Still redirected to login after authentication - auth not working or page broken');
		}

		// Should be on the fathom-import page (not 404)
		expect(finalUrl).toContain('fathom-import');

		// Should return 200 (not 404)
		expect(status).toBe(200);

		// Page should have actual content (not empty error page)
		const bodyText = await page.locator('body').textContent();
		expect(bodyText).toBeTruthy();
		expect(bodyText?.length).toBeGreaterThan(100);

		// Should have Fathom-related content
		const hasFathomContent = await page.getByText(/fathom|meeting|import/i).count() > 0;
		expect(hasFathomContent).toBeTruthy();

		// Take screenshot for manual verification
		await page.screenshot({ path: '/tmp/fathom-import-page.png', fullPage: true });
		console.log('Screenshot saved to: /tmp/fathom-import-page.png');
	});

	test('Admin settings sidebar has Fathom Import link', async ({ page }) => {
		await page.goto(`${BASE_URL}/admin/settings/general`);
		await page.waitForLoadState('networkidle');

		// Check if we're still on a settings page (not redirected to login)
		const currentUrl = page.url();
		if (currentUrl.includes('/login')) {
			throw new Error('Auth failed - redirected to login');
		}

		// Look for Fathom Import in navigation
		const fathomLink = page.locator('text="Fathom Import"').or(
			page.locator('a[href*="fathom-import"]')
		).or(
			page.locator('button:has-text("Fathom Import")')
		);

		const fathomLinkCount = await fathomLink.count();
		console.log(`Fathom Import links found: ${fathomLinkCount}`);

		if (fathomLinkCount === 0) {
			// Take screenshot to show what's actually in the sidebar
			await page.screenshot({ path: '/tmp/admin-sidebar.png', fullPage: true });
			console.log('Sidebar screenshot saved to: /tmp/admin-sidebar.png');
			throw new Error('FAILED: Fathom Import link not found in sidebar navigation');
		}

		expect(fathomLinkCount).toBeGreaterThan(0);

		// Try to click it
		await fathomLink.first().click();
		await page.waitForLoadState('networkidle');

		// Should navigate to fathom-import page
		await expect(page).toHaveURL(/fathom-import/);
	});

	test('OAuth providers page shows Linear setup instructions', async ({ page }) => {
		await page.goto(`${BASE_URL}/admin/settings/oauth-providers`);
		await page.waitForLoadState('networkidle');

		const currentUrl = page.url();
		if (currentUrl.includes('/login')) {
			throw new Error('Auth failed - redirected to login');
		}

		// Should have Linear OAuth section
		const hasLinearSection = await page.getByText(/linear/i).count() > 0;
		if (!hasLinearSection) {
			await page.screenshot({ path: '/tmp/oauth-providers.png', fullPage: true });
			throw new Error('FAILED: No Linear section found on OAuth providers page');
		}

		// Should have the enhanced setup instructions
		const hasSetupInstructions = await page.getByText(/redirect.*uri|callback.*url|setup|configure/i).count() > 0;
		const hasCopyButton = await page.getByRole('button', { name: /copy/i }).count() > 0;

		console.log(`Setup instructions found: ${hasSetupInstructions}`);
		console.log(`Copy button found: ${hasCopyButton}`);

		// Take screenshot of the OAuth page
		await page.screenshot({ path: '/tmp/oauth-providers-linear.png', fullPage: true });
		console.log('OAuth providers screenshot saved to: /tmp/oauth-providers-linear.png');

		expect(hasSetupInstructions || hasCopyButton).toBeTruthy();
	});

	test('Meetings page exists and is accessible', async ({ page }) => {
		await page.goto(`${BASE_URL}/meetings`);
		await page.waitForLoadState('networkidle');

		const currentUrl = page.url();
		const response = await page.goto(`${BASE_URL}/meetings`);
		const status = response?.status();

		console.log(`Meetings page URL: ${currentUrl}`);
		console.log(`Status: ${status}`);

		if (currentUrl.includes('/login')) {
			throw new Error('Meetings page requires auth - redirected to login');
		}

		expect(status).toBe(200);
		expect(currentUrl).toContain('/meetings');

		// Should have some meetings content or empty state
		const bodyText = await page.locator('body').textContent();
		expect(bodyText?.length).toBeGreaterThan(100);

		await page.screenshot({ path: '/tmp/meetings-page.png', fullPage: true });
		console.log('Meetings screenshot saved to: /tmp/meetings-page.png');
	});
});

test.describe('Manual Verification Instructions', () => {
	test('Show manual verification steps', async ({}) => {
		console.log('\n=== MANUAL VERIFICATION REQUIRED ===\n');
		console.log('1. Go to: https://app.greensignals.io/login');
		console.log('2. Log in as admin');
		console.log('3. Navigate to: Admin → Settings');
		console.log('4. Check sidebar for "Fathom Import" link');
		console.log('5. Click "Fathom Import" - should NOT get 404');
		console.log('6. Go to OAuth Providers page');
		console.log('7. Scroll to Linear section');
		console.log('8. Verify enhanced instructions with Copy button exist');
		console.log('\n=== Screenshots saved to /tmp/ for review ===\n');
	});
});

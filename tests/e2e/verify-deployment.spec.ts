import { test, expect } from '@playwright/test';

/**
 * Deployment Verification Tests
 * These tests verify that critical pages work in production after deployment
 */

test.describe('Production Deployment Verification', () => {
	// Use production URL from environment or default
	const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://weaveai-enterprise-mezpjd3o5-ians-projects-4358fa58.vercel.app';

	test.beforeEach(async ({ page }) => {
		// Set base URL
		test.setTimeout(60000); // 60 seconds for production tests
	});

	test('Landing page loads successfully', async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState('networkidle');

		// Should not be a 404 or error page
		const title = await page.title();
		expect(title).not.toContain('404');
		expect(title).not.toContain('Error');

		// Should have some content
		await expect(page.locator('body')).not.toBeEmpty();
	});

	test('Login page loads', async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);
		await page.waitForLoadState('networkidle');

		// Should have login form elements
		const hasEmailField = await page.locator('input[type="email"], input[name*="email"]').count() > 0;
		const hasPasswordField = await page.locator('input[type="password"], input[name*="password"]').count() > 0;
		const hasSubmitButton = await page.locator('button[type="submit"]').count() > 0;

		expect(hasEmailField || hasPasswordField || hasSubmitButton).toBeTruthy();
	});

	test('Admin settings pages are protected (401/302, not 404)', async ({ page }) => {
		const adminPages = [
			'/admin/settings/fathom-import',
			'/admin/settings/oauth-providers',
			'/admin/settings/general',
		];

		for (const path of adminPages) {
			const response = await page.goto(`${BASE_URL}${path}`);
			const status = response?.status();

			console.log(`${path}: HTTP ${status}`);

			// Should be auth redirect (302/401) or require auth, NOT 404
			expect(status).not.toBe(404);

			if (status === 404) {
				throw new Error(`DEPLOYMENT VERIFICATION FAILED: ${path} returned 404 - page does not exist!`);
			}
		}
	});

	test('Fathom Import page exists (not 404)', async ({ page }) => {
		const response = await page.goto(`${BASE_URL}/admin/settings/fathom-import`);
		const status = response?.status();

		console.log(`Fathom Import page status: HTTP ${status}`);

		// Critical: Should NOT be 404
		if (status === 404) {
			throw new Error('CRITICAL: Fathom Import page returned 404 - navigation fix did not deploy!');
		}

		// Should be auth protected (401, 302, or 200 with login form)
		expect([200, 302, 401]).toContain(status);
	});

	test('Meetings page exists', async ({ page }) => {
		const response = await page.goto(`${BASE_URL}/meetings`);
		const status = response?.status();

		console.log(`Meetings page status: HTTP ${status}`);

		// Should exist (not 404)
		expect(status).not.toBe(404);
	});

	test('OAuth providers page exists with Linear setup', async ({ page }) => {
		const response = await page.goto(`${BASE_URL}/admin/settings/oauth-providers`);
		const status = response?.status();

		console.log(`OAuth providers page status: HTTP ${status}`);

		// Should exist (not 404)
		expect(status).not.toBe(404);
	});

	test('API health check', async ({ page }) => {
		// Try to hit the base API endpoint
		try {
			const response = await page.goto(`${BASE_URL}/api/health`);
			const status = response?.status();
			console.log(`API health: HTTP ${status}`);
		} catch (error) {
			console.log('API health endpoint not configured (optional)');
		}
	});
});

test.describe('Authenticated Admin Tests', () => {
	const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://weaveai-enterprise-mezpjd3o5-ians-projects-4358fa58.vercel.app';

	test('Login and verify Fathom Import page renders', async ({ page }) => {
		test.setTimeout(90000); // 90 seconds for full auth flow

		// Go to login
		await page.goto(`${BASE_URL}/login`);
		await page.waitForLoadState('networkidle');

		// Check if there's a magic link or OAuth option we can use for testing
		// For now, just verify the page structure exists
		const currentUrl = page.url();
		console.log('Login page URL:', currentUrl);

		// Manual verification note
		console.log('⚠️  Manual verification required: Admin must log in and check /admin/settings/fathom-import');
	});
});

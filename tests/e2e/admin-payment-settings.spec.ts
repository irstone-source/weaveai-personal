import { test, expect } from '@playwright/test';

test.describe('Admin Payment Settings', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/settings/payment');
		await page.waitForLoadState('networkidle');
	});

	test('should display payment settings page', async ({ page }) => {
		await expect(page.locator('h1')).toContainText('Payment');
		await expect(page.getByText(/stripe/i)).toBeVisible();
		await expect(page.getByText(/lemonsqueezy/i)).toBeVisible();
	});

	test('should configure Stripe settings', async ({ page }) => {
		const stripeSection = page.locator('text=Stripe').locator('..').locator('..');

		const enableSwitch = stripeSection.getByRole('switch').first();
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		await stripeSection.getByLabel(/publishable key/i).fill('pk_test_stripe_12345');
		await stripeSection.getByLabel(/secret key/i).fill('sk_test_stripe_secret_67890');

		await stripeSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
	});

	test('should configure LemonSqueezy settings', async ({ page }) => {
		const lsSection = page.locator('text=LemonSqueezy').locator('..').locator('..');

		const enableSwitch = lsSection.getByRole('switch').first();
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		await lsSection.getByLabel(/api key/i).fill('lmsq_test_key_abc123');
		await lsSection.getByLabel(/store id/i).fill('12345');

		await lsSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
	});
});

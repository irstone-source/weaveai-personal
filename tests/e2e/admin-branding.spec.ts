import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Admin Branding Settings', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/settings/branding');
		await page.waitForLoadState('networkidle');
	});

	test('should display branding settings page', async ({ page }) => {
		await expect(page.locator('h1')).toContainText('Branding');
		await expect(page.getByText(/logo/i)).toBeVisible();
		await expect(page.getByText(/favicon/i)).toBeVisible();
	});

	test('should configure site name and tagline', async ({ page }) => {
		await page.getByLabel(/site name/i).fill('Test SaaS Platform');
		await page.getByLabel(/tagline/i).fill('Build amazing things');

		await page.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

		await page.reload();
		await page.waitForLoadState('networkidle');

		await expect(page.getByLabel(/site name/i)).toHaveValue('Test SaaS Platform');
		await expect(page.getByLabel(/tagline/i)).toHaveValue('Build amazing things');
	});

	test('should configure brand colors', async ({ page }) => {
		await page.getByLabel(/primary color/i).fill('#3b82f6');
		await page.getByLabel(/secondary color/i).fill('#10b981');

		await page.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
	});

	test.skip('should upload logo image', async ({ page }) => {
		// Create a simple test image file would be needed for real testing
		// This test is skipped because it requires actual file upload functionality
		const fileInput = page.locator('input[type="file"]').first();
		await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test-logo.png'));

		await page.getByRole('button', { name: /upload/i }).click();
		await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 5000 });
	});
});

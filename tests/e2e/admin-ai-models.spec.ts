import { test, expect } from '@playwright/test';

test.describe('Admin AI Models Settings', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/settings/ai-models');
		await page.waitForLoadState('networkidle');
	});

	test('should display AI models page with all provider sections', async ({ page }) => {
		await expect(page.locator('h1')).toContainText('AI Model');

		// Check for AI provider sections
		const providers = ['OpenAI', 'Anthropic', 'Google', 'Mistral', 'Groq'];
		for (const provider of providers) {
			await expect(page.getByText(provider, { exact: false })).toBeVisible();
		}
	});

	test('should configure OpenAI settings', async ({ page }) => {
		const openaiSection = page.locator('text=OpenAI').locator('..').locator('..');

		const enableSwitch = openaiSection.getByRole('switch').first();
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		await openaiSection.getByLabel(/api key/i).fill('sk-test-openai-key-12345');
		await openaiSection.getByLabel(/model/i).fill('gpt-4-turbo-preview');

		await openaiSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

		await page.reload();
		await page.waitForLoadState('networkidle');

		const openaiAfter = page.locator('text=OpenAI').locator('..').locator('..');
		await expect(openaiAfter.getByLabel(/api key/i)).toHaveValue('sk-test-openai-key-12345');
	});

	test('should configure Anthropic settings', async ({ page }) => {
		const anthropicSection = page.locator('text=Anthropic').locator('..').locator('..');

		const enableSwitch = anthropicSection.getByRole('switch').first();
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		await anthropicSection.getByLabel(/api key/i).fill('sk-ant-test-key-67890');
		await anthropicSection.getByLabel(/model/i).fill('claude-3-opus-20240229');

		await anthropicSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
	});

	test('should persist settings across page reloads', async ({ page }) => {
		const testKey = `test-key-${Date.now()}`;

		const openaiSection = page.locator('text=OpenAI').locator('..').locator('..');

		const enableSwitch = openaiSection.getByRole('switch').first();
		const isEnabled = await enableSwitch.getAttribute('data-state');

		if (isEnabled !== 'checked') {
			await enableSwitch.click();
			await page.waitForTimeout(500);
		}

		await openaiSection.getByLabel(/api key/i).fill(testKey);
		await openaiSection.getByRole('button', { name: /save/i }).click();
		await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

		await page.reload();
		await page.waitForLoadState('networkidle');

		const openaiAfter = page.locator('text=OpenAI').locator('..').locator('..');
		await expect(openaiAfter.getByLabel(/api key/i)).toHaveValue(testKey);
	});
});

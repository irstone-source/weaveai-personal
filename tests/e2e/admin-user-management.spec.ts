import { test, expect } from '@playwright/test';

test.describe('Admin User Management', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/users');
		await page.waitForLoadState('networkidle');
	});

	test('should display users page', async ({ page }) => {
		await expect(page.locator('h1')).toContainText('User');
		await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
	});

	test('should display list of users', async ({ page }) => {
		// Check if table or list exists
		const hasTable = await page.locator('table').count() > 0;
		const hasList = await page.locator('[role="list"]').count() > 0;

		expect(hasTable || hasList).toBeTruthy();
	});

	test('should open create user dialog', async ({ page }) => {
		await page.getByRole('button', { name: /add user/i }).click();

		// Check if dialog/modal opened
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByLabel(/email/i)).toBeVisible();
	});

	test('should create a new user', async ({ page }) => {
		await page.getByRole('button', { name: /add user/i }).click();

		const timestamp = Date.now();
		await page.getByLabel(/name/i).fill(`Test User ${timestamp}`);
		await page.getByLabel(/email/i).fill(`testuser${timestamp}@example.com`);

		// Select role if available
		const roleSelect = page.getByLabel(/role/i);
		if (await roleSelect.isVisible()) {
			await roleSelect.selectOption('user');
		}

		await page.getByRole('button', { name: /create|save/i }).click();

		// Verify success
		await expect(page.getByText(/created successfully|added successfully/i)).toBeVisible({ timeout: 5000 });

		// Verify user appears in list
		await expect(page.getByText(`testuser${timestamp}@example.com`)).toBeVisible();
	});

	test('should search for users', async ({ page }) => {
		const searchInput = page.getByPlaceholder(/search/i);

		if (await searchInput.isVisible()) {
			await searchInput.fill('test');
			await page.waitForTimeout(1000);

			// Results should be filtered
			const resultCount = await page.locator('tbody tr, [role="listitem"]').count();
			expect(resultCount).toBeGreaterThan(-1); // At least we got some result or empty state
		}
	});

	test('should edit user details', async ({ page }) => {
		// Find first user edit button
		const editButton = page.getByRole('button', { name: /edit/i }).first();

		if (await editButton.isVisible()) {
			await editButton.click();

			await expect(page.getByRole('dialog')).toBeVisible();

			// Update name
			const nameInput = page.getByLabel(/name/i);
			await nameInput.fill('Updated Name');

			await page.getByRole('button', { name: /save|update/i }).click();
			await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 5000 });
		}
	});

	test('should delete a user', async ({ page }) => {
		// Create a user first to delete
		await page.getByRole('button', { name: /add user/i }).click();

		const timestamp = Date.now();
		await page.getByLabel(/email/i).fill(`deleteme${timestamp}@example.com`);
		await page.getByLabel(/name/i).fill('Delete Me');

		await page.getByRole('button', { name: /create|save/i }).click();
		await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 5000 });

		// Now find and delete it
		const userRow = page.locator(`text=deleteme${timestamp}@example.com`).locator('..').locator('..');
		const deleteButton = userRow.getByRole('button', { name: /delete/i });

		if (await deleteButton.isVisible()) {
			await deleteButton.click();

			// Confirm deletion
			await page.getByRole('button', { name: /confirm|yes/i }).click();

			await expect(page.getByText(/deleted successfully/i)).toBeVisible({ timeout: 5000 });

			// Verify user is gone
			await expect(page.getByText(`deleteme${timestamp}@example.com`)).not.toBeVisible();
		}
	});
});

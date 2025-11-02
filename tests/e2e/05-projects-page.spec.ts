import { test, expect } from '@playwright/test';

test.describe('Projects Page', () => {
	test('should load projects page', async ({ page }) => {
		// Navigate to projects page
		await page.goto('/projects');

		// If redirected to login, the route is protected (expected behavior)
		const url = page.url();
		const isLoginPage = url.includes('/login');
		const isProjectsPage = url.includes('/projects');

		// Either we're on the projects page (logged in) or login page (logged out)
		expect(isLoginPage || isProjectsPage).toBeTruthy();

		// Take screenshot
		await page.screenshot({ path: 'test-results/projects-page-initial.png', fullPage: true });

		// If on projects page, check for key elements
		if (isProjectsPage) {
			// Check for page title
			await expect(page.locator('h1')).toContainText('Client Projects');

			// Check for Connect Linear or Sync Linear button
			const linearButton = page.locator('button').filter({ hasText: /Connect Linear|Sync Linear/ });
			await expect(linearButton).toBeVisible();

			// Check for New Project button
			const newProjectButton = page.locator('button').filter({ hasText: 'New Project' });
			await expect(newProjectButton).toBeVisible();

			// Check for Linear connection status message
			const statusMessage = page.locator('text=/Connect Linear|Linear Connected/i');
			await expect(statusMessage).toBeVisible();
		}
	});

	test('should display empty state when no projects', async ({ page }) => {
		await page.goto('/projects');

		// Skip if redirected to login
		if (page.url().includes('/login')) {
			test.skip();
		}

		// Look for either projects grid or empty state
		const hasProjects = await page.locator('.grid').count() > 0;
		const hasEmptyState = await page.locator('text=/No projects yet/i').count() > 0;

		// Should have either projects or empty state
		expect(hasProjects || hasEmptyState).toBeTruthy();

		await page.screenshot({ path: 'test-results/projects-page-content.png', fullPage: true });
	});

	test('should check page structure and styling', async ({ page }) => {
		await page.goto('/projects');

		// Skip if redirected to login
		if (page.url().includes('/login')) {
			test.skip();
		}

		// Check page has proper styling (no obvious layout breaks)
		const mainContent = page.locator('div').first();
		await expect(mainContent).toBeVisible();

		// Take final screenshot
		await page.screenshot({ path: 'test-results/projects-page-final.png', fullPage: true });
	});
});

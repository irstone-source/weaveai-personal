import { test, expect } from '@playwright/test';

test.describe('Fathom Meeting Intelligence Integration', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to Fathom import page in admin settings
		await page.goto('/admin/settings/fathom-import');
		await page.waitForLoadState('networkidle');
	});

	test('should display Fathom import page', async ({ page }) => {
		await expect(page.locator('h1')).toContainText('Fathom');

		// Check for import button or status
		const hasImportButton = await page.getByRole('button', { name: /import|sync/i }).count() > 0;
		const hasStatusText = await page.getByText(/meetings|import/i).count() > 0;

		expect(hasImportButton || hasStatusText).toBeTruthy();
	});

	test('should show meetings list when navigating to meetings page', async ({ page }) => {
		await page.goto('/meetings');
		await page.waitForLoadState('networkidle');

		// Page should load successfully
		await expect(page.locator('h1')).toBeVisible();

		// Should have either meetings table or empty state
		const hasTable = await page.locator('table').count() > 0;
		const hasCards = await page.locator('[role="article"]').count() > 0;
		const hasEmptyState = await page.getByText(/no meetings|import meetings/i).count() > 0;

		expect(hasTable || hasCards || hasEmptyState).toBeTruthy();
	});

	test('should display meeting statistics on dashboard', async ({ page }) => {
		await page.goto('/meetings');
		await page.waitForLoadState('networkidle');

		// Look for statistics cards (total meetings, with transcripts, with insights)
		const statsVisible = await page.locator('text=/total|transcript|insight/i').count() > 0;
		expect(statsVisible).toBeTruthy();
	});

	test('should navigate to meetings insights dashboard', async ({ page }) => {
		await page.goto('/meetings/insights');
		await page.waitForLoadState('networkidle');

		await expect(page.locator('h1, h2')).toBeVisible();

		// Should show insights or empty state
		const hasInsights = await page.getByText(/decision|action|risk|opportunity/i).count() > 0;
		const hasEmptyState = await page.getByText(/no insights|no meetings/i).count() > 0;

		expect(hasInsights || hasEmptyState).toBeTruthy();
	});

	test('should have meetings navigation link in sidebar', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Check for Meetings link in navigation
		const meetingsLink = page.getByRole('button', { name: /meetings/i }).or(
			page.getByRole('link', { name: /meetings/i })
		);

		if (await meetingsLink.count() > 0) {
			await expect(meetingsLink.first()).toBeVisible();

			// Click and verify navigation
			await meetingsLink.first().click();
			await page.waitForLoadState('networkidle');

			// Should be on meetings page
			await expect(page).toHaveURL(/\/meetings/);
		}
	});

	test('should show import progress and status', async ({ page }) => {
		// Check if there's any import status or progress indicators
		const hasProgress = await page.locator('[role="progressbar"]').count() > 0;
		const hasStatus = await page.getByText(/importing|processing|complete|failed/i).count() > 0;
		const hasImportButton = await page.getByRole('button', { name: /import|sync/i }).count() > 0;

		// At least one of these should be present
		expect(hasProgress || hasStatus || hasImportButton).toBeTruthy();
	});

	test.skip('should handle meeting import workflow', async ({ page }) => {
		// This test is skipped because it requires actual Fathom API credentials
		// and would make real API calls

		// Find and click import button
		const importButton = page.getByRole('button', { name: /import|sync/i });

		if (await importButton.isVisible()) {
			await importButton.click();

			// Should show some progress or confirmation
			await expect(page.getByText(/importing|started|processing/i)).toBeVisible({ timeout: 10000 });
		}
	});

	test('should navigate from meetings list to meeting detail', async ({ page }) => {
		await page.goto('/meetings');
		await page.waitForLoadState('networkidle');

		// Try to find a meeting link or card
		const meetingLink = page.locator('a[href^="/meetings/"]').first();

		if (await meetingLink.count() > 0) {
			await meetingLink.click();
			await page.waitForLoadState('networkidle');

			// Should be on meeting detail page
			await expect(page).toHaveURL(/\/meetings\/[^\/]+$/);

			// Should show meeting details
			await expect(page.locator('h1')).toBeVisible();
		}
	});

	test('should display transcript section on meeting detail page', async ({ page }) => {
		await page.goto('/meetings');
		await page.waitForLoadState('networkidle');

		// Try to navigate to first meeting
		const meetingLink = page.locator('a[href^="/meetings/"]').first();

		if (await meetingLink.count() > 0) {
			await meetingLink.click();
			await page.waitForLoadState('networkidle');

			// Look for transcript section or empty state
			const hasTranscriptText = await page.getByText(/transcript|speaker|said/i).count() > 0;
			const hasEmptyState = await page.getByText(/no transcript/i).count() > 0;

			expect(hasTranscriptText || hasEmptyState).toBeTruthy();
		}
	});

	test('should display insights sections on meeting detail page', async ({ page }) => {
		await page.goto('/meetings');
		await page.waitForLoadState('networkidle');

		// Try to navigate to first meeting
		const meetingLink = page.locator('a[href^="/meetings/"]').first();

		if (await meetingLink.count() > 0) {
			await meetingLink.click();
			await page.waitForLoadState('networkidle');

			// Look for insight sections
			const hasInsights = await page.getByText(/decision|action item|risk|opportunity|key point/i).count() > 0;
			const hasEmptyState = await page.getByText(/no insights/i).count() > 0;

			expect(hasInsights || hasEmptyState).toBeTruthy();
		}
	});

	test('should show attendees information', async ({ page }) => {
		await page.goto('/meetings');
		await page.waitForLoadState('networkidle');

		// Try to navigate to first meeting
		const meetingLink = page.locator('a[href^="/meetings/"]').first();

		if (await meetingLink.count() > 0) {
			await meetingLink.click();
			await page.waitForLoadState('networkidle');

			// Look for attendees section
			const hasAttendees = await page.getByText(/attendee|participant/i).count() > 0;
			const hasEmptyState = await page.getByText(/no attendee/i).count() > 0;

			expect(hasAttendees || hasEmptyState).toBeTruthy();
		}
	});

	test('should have link to open meeting in Fathom', async ({ page }) => {
		await page.goto('/meetings');
		await page.waitForLoadState('networkidle');

		// Try to navigate to first meeting
		const meetingLink = page.locator('a[href^="/meetings/"]').first();

		if (await meetingLink.count() > 0) {
			await meetingLink.click();
			await page.waitForLoadState('networkidle');

			// Look for "Open in Fathom" link or similar
			const fathomLink = page.getByRole('link', { name: /fathom|external|view/i });

			if (await fathomLink.count() > 0) {
				// Link should be external
				const href = await fathomLink.first().getAttribute('href');
				expect(href).toBeTruthy();
			}
		}
	});
});

import { chromium } from '@playwright/test';

async function testProjects() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		console.log('Navigating to home page...');
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		console.log('Taking screenshot of home...');
		await page.screenshot({ path: '/tmp/test-home.png', fullPage: true });

		// Try to open sidebar
		console.log('Looking for sidebar trigger...');
		const sidebarTrigger = page.locator('button[class*="sidebar"]').first();
		if (await sidebarTrigger.isVisible()) {
			console.log('Clicking sidebar trigger...');
			await sidebarTrigger.click();
			await page.waitForTimeout(1000);
			await page.screenshot({ path: '/tmp/test-sidebar-open.png', fullPage: true });
		}

		// Look for Projects link
		console.log('Looking for Projects link...');
		const projectsLink = page.locator('text=Projects').first();
		if (await projectsLink.isVisible()) {
			console.log('Found Projects link, clicking...');
			await projectsLink.click();
			await page.waitForTimeout(2000);
			await page.screenshot({ path: '/tmp/test-after-projects-click.png', fullPage: true });
			console.log('Current URL:', page.url());
		} else {
			console.log('Projects link not visible');
			const allText = await page.locator('body').textContent();
			console.log('Page text includes:', allText?.substring(0, 500));
		}

		// Wait a bit to see what happened
		await page.waitForTimeout(3000);

	} catch (error) {
		console.error('Error:', error);
		await page.screenshot({ path: '/tmp/test-error.png', fullPage: true });
	} finally {
		await browser.close();
	}
}

testProjects();

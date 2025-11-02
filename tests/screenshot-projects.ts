import { chromium } from '@playwright/test';

async function screenshotProjects() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		// Go to projects as logged-in user
		console.log('Navigating to http://localhost:5173/projects');
		await page.goto('http://localhost:5173/projects');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(3000);

		console.log('Current URL:', page.url());
		console.log('Taking screenshot...');
		await page.screenshot({ path: '/tmp/current-projects-page.png', fullPage: true });

		// Get page title or heading
		try {
			const h1 = await page.locator('h1').first().textContent({ timeout: 2000 });
			console.log('H1 text:', h1);
		} catch (e) {
			console.log('No H1 found');
		}

		// Check for error text
		try {
			const errorText = await page.locator('body').textContent();
			if (errorText?.includes('500') || errorText?.includes('Internal Error')) {
				console.log('❌ Page shows 500 error');
				console.log('Error text:', errorText?.substring(0, 200));
			}
		} catch (e) {
			// Ignore
		}

		await page.waitForTimeout(5000);

	} catch (error) {
		console.error('Error:', error);
		await page.screenshot({ path: '/tmp/screenshot-error.png', fullPage: true });
	} finally {
		await browser.close();
	}
}

screenshotProjects();

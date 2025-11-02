import { chromium } from '@playwright/test';

async function testProjectsNoAuth() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		console.log('Navigating directly to /projects...');
		await page.goto('http://localhost:5173/projects');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		console.log('Current URL:', page.url());
		await page.screenshot({ path: '/tmp/projects-no-auth-test.png', fullPage: true });

		// Check what's on the page
		const heading = await page.locator('h1').first().textContent();
		console.log('Page heading:', heading);

		// Look for the Connect Linear button
		const connectButton = await page.locator('button:has-text("Connect Linear")').count();
		console.log('Connect Linear buttons found:', connectButton);

		// Look for the empty state
		const emptyState = await page.locator('text=No projects yet').count();
		console.log('Empty state found:', emptyState > 0);

		// Check if redirected to login
		const isLogin = page.url().includes('/login');
		console.log('Redirected to login?', isLogin);

		// Wait to see the result
		await page.waitForTimeout(5000);

	} catch (error) {
		console.error('Error:', error);
		await page.screenshot({ path: '/tmp/test-projects-error.png', fullPage: true });
	} finally {
		await browser.close();
	}
}

testProjectsNoAuth();

import { chromium } from '@playwright/test';

async function testProjectsFinal() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		console.log('Testing Projects page after schema push...');
		await page.goto('http://localhost:5173/projects');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		const url = page.url();
		console.log('Current URL:', url);

		if (url.includes('/projects') && !url.includes('/login')) {
			console.log('✅ SUCCESS: Projects page loaded!');

			const heading = await page.locator('h1').first().textContent();
			console.log('Page heading:', heading);

			const connectButton = await page.locator('button:has-text("Connect Linear")').count();
			console.log('Connect Linear buttons found:', connectButton);

			await page.screenshot({ path: '/tmp/projects-working.png', fullPage: true });
		} else if (url.includes('/login')) {
			console.log('🔐 Redirected to login (authentication working)');
			await page.screenshot({ path: '/tmp/projects-login.png', fullPage: true });
		} else {
			console.log('❌ Unexpected URL:', url);
			await page.screenshot({ path: '/tmp/projects-unexpected.png', fullPage: true });
		}

		await page.waitForTimeout(5000);

	} catch (error) {
		console.error('Error:', error);
		await page.screenshot({ path: '/tmp/projects-test-error.png', fullPage: true });
	} finally {
		await browser.close();
	}
}

testProjectsFinal();

import { chromium } from '@playwright/test';

async function testProjectsWithAuth() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		console.log('Navigating to login page...');
		await page.goto('http://localhost:5173/login');
		await page.waitForLoadState('networkidle');

		// Check if already logged in by looking for chat interface
		const isAlreadyLoggedIn = page.url().includes('/chat') || page.url() === 'http://localhost:5173/';

		if (!isAlreadyLoggedIn) {
			console.log('Need to log in. Looking for email field...');
			await page.screenshot({ path: '/tmp/login-page.png', fullPage: true });

			// Fill in login form
			const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
			const passwordInput = page.locator('input[type="password"]').first();
			const loginButton = page.locator('button:has-text("Log in")').first();

			if (await emailInput.isVisible()) {
				console.log('Filling email: admin@test.com');
				await emailInput.fill('admin@test.com');
				await passwordInput.fill('password123');
				await loginButton.click();
				await page.waitForLoadState('networkidle');
				await page.waitForTimeout(2000);
			}
		}

		console.log('Current URL after login:', page.url());
		await page.screenshot({ path: '/tmp/after-login.png', fullPage: true });

		// Now try to navigate to projects
		console.log('Navigating to /projects...');
		await page.goto('http://localhost:5173/projects');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		console.log('Final URL:', page.url());
		await page.screenshot({ path: '/tmp/projects-page-authenticated.png', fullPage: true });

		// Check what's on the page
		const pageTitle = await page.locator('h1').first().textContent();
		console.log('Page title:', pageTitle);

		// Wait to see the result
		await page.waitForTimeout(5000);

	} catch (error) {
		console.error('Error:', error);
		await page.screenshot({ path: '/tmp/test-error-auth.png', fullPage: true });
	} finally {
		await browser.close();
	}
}

testProjectsWithAuth();

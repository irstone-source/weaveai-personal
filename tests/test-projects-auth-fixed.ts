import { chromium } from '@playwright/test';

async function testProjectsAuthFixed() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		console.log('=== TEST 1: Unauthenticated Access ===');
		console.log('Navigating to /projects without auth...');
		await page.goto('http://localhost:5173/projects');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		const urlAfterRedirect = page.url();
		console.log('URL after access attempt:', urlAfterRedirect);

		if (urlAfterRedirect.includes('/login')) {
			console.log('✅ PASS: Redirected to login as expected');
			await page.screenshot({ path: '/tmp/test-auth-redirect.png', fullPage: true });
		} else {
			console.log('❌ FAIL: Should have redirected to login');
			await page.screenshot({ path: '/tmp/test-auth-no-redirect.png', fullPage: true });
		}

		console.log('\n=== TEST 2: Authenticated Access ===');
		console.log('Attempting to log in...');

		// Fill login form
		const emailInput = page.locator('input[type="email"]').first();
		const passwordInput = page.locator('input[type="password"]').first();
		const loginButton = page.locator('button:has-text("Log in")').first();

		if (await emailInput.isVisible()) {
			await emailInput.fill('admin@test.com');
			await passwordInput.fill('password123');
			await loginButton.click();
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(2000);

			console.log('URL after login:', page.url());

			// Now try accessing projects
			console.log('Navigating to /projects with auth...');
			await page.goto('http://localhost:5173/projects');
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(2000);

			const finalUrl = page.url();
			console.log('Final URL:', finalUrl);

			if (finalUrl.includes('/projects') && !finalUrl.includes('/login')) {
				console.log('✅ PASS: Accessed Projects page with authentication');

				// Check for expected content
				const heading = await page.locator('h1').first().textContent();
				console.log('Page heading:', heading);

				if (heading?.includes('Client Projects')) {
					console.log('✅ PASS: Projects page content loaded correctly');
				}

				await page.screenshot({ path: '/tmp/test-auth-success.png', fullPage: true });
			} else {
				console.log('❌ FAIL: Still redirected to login even with auth');
				await page.screenshot({ path: '/tmp/test-auth-still-redirected.png', fullPage: true });
			}
		} else {
			console.log('⚠️ Could not find login form');
		}

		// Wait to see the result
		await page.waitForTimeout(3000);

	} catch (error) {
		console.error('Error:', error);
		await page.screenshot({ path: '/tmp/test-auth-error.png', fullPage: true });
	} finally {
		await browser.close();
	}
}

testProjectsAuthFixed();

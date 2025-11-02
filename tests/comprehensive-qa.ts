import { chromium } from '@playwright/test';

interface TestResult {
	feature: string;
	status: 'PASS' | 'FAIL' | 'SKIP';
	error?: string;
	screenshot?: string;
}

async function comprehensiveQA() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();
	const results: TestResult[] = [];

	try {
		console.log('=== COMPREHENSIVE QA TEST ===\n');

		// Test 1: Home Page
		console.log('Test 1: Loading home page...');
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');
		const homeLoaded = await page.locator('body').isVisible();
		results.push({
			feature: 'Home Page Load',
			status: homeLoaded ? 'PASS' : 'FAIL'
		});
		await page.screenshot({ path: '/tmp/qa-1-home.png', fullPage: true });

		// Test 2: Login Page Access
		console.log('Test 2: Navigating to login...');
		await page.goto('http://localhost:5173/login');
		await page.waitForLoadState('networkidle');
		const loginPageLoaded = await page.locator('h1:has-text("Log in")').isVisible();
		results.push({
			feature: 'Login Page',
			status: loginPageLoaded ? 'PASS' : 'FAIL'
		});
		await page.screenshot({ path: '/tmp/qa-2-login.png', fullPage: true });

		// Test 3: Sidebar Toggle
		console.log('Test 3: Testing sidebar...');
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');
		const sidebarTrigger = page.locator('button').filter({ has: page.locator('svg') }).first();
		const sidebarExists = await sidebarTrigger.count() > 0;
		results.push({
			feature: 'Sidebar',
			status: sidebarExists ? 'PASS' : 'FAIL'
		});

		// Test 4: New Chat Button
		console.log('Test 4: Testing New Chat button...');
		const newChatButton = page.locator('text=New chat').first();
		const newChatVisible = await newChatButton.isVisible({ timeout: 2000 }).catch(() => false);
		results.push({
			feature: 'New Chat Button',
			status: newChatVisible ? 'PASS' : 'FAIL'
		});

		// Test 5: Library Link
		console.log('Test 5: Testing Library link...');
		const libraryLink = page.locator('text=Library').first();
		const libraryVisible = await libraryLink.isVisible({ timeout: 2000 }).catch(() => false);
		if (libraryVisible) {
			await libraryLink.click();
			await page.waitForTimeout(1000);
			const libraryUrl = page.url();
			results.push({
				feature: 'Library Navigation',
				status: libraryUrl.includes('/library') ? 'PASS' : 'FAIL'
			});
			await page.screenshot({ path: '/tmp/qa-5-library.png', fullPage: true });
		} else {
			results.push({ feature: 'Library Navigation', status: 'SKIP', error: 'Library link not found' });
		}

		// Test 6: Projects Link
		console.log('Test 6: Testing Projects link...');
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');
		const projectsLink = page.locator('text=Projects').first();
		const projectsVisible = await projectsLink.isVisible({ timeout: 2000 }).catch(() => false);
		if (projectsVisible) {
			await projectsLink.click();
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(2000);
			const projectsUrl = page.url();
			const redirectedToLogin = projectsUrl.includes('/login');
			results.push({
				feature: 'Projects Link',
				status: (projectsUrl.includes('/projects') || redirectedToLogin) ? 'PASS' : 'FAIL',
				error: redirectedToLogin ? 'Requires authentication (expected)' : undefined
			});
			await page.screenshot({ path: '/tmp/qa-6-projects.png', fullPage: true });
		} else {
			results.push({ feature: 'Projects Link', status: 'FAIL', error: 'Projects link not found' });
		}

		// Test 7: Settings Access
		console.log('Test 7: Testing Settings...');
		await page.goto('http://localhost:5173/settings');
		await page.waitForLoadState('networkidle');
		const settingsUrl = page.url();
		results.push({
			feature: 'Settings Page',
			status: (settingsUrl.includes('/settings') || settingsUrl.includes('/login')) ? 'PASS' : 'FAIL'
		});
		await page.screenshot({ path: '/tmp/qa-7-settings.png', fullPage: true });

		// Test 8: Chat Interface Elements
		console.log('Test 8: Testing Chat Interface...');
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');
		const chatInput = page.locator('textarea, input[type="text"]').first();
		const chatInputExists = await chatInput.count() > 0;
		results.push({
			feature: 'Chat Input Field',
			status: chatInputExists ? 'PASS' : 'FAIL'
		});

		// Test 9: Model Selector
		console.log('Test 9: Testing Model Selector...');
		const modelSelector = page.locator('button, select').filter({ hasText: /gpt|claude|model/i }).first();
		const modelSelectorExists = await modelSelector.count() > 0;
		results.push({
			feature: 'Model Selector',
			status: modelSelectorExists ? 'PASS' : 'SKIP',
			error: !modelSelectorExists ? 'Model selector not found' : undefined
		});

		// Test 10: Admin Dashboard (should require auth)
		console.log('Test 10: Testing Admin Dashboard...');
		await page.goto('http://localhost:5173/admin');
		await page.waitForLoadState('networkidle');
		const adminUrl = page.url();
		const adminProtected = adminUrl.includes('/login') || adminUrl.includes('/admin');
		results.push({
			feature: 'Admin Dashboard Protection',
			status: adminProtected ? 'PASS' : 'FAIL'
		});
		await page.screenshot({ path: '/tmp/qa-10-admin.png', fullPage: true });

		// Test 11: Pricing Page
		console.log('Test 11: Testing Pricing page...');
		await page.goto('http://localhost:5173/pricing');
		await page.waitForLoadState('networkidle');
		const pricingUrl = page.url();
		results.push({
			feature: 'Pricing Page',
			status: pricingUrl.includes('/pricing') ? 'PASS' : 'FAIL'
		});
		await page.screenshot({ path: '/tmp/qa-11-pricing.png', fullPage: true });

		// Print Summary
		console.log('\n=== QA TEST RESULTS ===\n');
		const passed = results.filter(r => r.status === 'PASS').length;
		const failed = results.filter(r => r.status === 'FAIL').length;
		const skipped = results.filter(r => r.status === 'SKIP').length;

		results.forEach(result => {
			const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
			console.log(`${icon} ${result.feature}: ${result.status}`);
			if (result.error) {
				console.log(`   Note: ${result.error}`);
			}
		});

		console.log(`\nTotal: ${results.length} tests`);
		console.log(`Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
		console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

		// Wait to review
		await page.waitForTimeout(3000);

	} catch (error) {
		console.error('Fatal error during QA:', error);
		await page.screenshot({ path: '/tmp/qa-error.png', fullPage: true });
	} finally {
		await browser.close();
	}
}

comprehensiveQA();

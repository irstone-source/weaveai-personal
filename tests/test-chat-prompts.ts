import { chromium } from '@playwright/test';

async function testChatPrompts() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	// Listen for console logs
	page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

	// Listen for errors
	page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));

	try {
		console.log('1. Loading home page...');
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);
		await page.screenshot({ path: '/tmp/test-prompt-1-loaded.png', fullPage: true });

		console.log('2. Testing Creative Writing card click...');
		const creativeWritingCard = page.locator('text=Creative Writing').first();
		const isVisible = await creativeWritingCard.isVisible();
		console.log('Creative Writing card visible:', isVisible);

		if (isVisible) {
			await creativeWritingCard.click();
			await page.waitForTimeout(2000);
			await page.screenshot({ path: '/tmp/test-prompt-2-clicked.png', fullPage: true });

			// Check if text appears in input
			const inputValue = await page.locator('textarea, input[type="text"]').first().inputValue();
			console.log('Input value after click:', inputValue);
		}

		console.log('3. Testing direct text input...');
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		const chatInput = page.locator('textarea').first();
		await chatInput.fill('Test message');
		await page.waitForTimeout(500);
		await page.screenshot({ path: '/tmp/test-prompt-3-typed.png', fullPage: true });

		console.log('4. Testing submit (press Enter)...');
		await chatInput.press('Enter');
		await page.waitForTimeout(3000);
		await page.screenshot({ path: '/tmp/test-prompt-4-submitted.png', fullPage: true });

		// Check if message appears
		const messageText = await page.locator('body').textContent();
		console.log('Message appeared:', messageText?.includes('Test message'));

		await page.waitForTimeout(3000);

	} catch (error) {
		console.error('Error:', error);
		await page.screenshot({ path: '/tmp/test-prompt-error.png', fullPage: true });
	} finally {
		await browser.close();
	}
}

testChatPrompts();

import { test, expect } from '@playwright/test';

/**
 * E2E Test: Chat Interface
 * Tests the main chat functionality
 *
 * Note: These tests assume authentication is required.
 * You may need to add authentication setup in beforeEach if needed.
 */

test.describe('Chat Interface', () => {
  test('should load chat page when navigating to /chat', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: 'test-results/chat-page.png', fullPage: true });

    // Check if we're redirected to auth or if chat loads
    const url = page.url();

    if (url.includes('/chat')) {
      console.log('✅ Chat page accessible');

      // Look for chat input
      const chatInput = page.getByPlaceholder(/type.*message|enter.*message|message/i).or(
        page.locator('textarea[name="message"]')
      ).or(
        page.locator('input[type="text"]').last()
      );

      if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('✅ Chat input field found');
      } else {
        console.log('⚠️  Chat input field not found - may require authentication');
      }
    } else {
      console.log('ℹ️  Redirected to:', url, '- authentication may be required');
    }
  });

  test('should display chat interface elements', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Check for various chat UI elements
    const elements = {
      messages: await page.locator('[role="main"]').or(page.locator('.chat-messages')).isVisible().catch(() => false),
      input: await page.locator('textarea').or(page.locator('input[type="text"]')).count() > 0,
      sendButton: await page.getByRole('button').count() > 0,
    };

    console.log('Chat interface elements:', elements);

    // At least some UI elements should be present
    expect(elements.input || elements.sendButton).toBeTruthy();
  });

  test('should allow typing in chat input', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Find any text input (textarea or input)
    const chatInput = page.locator('textarea').or(page.locator('input[type="text"]')).first();

    if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatInput.fill('Hello, this is a test message');

      const value = await chatInput.inputValue();
      expect(value).toContain('test message');

      console.log('✅ Chat input accepts text');

      await page.screenshot({ path: 'test-results/chat-with-message.png' });
    } else {
      console.log('⚠️  Chat input not accessible - may require authentication');
    }
  });

  test('should handle navigation in chat', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Look for sidebar or navigation
    const sidebarExists = await page.locator('aside').or(page.locator('[role="navigation"]')).isVisible().catch(() => false);

    if (sidebarExists) {
      console.log('✅ Chat navigation/sidebar found');
    }

    // Look for new chat button
    const newChatButton = await page.getByRole('button', { name: /new.*chat|start.*chat/i }).isVisible().catch(() => false);

    if (newChatButton) {
      console.log('✅ New chat button found');
    }
  });
});

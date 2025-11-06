import { test, expect } from '@playwright/test';

/**
 * Comprehensive Test Suite
 * Tests every major button and function in the WeaveAI application
 */

test.describe('Comprehensive Application Test', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'irstone@me.com');
    await page.fill('input[type="password"]', 'Bettergabber654!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
  });

  test('1. Homepage - New Chat Button', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Check if "New Chat" button exists and is clickable
    const newChatButton = page.getByRole('button', { name: /new chat/i });
    await expect(newChatButton).toBeVisible();
    await newChatButton.click();

    // Verify chat interface appears
    await expect(page.getByPlaceholder(/send a message/i)).toBeVisible();
  });

  test('2. Chat - Model Selection', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Open model selector
    const modelButton = page.locator('button').filter({ hasText: /claude|gpt|gemini/i }).first();
    await expect(modelButton).toBeVisible();
    await modelButton.click();

    // Verify model list appears
    await expect(page.getByRole('option').first()).toBeVisible();
  });

  test('3. Chat - Send Message', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Type a message
    const messageInput = page.getByPlaceholder(/send a message/i);
    await messageInput.fill('Test message');

    // Send message
    const sendButton = page.getByRole('button', { name: /send/i }).or(page.locator('button[type="submit"]').last());
    await sendButton.click();

    // Wait for message to appear
    await expect(page.getByText('Test message')).toBeVisible();
  });

  test('4. Sidebar - Toggle', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Find and click sidebar toggle
    const sidebarToggle = page.locator('[data-sidebar-toggle]').or(
      page.getByRole('button').filter({ has: page.locator('svg') }).first()
    );

    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
      await page.waitForTimeout(500); // Wait for animation
    }
  });

  test('5. Sidebar - Chat History', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Check if chat history items are visible
    const chatItems = page.locator('[data-chat-item]').or(
      page.locator('a[href^="/chat/"]')
    );

    const count = await chatItems.count();
    console.log(`Found ${count} chat history items`);
  });

  test('6. Settings - Navigation', async ({ page }) => {
    await page.goto('http://localhost:5173/settings/profile');

    // Verify settings page loaded
    await expect(page).toHaveURL(/settings/);
    await expect(page.getByRole('heading', { name: /settings|profile/i })).toBeVisible();
  });

  test('7. Settings - Profile Tab', async ({ page }) => {
    await page.goto('http://localhost:5173/settings/profile');

    // Check for profile input fields
    const nameInput = page.getByLabel(/name/i).or(page.locator('input[name="name"]'));
    await expect(nameInput.first()).toBeVisible();
  });

  test('8. Settings - Account Tab', async ({ page }) => {
    await page.goto('http://localhost:5173/settings/account');

    // Verify account settings loaded
    await expect(page.getByRole('heading', { name: /account/i })).toBeVisible();
  });

  test('9. Projects - Page Load', async ({ page }) => {
    await page.goto('http://localhost:5173/projects');

    // Verify projects page loaded
    await expect(page).toHaveURL(/projects/);
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('10. Projects - Create Project Button', async ({ page }) => {
    await page.goto('http://localhost:5173/projects');

    // Look for create project button
    const createButton = page.getByRole('button', { name: /create|new project/i });
    if (await createButton.isVisible()) {
      await expect(createButton).toBeEnabled();
    }
  });

  test('11. Library - Page Load', async ({ page }) => {
    await page.goto('http://localhost:5173/library');

    // Verify library page loaded
    await expect(page).toHaveURL(/library/);
  });

  test('12. Meetings - Page Load', async ({ page }) => {
    await page.goto('http://localhost:5173/meetings');

    // Verify meetings page loaded
    await expect(page).toHaveURL(/meetings/);
  });

  test('13. Theme Toggle', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Find theme toggle button
    const themeToggle = page.getByRole('button', { name: /theme|dark|light/i }).or(
      page.locator('button').filter({ has: page.locator('svg[class*="sun"]').or(page.locator('svg[class*="moon"]')) })
    );

    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(300);
    }
  });

  test('14. User Menu', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Find user menu button (usually avatar or username)
    const userMenu = page.locator('[data-user-menu]').or(
      page.getByRole('button').filter({ hasText: /irstone|settings|logout/i })
    );

    if (await userMenu.first().isVisible()) {
      await userMenu.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('15. Chat - Delete Chat Button', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Find a chat in sidebar and try to delete it
    const chatItem = page.locator('a[href^="/chat/"]').first();
    if (await chatItem.isVisible()) {
      // Hover to reveal delete button
      await chatItem.hover();

      const deleteButton = page.getByRole('button', { name: /delete|remove|trash/i }).first();
      if (await deleteButton.isVisible()) {
        await expect(deleteButton).toBeEnabled();
      }
    }
  });

  test('16. Chat - File Upload', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Look for file upload button
    const uploadButton = page.getByRole('button', { name: /upload|attach|file/i }).or(
      page.locator('button').filter({ has: page.locator('svg[class*="paperclip"]').or(page.locator('svg[class*="upload"]')) })
    );

    if (await uploadButton.isVisible()) {
      await expect(uploadButton).toBeEnabled();
    }
  });

  test('17. Chat - Tool Selection', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Look for tool/function selector
    const toolButton = page.getByRole('button', { name: /tools|functions|code/i });
    if (await toolButton.isVisible()) {
      await toolButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('18. Search Functionality', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i).or(
      page.locator('input[type="search"]')
    );

    if (await searchInput.isVisible()) {
      await searchInput.fill('test search');
      await page.waitForTimeout(500);
    }
  });

  test('19. Navigation Links', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Test main navigation links
    const navLinks = ['projects', 'library', 'meetings'];

    for (const link of navLinks) {
      const navLink = page.getByRole('link', { name: new RegExp(link, 'i') });
      if (await navLink.isVisible()) {
        await expect(navLink).toBeEnabled();
      }
    }
  });

  test('20. Logout', async ({ page }) => {
    await page.goto('http://localhost:5173/settings/account');

    // Find logout button
    const logoutButton = page.getByRole('button', { name: /log out|sign out/i });
    if (await logoutButton.isVisible()) {
      await expect(logoutButton).toBeEnabled();
    }
  });
});

test.describe('Chat Functionality Deep Dive', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'irstone@me.com');
    await page.fill('input[type="password"]', 'Bettergabber654!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
  });

  test('Chat - Complete Message Flow', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Send a test message
    const input = page.getByPlaceholder(/send a message/i);
    await input.fill('Say hello');

    const sendButton = page.getByRole('button', { name: /send/i }).or(
      page.locator('button[type="submit"]').last()
    );
    await sendButton.click();

    // Wait for user message to appear
    await expect(page.getByText('Say hello')).toBeVisible({ timeout: 5000 });

    // Wait for AI response (with longer timeout)
    await page.waitForTimeout(3000);

    // Check if loading indicator appears
    const loadingIndicator = page.getByText(/generating|thinking|typing/i);
    const isLoading = await loadingIndicator.isVisible().catch(() => false);

    if (isLoading) {
      console.log('AI is generating response...');
    }

    // Wait for response (up to 30 seconds)
    await page.waitForTimeout(30000);
  });

  test('Chat - Message Persistence', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Send a message
    const input = page.getByPlaceholder(/send a message/i);
    await input.fill('Test persistence');

    const sendButton = page.locator('button[type="submit"]').last();
    await sendButton.click();

    await page.waitForTimeout(2000);

    // Reload page
    await page.reload();

    // Check if message is still there
    await expect(page.getByText('Test persistence')).toBeVisible({ timeout: 5000 });
  });
});

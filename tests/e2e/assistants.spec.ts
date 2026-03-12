import { test, expect } from '@playwright/test';

const ADMIN_USERNAME = process.env.E2E_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.E2E_PASSWORD || '';

test.describe('Assistants Page', () => {
  test.beforeEach(async ({ page }) => {
    // Go to login page
    await page.goto('/');

    // Wait for login page to load
    await page.waitForSelector('.login-page', { timeout: 30000 });

    // Fill in login form
    await page.fill('#username', ADMIN_USERNAME);
    await page.fill('#password', ADMIN_PASSWORD);

    // Submit login
    await page.click('button[type="submit"]');

    // Wait for navigation after login (to guid page)
    await page.waitForURL(/\/(guid|conversation)/, { timeout: 30000 });

    // Wait for the app to fully load
    await page.waitForLoadState('networkidle');

    // Additional wait for sidebar to be ready
    await page.waitForSelector('.sider-footer', { timeout: 10000 });
  });

  test('should navigate to Settings > Assistants and display correctly', async ({ page }) => {
    // Click on the settings button in the sidebar footer
    // The button has text "Settings" or "设置"
    const settingsButton = page
      .locator('.sider-footer')
      .getByRole('listitem')
      .filter({
        hasText: /settings|设置/i,
      })
      .or(
        page
          .locator('.sider-footer')
          .locator('div')
          .filter({ hasText: /settings|设置/i })
          .last()
      );

    // Alternative: try to find by clicking the last item in sider-footer which is the settings button
    const footerItems = page.locator('.sider-footer > div > div');
    const settingsBtn = footerItems.last();

    await settingsBtn.click();

    // Wait for navigation to settings page
    await page.waitForURL(/#\/settings\//, { timeout: 15000 });

    // Wait for settings sider to be visible
    await page.waitForSelector('.settings-sider', { timeout: 15000 });

    // Click on Assistants menu item
    const assistantsMenuItem = page
      .locator('.settings-sider__item')
      .filter({
        hasText: /Assistants|助手|agent/i,
      })
      .first();

    await assistantsMenuItem.click();

    // Wait for navigation to agent settings
    await page.waitForURL(/#\/settings\/agent/, { timeout: 10000 });

    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/assistants-page.png', fullPage: true });

    // Check that the page content is visible
    const settingsPageWrapper = page.locator('.settings-page-wrapper');
    await expect(settingsPageWrapper).toBeVisible({ timeout: 10000 });
  });

  test('should show Assistants menu item in settings sider', async ({ page }) => {
    // Click on the settings button in the sidebar footer
    const footerItems = page.locator('.sider-footer > div > div');
    const settingsBtn = footerItems.last();
    await settingsBtn.click();

    // Wait for navigation to settings page
    await page.waitForURL(/#\/settings\//, { timeout: 15000 });

    // Wait for settings sider to be visible
    await page.waitForSelector('.settings-sider', { timeout: 15000 });

    // Find the Assistants menu item
    const siderItems = page.locator('.settings-sider__item');
    const itemCount = await siderItems.count();
    expect(itemCount).toBeGreaterThan(0);

    // Find the Assistants menu item by looking for Robot icon or text
    const assistantsMenuItem = page.locator('.settings-sider__item').filter({
      hasText: /Assistants|助手|agent/i,
    });

    // Check if the item exists and is visible
    await expect(assistantsMenuItem.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display assistant management content on Assistants page', async ({ page }) => {
    // Click on the settings button in the sidebar footer
    const footerItems = page.locator('.sider-footer > div > div');
    const settingsBtn = footerItems.last();
    await settingsBtn.click();

    // Wait for navigation to settings page
    await page.waitForURL(/#\/settings\//, { timeout: 15000 });

    // Wait for settings sider to be visible
    await page.waitForSelector('.settings-sider', { timeout: 15000 });

    // Click on Assistants menu item
    const assistantsMenuItem = page
      .locator('.settings-sider__item')
      .filter({
        hasText: /Assistants|助手|agent/i,
      })
      .first();

    await assistantsMenuItem.click();

    // Wait for navigation to agent settings
    await page.waitForURL(/#\/settings\/agent/, { timeout: 10000 });

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: 'test-results/assistants-content.png', fullPage: true });

    // Check for page content - the assistant management page should have content
    const pageContent = page.locator('.settings-page-wrapper');
    await expect(pageContent).toBeVisible({ timeout: 10000 });

    // Check that page doesn't show any error messages
    const errorMessages = page.locator('.arco-message-error, .arco-notification-error');
    const errorCount = await errorMessages.count();
    expect(errorCount).toBe(0);
  });
});

import { test, expect } from '@playwright/test';

test.describe('Discover Cache Indicator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover');
    // Login if needed
  });

  test('should show cache indicator after running query', async ({ page }) => {
    // Select database and table
    await page.selectOption('[aria-label="Select database"]', 'default');
    await page.selectOption('[aria-label="Select table"]', 'system.query_log');

    // Run query
    await page.fill('input[placeholder*="Filter"]', 'type = \'QueryFinish\'');
    await page.click('button:has-text("Search")');

    // Wait for results
    await page.waitForSelector('[data-slot="table-row"]');

    // Check cache indicator appears
    await expect(page.locator('text=Cached')).toBeVisible();
  });

  test('should show cache stats on hover', async ({ page }) => {
    // Setup query
    await page.selectOption('[aria-label="Select database"]', 'default');
    await page.selectOption('[aria-label="Select table"]', 'system.query_log');
    await page.fill('input[placeholder*="Filter"]', 'type = \'QueryFinish\'');
    await page.click('button:has-text("Search")');
    await page.waitForSelector('[data-slot="table-row"]');

    // Hover over cache indicator
    await page.locator('text=Cached').hover();

    // Check tooltip appears
    await expect(page.locator('text=Cache Status')).toBeVisible();
    await expect(page.locator('text=Hit Rate')).toBeVisible();
  });
});
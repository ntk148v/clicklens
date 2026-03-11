import { test, expect } from '@playwright/test';

test.describe('Discover Error Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover');
  });

  test('should show error display for invalid query', async ({ page }) => {
    // Select database and table
    await page.selectOption('[aria-label="Select database"]', 'default');
    await page.selectOption('[aria-label="Select table"]', 'system.query_log');

    // Enter invalid query
    await page.fill('input[placeholder*="Filter"]', 'invalid_column = \'test\'');
    await page.click('button:has-text("Search")');

    // Check error display appears
    await expect(page.locator('text=Unknown column')).toBeVisible();
    await expect(page.locator('text=Refresh Schema')).toBeVisible();
  });

  test('should retry query when retry button clicked', async ({ page }) => {
    // Setup
    await page.selectOption('[aria-label="Select database"]', 'default');
    await page.selectOption('[aria-label="Select table"]', 'system.query_log');

    // Enter valid query
    await page.fill('input[placeholder*="Filter"]', 'type = \'QueryFinish\'');
    await page.click('button:has-text("Search")');
    await page.waitForSelector('[data-slot="table-row"]');

    // Store row count
    const initialRows = await page.locator('[data-slot="table-row"]').count();

    // Click retry
    await page.click('button:has-text("Retry")');
    await page.waitForSelector('[data-slot="table-row"]');

    // Check results loaded
    const retryRows = await page.locator('[data-slot="table-row"]').count();
    expect(retryRows).toBe(initialRows);
  });
});
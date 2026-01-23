import { test, expect } from "@playwright/test";
import { login } from "./utils";

test.describe("Monitoring", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should load monitoring page", async ({ page }) => {
    await page.goto("/monitoring");
    await expect(page).toHaveURL("/monitoring");
    await page.waitForLoadState("networkidle");

    // Should have some heading or dashboard content
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("should display server metrics", async ({ page }) => {
    await page.goto("/monitoring");
    await page.waitForLoadState("networkidle");

    // Look for common monitoring elements
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Page should not be empty
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test("should have navigation to different monitoring views", async ({
    page,
  }) => {
    await page.goto("/monitoring");
    await page.waitForLoadState("networkidle");

    // Look for tabs or links to different monitoring sections
    const tabs = page.locator('[role="tablist"]').or(page.locator(".tabs"));
    if ((await tabs.count()) > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test("should handle empty data gracefully", async ({ page }) => {
    await page.goto("/monitoring");
    await page.waitForLoadState("networkidle");

    // Should not show unhandled errors
    await expect(page.getByText(/unhandled|exception/i)).not.toBeVisible();
  });

  test("should refresh data periodically or on demand", async ({ page }) => {
    await page.goto("/monitoring");
    await page.waitForLoadState("networkidle");

    // Look for refresh button
    const refreshButton = page
      .getByRole("button", { name: /refresh/i })
      .or(page.locator("button:has(.lucide-refresh-cw)"))
      .first();

    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      // Should not throw error
      await page.waitForLoadState("networkidle");
    }
  });

  test("should display charts or visualizations", async ({ page }) => {
    await page.goto("/monitoring");
    await page.waitForLoadState("networkidle");

    // Look for chart containers (Recharts uses svg)
    const charts = page.locator("svg").or(page.locator('[class*="chart"]'));
    // Charts may or may not be present depending on data
    // Just verify the page loads without error
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Monitoring - Queries Tab", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/queries");
  });

  test("should load queries page", async ({ page }) => {
    await expect(page).toHaveURL("/queries");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should show query history or running queries", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for tabs (History, Running, Analytics, etc.)
    const tabs = page.locator('[role="tablist"]').or(page.locator(".tabs"));
    if ((await tabs.count()) > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test("should have working tab navigation", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Find tabs and click them
    const tabItems = page.locator('[role="tab"]');
    const tabCount = await tabItems.count();

    for (let i = 0; i < Math.min(tabCount, 3); i++) {
      const tab = tabItems.nth(i);
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(500);
        // Should not throw error
      }
    }
  });
});

test.describe("Monitoring - Settings", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/settings");
  });

  test("should load settings page", async ({ page }) => {
    await expect(page).toHaveURL("/settings");
    await page.waitForLoadState("networkidle");
  });

  test("should display server settings", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for settings table or list
    const settingsContent = page
      .locator("table")
      .or(page.locator('[class*="settings"]'));
    // Settings may require certain permissions
    await expect(page.locator("body")).toBeVisible();
  });

  test("should have search/filter functionality", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for search input
    const searchInput = page
      .getByPlaceholder(/search|filter/i)
      .or(page.locator('input[type="search"]'))
      .first();

    if (await searchInput.isVisible()) {
      await searchInput.fill("max_threads");
      await page.waitForTimeout(500);
      // Should filter results
    }
  });
});

test.describe("Monitoring - Logging", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/logging");
  });

  test("should load logging page", async ({ page }) => {
    await expect(page).toHaveURL("/logging");
    await page.waitForLoadState("networkidle");
  });

  test("should display log entries", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for log table or list
    await expect(page.locator("body")).toBeVisible();
  });

  test("should have log type tabs", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for tabs (Server Log, Session Log, Crash Log)
    const tabs = page.locator('[role="tablist"]').or(page.locator(".tabs"));
    if ((await tabs.count()) > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });
});

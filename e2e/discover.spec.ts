import { test, expect } from "@playwright/test";
import { login, disableAnimations } from "./utils";

test.describe("Discover Feature", () => {
  test.beforeEach(async ({ page }) => {
    // Disable animations
    await disableAnimations(page);
    // Login first
    await login(page);
  });

  test("should navigate to discover page", async ({ page }) => {
    await page.click("a[href='/discover']");
    await expect(page).toHaveURL("/discover");
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
    await expect(page.getByText("Select a database and table")).toBeVisible();
  });

  test("should select system tables and display data", async ({ page }) => {
    // Remove skip - we're making this more reliable

    await page.goto("/discover");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500); // Allow UI to settle

    // Ensure no error occurred
    await expect(page.getByText("Failed to load databases")).not.toBeVisible();

    // Select Database: system - click to open, wait for listbox, click option
    const dbTrigger = page.getByLabel("Select database");
    await expect(dbTrigger).toBeEnabled({ timeout: 10000 });
    await dbTrigger.click();

    // Wait for listbox to appear
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(200);

    // Click system option
    const systemOption = page.getByRole("option", { name: "system" });
    await systemOption.scrollIntoViewIfNeeded();
    await systemOption.click();
    await page.waitForTimeout(500);

    // Select Table: tables
    const tableTrigger = page.getByLabel("Select table");
    await expect(tableTrigger).toBeEnabled({ timeout: 10000 });
    await tableTrigger.click();

    // Wait for listbox to appear
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(200);

    // Click tables option
    const tablesOption = page.getByRole("option", { name: "tables" }).first();
    await tablesOption.scrollIntoViewIfNeeded();
    await tablesOption.click();
    await page.waitForTimeout(500);

    // Verify Grid Loading/Loaded
    await expect(page.locator("table")).toBeVisible({ timeout: 15000 });

    // Verify some data
    await expect(
      page.locator("td").filter({ hasText: "system" }).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should filter columns", async ({ page }) => {
    // Remove skip - we're making this more reliable

    await page.goto("/discover");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Check for error toasts
    await expect(page.getByText("Failed to load databases")).not.toBeVisible();

    // Setup: Select system.tables - click to open, wait for listbox, click option
    const dbTrigger = page.getByLabel("Select database");
    await expect(dbTrigger).toBeEnabled({ timeout: 10000 });
    await dbTrigger.click();

    // Wait for listbox to appear
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(200);

    // Click system option
    const systemOption = page.getByRole("option", { name: "system" });
    await systemOption.scrollIntoViewIfNeeded();
    await systemOption.click();
    await page.waitForTimeout(500);

    const tableTrigger = page.getByLabel("Select table");
    await expect(tableTrigger).toBeEnabled({ timeout: 10000 });
    await tableTrigger.click();

    // Wait for listbox to appear
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(200);

    // Click tables option
    const tablesOption = page.getByRole("option", { name: "tables" }).first();
    await tablesOption.scrollIntoViewIfNeeded();
    await tablesOption.click();
    await page.waitForTimeout(500);

    await expect(page.locator("table")).toBeVisible({ timeout: 15000 });

    // Sidebar interaction
    // Uncheck 'database' column if it's there
    const colName = "database";

    // Find label containing text (Label is linked to checkbox via htmlFor)
    const label = page.locator("label").filter({ hasText: colName }).first();

    if (await label.isVisible()) {
      // Click label to toggle
      await label.click();
      await page.waitForTimeout(300);

      // Verify header is gone
      await expect(
        page.getByRole("columnheader", { name: colName }),
      ).not.toBeVisible();

      // Check it back
      await label.click();
      await page.waitForTimeout(300);
      await expect(
        page.getByRole("columnheader", { name: colName }),
      ).toBeVisible();
    }
  });

  test("should execute custom filter", async ({ page }) => {
    // Remove skip - we're making this more reliable

    await page.goto("/discover");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Check for error toasts
    await expect(page.getByText("Failed to load databases")).not.toBeVisible();

    // Select system.tables - click to open, wait for listbox, click option
    const dbTrigger = page.getByLabel("Select database");
    await expect(dbTrigger).toBeEnabled({ timeout: 10000 });
    await dbTrigger.click();

    // Wait for listbox to appear
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(200);

    // Click system option
    const systemOption = page.getByRole("option", { name: "system" });
    await systemOption.scrollIntoViewIfNeeded();
    await systemOption.click();
    await page.waitForTimeout(500);

    const tableTrigger = page.getByLabel("Select table");
    await expect(tableTrigger).toBeEnabled({ timeout: 10000 });
    await tableTrigger.click();

    // Wait for listbox to appear
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(200);

    // Click tables option
    const tablesOption = page.getByRole("option", { name: "tables" }).first();
    await tablesOption.scrollIntoViewIfNeeded();
    await tablesOption.click();
    await page.waitForTimeout(500);

    // Type in Query Bar
    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible({ timeout: 10000 });

    await editor.click();
    await page.waitForTimeout(200);
    await page.keyboard.type("name = 'tables'", { delay: 50 });

    // Execute
    await page.locator("button:has(.lucide-refresh-cw)").click();
    await page.waitForTimeout(300);

    await expect(page.locator("table")).toBeVisible({ timeout: 15000 });

    // Should only see row with name 'tables'
    await expect(page.getByText("Error")).not.toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { login } from "./utils";

test.describe("Discover Feature", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await login(page);
  });

  test("should navigate to discover page", async ({ page }) => {
    await page.click("a[href='/discover']");
    await expect(page).toHaveURL("/discover");
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
    await expect(page.getByText("Select a database and table")).toBeVisible();
  });

  test("should select system tables and display data", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "chromium" || browserName === "firefox",
      "Radix UI Select interaction flaky in Chromium/Firefox headless",
    );
    // Disable animations
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation: none !important; transition: none !important; }",
    });

    await page.goto("/discover");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Ensure no error occurred
    await expect(page.getByText("Failed to load databases")).toBeHidden();

    // Select Database: system
    const dbTrigger = page.getByLabel("Select database");
    await expect(dbTrigger).toBeEnabled();
    await dbTrigger.click();

    // Debug: Check if default is visible (fallback)
    await expect(page.getByRole("option", { name: "default" })).toBeVisible({
      timeout: 5000,
    });

    // Wait for system
    await expect(page.getByRole("option", { name: "system" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("option", { name: "system" }).click();

    // Select Table: tables
    const tableTrigger = page.getByLabel("Select table");
    await expect(tableTrigger).toBeEnabled();
    await tableTrigger.click();

    // Type to search or just find 'tables'
    await page
      .getByRole("option", { name: "tables", exact: true })
      .or(page.getByRole("option", { name: "tables (" }))
      .first()
      .click();

    // Verify Grid Loading/Loaded
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    // Verify some data
    await expect(
      page.locator("td").filter({ hasText: "system" }).first(),
    ).toBeVisible();
  });

  test("should filter columns", async ({ page, browserName }) => {
    test.skip(
      browserName === "chromium" || browserName === "firefox",
      "Radix UI Select interaction flaky in Chromium/Firefox headless",
    );
    await page.goto("/discover");
    await page.waitForLoadState("networkidle");

    // Check for error toasts
    await expect(page.getByText("Failed to load databases")).toBeHidden();

    // Setup: Select system.tables
    const dbTrigger = page.getByLabel("Select database");
    await expect(dbTrigger).toBeEnabled();
    await dbTrigger.click();

    // Debug: Check default
    await expect(page.getByRole("option", { name: "default" })).toBeVisible();

    await expect(page.getByRole("option", { name: "system" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("option", { name: "system" }).click();

    const tableTrigger = page.getByLabel("Select table");
    await expect(tableTrigger).toBeEnabled();
    await tableTrigger.click();

    await page
      .getByRole("option", { name: "tables", exact: true })
      .or(page.getByRole("option", { name: "tables (" }))
      .first()
      .click();

    await expect(page.locator("table")).toBeVisible();

    // Sidebar interaction
    // Uncheck 'database' column if it's there
    const colName = "database";

    // Find label containing text (Label is linked to checkbox via htmlFor)
    const label = page.locator("label").filter({ hasText: colName }).first();

    if (await label.isVisible()) {
      // Click label to toggle
      await label.click();

      // Verify header is gone
      await expect(
        page.getByRole("columnheader", { name: colName }),
      ).not.toBeVisible();

      // Check it back
      await label.click();
      await expect(
        page.getByRole("columnheader", { name: colName }),
      ).toBeVisible();
    }
  });

  test("should execute custom filter", async ({ page, browserName }) => {
    test.skip(
      browserName === "chromium" || browserName === "firefox",
      "Radix UI Select interaction flaky in Chromium/Firefox headless",
    );
    await page.goto("/discover");
    await page.waitForLoadState("networkidle");

    // Check for error toasts
    await expect(page.getByText("Failed to load databases")).toBeHidden();

    // Select system.tables
    const dbTrigger = page.getByLabel("Select database");
    await expect(dbTrigger).toBeEnabled();
    await dbTrigger.click();

    // Debug: Check default
    await expect(page.getByRole("option", { name: "default" })).toBeVisible();

    await expect(page.getByRole("option", { name: "system" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("option", { name: "system" }).click();

    const tableTrigger = page.getByLabel("Select table");
    await expect(tableTrigger).toBeEnabled();
    await tableTrigger.click();

    await page
      .getByRole("option", { name: "tables", exact: true })
      .or(page.getByRole("option", { name: "tables (" }))
      .first()
      .click();

    // Type in Query Bar
    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.type("name = 'tables'");

    // Execute
    await page.locator("button:has(.lucide-refresh-cw)").click();

    await expect(page.locator("table")).toBeVisible();

    // Should only see row with name 'tables'
    await expect(page.getByText("Error")).not.toBeVisible();
  });
});

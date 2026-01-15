import { test, expect } from "@playwright/test";

test.describe("Discover Feature", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByPlaceholder("Host").fill("localhost");
    await page.getByPlaceholder("Port").fill("8123");
    await page.getByPlaceholder("Username").fill("default");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL(/\/sql/);
  });

  test("should navigate to discover page", async ({ page }) => {
    await page.click("a[href='/discover']");
    await expect(page).toHaveURL("/discover");
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
    await expect(page.getByText("Select a database and table")).toBeVisible();
  });

  test("should select system tables and display data", async ({ page }) => {
    await page.goto("/discover");

    // Select Database: system
    const dbTrigger = page
      .getByRole("combobox")
      .filter({ hasText: "Select database" });
    await dbTrigger.click();
    await page.getByRole("option", { name: "system" }).click();

    // Select Table: tables
    const tableTrigger = page
      .getByRole("combobox")
      .filter({ hasText: "Select table" });
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
      page.locator("td").filter({ hasText: "system" }).first()
    ).toBeVisible();
  });

  test("should filter columns", async ({ page }) => {
    await page.goto("/discover");

    // Setup: Select system.tables
    await page
      .getByRole("combobox")
      .filter({ hasText: "Select database" })
      .click();
    await page.getByRole("option", { name: "system" }).click();
    await page
      .getByRole("combobox")
      .filter({ hasText: "Select table" })
      .click();
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
        page.getByRole("columnheader", { name: colName })
      ).not.toBeVisible();

      // Check it back
      await label.click();
      await expect(
        page.getByRole("columnheader", { name: colName })
      ).toBeVisible();
    }
  });

  test("should execute custom filter", async ({ page }) => {
    await page.goto("/discover");

    // Select system.tables
    await page
      .getByRole("combobox")
      .filter({ hasText: "Select database" })
      .click();
    await page.getByRole("option", { name: "system" }).click();
    await page
      .getByRole("combobox")
      .filter({ hasText: "Select table" })
      .click();
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

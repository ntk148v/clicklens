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
  });

  test("should display histogram and grid", async ({ page }) => {
    await page.goto("/discover");

    // Check Histogram container
    const histogram = page.locator(".recharts-responsive-container");
    await expect(histogram).toBeVisible();

    // Check Grid
    const grid = page.locator("table");
    await expect(grid).toBeVisible();
  });

  test("should toggle fields in grid", async ({ page }) => {
    await page.goto("/discover");

    // Check initial columns (source_file is hidden by default in our code)
    // Actually source_file default visibility was false in the component

    // Enable source_file
    const checkbox = page.locator("label:has-text('Source File')");
    await checkbox.click();

    // Verify column header appears
    const header = page.getByRole("columnheader", { name: "Source" });
    await expect(header).toBeVisible();
  });

  test("should search and update results", async ({ page }) => {
    await page.goto("/discover");

    const searchInput = page.getByPlaceholder("Search logs...");
    await searchInput.fill("system");

    // Wait for debounce and network
    await page.waitForResponse((resp) => resp.url().includes("search=system"));

    // Minimal check that table is still there (data usage depends on actual DB content)
    await expect(page.locator("table")).toBeVisible();
  });
});

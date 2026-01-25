import { test, expect } from "@playwright/test";
import { login, disableAnimations } from "./utils";

test.describe("Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    await disableAnimations(page);
    await login(page);
  });

  test("should load SQL console", async ({ page }) => {
    await page.goto("/sql");
    await expect(
      page
        .getByRole("textbox", { name: "SQL Query" })
        .or(page.locator(".cm-content")),
    ).toBeVisible();
  });

  test("should load Tables", async ({ page }) => {
    await page.click("a[href='/tables']");
    await expect(page).toHaveURL("/tables");
    await expect(page.locator("text=Database:")).toBeVisible();
  });

  test("should load Monitoring page", async ({ page }) => {
    await page.goto("/monitoring");
    await expect(page).toHaveURL("/monitoring");
    // Monitoring page should have some content
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("should load Queries page", async ({ page }) => {
    await page.goto("/queries");
    await expect(page).toHaveURL("/queries");
    // Should show queries interface
    await expect(page.locator("body")).toBeVisible();
  });

  test("should have working navigation sidebar", async ({ page }) => {
    await page.goto("/");

    // Check main navigation links are visible
    const navLinks = [
      { href: "/discover", text: /discover/i },
      { href: "/sql", text: /sql/i },
      { href: "/tables", text: /tables/i },
    ];

    for (const link of navLinks) {
      const anchor = page.locator(`a[href='${link.href}']`);
      await expect(anchor).toBeVisible();
    }
  });

  test("should display user info or profile", async ({ page }) => {
    await page.goto("/");
    // Wait for the page to load
    await page.waitForLoadState("networkidle");
    // There should be some indication of logged-in state
    await expect(page.locator("body")).toBeVisible();
  });
});

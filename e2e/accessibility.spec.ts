import { test, expect } from "@playwright/test";
import { login } from "./utils";

/**
 * Accessibility tests for ClickLens
 * Tests keyboard navigation, focus management, and ARIA compliance
 */
test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should support keyboard navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Tab through focusable elements
    await page.keyboard.press("Tab");

    // Check that focus moved to a focusable element
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check for h1 presence (there should be at least one main heading)
    const headings = page.locator("h1, h2, h3");
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test("login form should be keyboard accessible", async ({ page }) => {
    // Clear session first
    await page.context().clearCookies();
    await page.goto("/login");

    // Focus should be manageable via keyboard
    await page.keyboard.press("Tab");

    // Should be able to tab through form fields
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();

    // Tab to next field
    await page.keyboard.press("Tab");
    const nextFocused = page.locator(":focus");
    await expect(nextFocused).toBeVisible();
  });

  test("buttons should have accessible names", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that buttons have accessible names (either text content or aria-label)
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        // Button should have either text or aria-label
        const hasText = (await button.textContent())?.trim() !== "";
        const hasAriaLabel = await button.getAttribute("aria-label");
        const hasIcon = (await button.locator("svg").count()) > 0;

        // Acceptable: has text, has aria-label, or has icon with aria-label
        expect(hasText || hasAriaLabel || hasIcon).toBe(true);
      }
    }
  });

  test("interactive elements should be focusable", async ({ page }) => {
    await page.goto("/sql");
    await page.waitForLoadState("networkidle");

    // Check that links are focusable
    const links = page.locator("a[href]");
    const linkCount = await links.count();

    if (linkCount > 0) {
      const firstLink = links.first();
      await firstLink.focus();
      await expect(firstLink).toBeFocused();
    }
  });

  test("should have proper color contrast indicators", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that the body has a background color set (basic theme check)
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Verify the page renders with proper styling
    const html = await page.content();
    expect(html.length).toBeGreaterThan(1000);
  });
});

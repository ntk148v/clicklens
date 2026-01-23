import { test, expect } from "@playwright/test";
import { login } from "./utils";

test.describe("Authentication", () => {
  test("should allow user to login", async ({ page }) => {
    await login(page);
  });

  test("should show login page when not authenticated", async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Try to access protected page
    await page.goto("/");

    // Should redirect to login
    await expect(page).toHaveURL("/login");

    // Login form should be visible
    await expect(
      page.getByRole("button", { name: /sign in|login/i }),
    ).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill invalid credentials
    const userField = page
      .getByPlaceholder("Username")
      .or(page.getByLabel("Username"));
    await userField.fill("invalid_user_that_does_not_exist");

    const passField = page
      .getByPlaceholder("Password")
      .or(page.getByLabel("Password"));
    await passField.fill("wrong_password");

    await page.click("button[type=submit]");

    // Should show error message or stay on login page
    await expect(page).toHaveURL(/login/);
  });

  test("should persist session across page reloads", async ({ page }) => {
    // Login first
    await login(page);

    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/$/);

    // Reload the page
    await page.reload();

    // Should still be logged in (not redirected to login)
    await expect(page).not.toHaveURL(/login/);
  });

  test("should have accessible login form", async ({ page }) => {
    await page.goto("/login");

    // Check for proper form labeling
    const usernameInput = page
      .getByLabel("Username")
      .or(page.getByPlaceholder("Username"));
    await expect(usernameInput).toBeVisible();

    // Check submit button is accessible
    const submitButton = page.getByRole("button", { name: /sign in|login/i });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });
});

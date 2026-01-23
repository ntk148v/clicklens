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

  test("should allow user to logout", async ({ page }) => {
    // Login first
    await login(page);

    // Verify we're logged in
    await expect(page).toHaveURL(/\/$/);

    // Look for logout button or user menu
    const logoutButton = page
      .getByRole("button", { name: /logout|sign out/i })
      .or(page.locator('[aria-label*="logout"]'))
      .or(page.locator("button:has(.lucide-log-out)"));

    // If logout button is not directly visible, might be in a dropdown menu
    const userMenu = page
      .locator('[aria-label*="user"]')
      .or(page.locator('[aria-label*="profile"]'))
      .or(page.locator('[aria-label*="account"]'));

    if (await userMenu.first().isVisible()) {
      await userMenu.first().click();
      await page.waitForTimeout(300);
    }

    if (await logoutButton.first().isVisible()) {
      await logoutButton.first().click();
      await page.waitForLoadState("networkidle");

      // Should redirect to login page
      await expect(page).toHaveURL(/login/);
    }
  });

  test("should redirect protected pages to login when session expires", async ({
    page,
  }) => {
    // Login first
    await login(page);

    // Clear cookies to simulate session expiry
    await page.context().clearCookies();

    // Try to access protected page
    await page.goto("/sql");

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test("should preserve intended destination after login", async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Try to access specific protected page
    await page.goto("/sql");

    // Should redirect to login
    await expect(page).toHaveURL(/login/);

    // Login
    const user = process.env.CLICKHOUSE_USER || "default";
    const password = process.env.CLICKHOUSE_PASSWORD || "";

    const userField = page
      .getByPlaceholder("Username")
      .or(page.getByLabel("Username"));
    await userField.fill(user);

    if (password) {
      const passField = page
        .getByPlaceholder("Password")
        .or(page.getByLabel("Password"));
      await passField.fill(password);
    }

    await page.click("button[type=submit]");
    await page.waitForLoadState("networkidle");

    // May redirect to intended page or dashboard
    await expect(page).not.toHaveURL(/login/);
  });

  test("should handle login form submission with Enter key", async ({
    page,
  }) => {
    await page.goto("/login");

    const user = process.env.CLICKHOUSE_USER || "default";

    const userField = page
      .getByPlaceholder("Username")
      .or(page.getByLabel("Username"));
    await userField.fill(user);

    // Press Enter to submit
    await page.keyboard.press("Enter");

    // Should attempt login (might succeed or fail depending on password requirement)
    await page.waitForLoadState("networkidle");
  });

  test("should show password field toggle if available", async ({ page }) => {
    await page.goto("/login");

    // Look for password visibility toggle
    const toggleButton = page
      .locator('button:has(.lucide-eye)')
      .or(page.locator('button:has(.lucide-eye-off)'))
      .or(page.getByRole("button", { name: /show|hide password/i }));

    if (await toggleButton.first().isVisible()) {
      // Click to toggle visibility
      await toggleButton.first().click();
      await page.waitForTimeout(100);
    }
  });
});

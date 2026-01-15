import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should allow user to login", async ({ page }) => {
    await page.goto("/login");

    // Assuming default dev environment has default/empty credentials or user knows them
    // For CI we will use a fresh CH which has default user with no password usually
    // But the form might require inputs.

    await page.getByLabel("Username").fill("default");
    // Password empty

    await page.click("button[type=submit]");

    // Should redirect to dashboard or sql
    await expect(page).toHaveURL(/\/sql/);
  });

  // Logout test...
});

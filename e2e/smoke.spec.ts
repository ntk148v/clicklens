import { test, expect } from "@playwright/test";

test.describe("Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Host").fill("localhost");
    await page.getByPlaceholder("Port").fill("8123");
    await page.getByPlaceholder("Username").fill("default");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL(/\/sql/);
  });

  test("should load SQL console", async ({ page }) => {
    await page.goto("/sql");
    await expect(
      page
        .getByRole("textbox", { name: "SQL Query" })
        .or(page.locator(".cm-content"))
    ).toBeVisible();
  });

  test("should load Tables", async ({ page }) => {
    await page.click("a[href='/tables']");
    await expect(page).toHaveURL("/tables");
    await expect(page.locator("text=Databases")).toBeVisible();
  });
});

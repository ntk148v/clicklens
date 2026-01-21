import { test, expect } from "@playwright/test";
import { login } from "./utils";

test.describe("Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
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
});

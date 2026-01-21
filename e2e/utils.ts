import { Page, expect } from "@playwright/test";

export const login = async (page: Page) => {
  await page.goto("/login");

  const user = process.env.CLICKHOUSE_USER || "default";
  const password = process.env.CLICKHOUSE_PASSWORD || "";

  // Try both Placeholder and Label to be safe across versions/changes
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

  // Wait for navigation to complete - dashboard is at /
  await expect(page).toHaveURL(/\/$/);
};

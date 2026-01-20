import { Page, expect } from "@playwright/test";

export const login = async (page: Page) => {
  await page.goto("/login");

  const hostUrl = process.env.CLICKHOUSE_HOST || "http://localhost:8123";
  const url = new URL(hostUrl);
  const host = url.hostname;
  const port = url.port || "8123";
  const user = process.env.CLICKHOUSE_USER || "default";
  const password = process.env.CLICKHOUSE_PASSWORD || "";

  await page.getByPlaceholder("Host").fill(host);
  await page.getByPlaceholder("Port").fill(port);

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

  // Wait for navigation to complete - either dashboard or SQL page
  await expect(page).toHaveURL(/\/(sql|dashboard)/);
};

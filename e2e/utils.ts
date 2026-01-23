import { Page, expect } from "@playwright/test";

/**
 * Login to the application with test credentials
 */
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

/**
 * Wait for page to be fully loaded and interactive
 */
export const waitForPageReady = async (page: Page) => {
  await page.waitForLoadState("networkidle");
  await page.waitForLoadState("domcontentloaded");
};

/**
 * Navigate to a page with login if needed
 */
export const navigateTo = async (page: Page, path: string) => {
  await page.goto(path);

  // If redirected to login, perform login
  if (page.url().includes("/login")) {
    await login(page);
    await page.goto(path);
  }

  await waitForPageReady(page);
};

/**
 * Disable animations for more stable tests
 */
export const disableAnimations = async (page: Page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
};

/**
 * Wait for a toast notification to appear
 */
export const waitForToast = async (
  page: Page,
  textPattern?: RegExp | string
) => {
  const toastLocator = page
    .locator('[role="alert"]')
    .or(page.locator('[data-radix-toast-announce]'))
    .or(page.locator('[class*="toast"]'));

  if (textPattern) {
    await expect(toastLocator.filter({ hasText: textPattern }).first()).toBeVisible({
      timeout: 5000,
    });
  } else {
    await expect(toastLocator.first()).toBeVisible({ timeout: 5000 });
  }
};

/**
 * Check if element is in viewport
 */
export const isInViewport = async (page: Page, selector: string) => {
  const element = page.locator(selector).first();
  const box = await element.boundingBox();
  const viewportSize = page.viewportSize();

  if (!box || !viewportSize) return false;

  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewportSize.width &&
    box.y + box.height <= viewportSize.height
  );
};

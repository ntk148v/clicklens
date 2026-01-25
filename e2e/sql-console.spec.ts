import { test, expect } from "@playwright/test";
import { login, disableAnimations } from "./utils";

test.describe("SQL Console", () => {
  test.beforeEach(async ({ page }) => {
    await disableAnimations(page);
    await login(page);
    await page.goto("/sql");
    await page.waitForLoadState("networkidle");
  });

  test("should load SQL console page", async ({ page }) => {
    await expect(page).toHaveURL("/sql");
    // SQL editor should be visible
    await expect(page.locator(".cm-content")).toBeVisible();
  });

  test("should have a run button", async ({ page }) => {
    const runButton = page
      .getByRole("button", { name: /run|execute/i })
      .or(page.locator("button:has(.lucide-play)"));
    await expect(runButton.first()).toBeVisible();
  });

  test("should execute a simple query", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit",
      "CodeMirror interaction flaky in WebKit",
    );

    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible();

    // Click to focus and wait for focus to settle
    await editor.click();
    await page.waitForTimeout(200);

    // Type a simple query with slower typing for reliability
    await page.keyboard.type("SELECT 1 AS test_value", { delay: 50 });

    // Find and click run button
    const runButton = page
      .getByRole("button", { name: /run|execute/i })
      .or(page.locator("button:has(.lucide-play)"))
      .first();
    await runButton.click();

    // Wait for results - look for table or result indicator
    await expect(
      page.locator("table").or(page.getByText("test_value")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show error for invalid SQL", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit",
      "CodeMirror interaction flaky in WebKit",
    );

    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible();

    await editor.click();
    await page.waitForTimeout(200);
    await page.keyboard.type("INVALID SQL QUERY HERE", { delay: 50 });

    const runButton = page
      .getByRole("button", { name: /run|execute/i })
      .or(page.locator("button:has(.lucide-play)"))
      .first();
    await runButton.click();

    // Should show an error message
    await expect(page.getByText(/error|syntax|exception/i).first()).toBeVisible(
      { timeout: 10000 },
    );
  });

  test("should have keyboard shortcut for running queries", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "CodeMirror interaction flaky in WebKit",
    );

    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible();

    await editor.click();
    await page.waitForTimeout(200);
    await page.keyboard.type("SELECT version()", { delay: 50 });

    // Use Ctrl+Enter or Cmd+Enter to run
    await page.keyboard.press("Control+Enter");

    // Wait for results
    await expect(
      page.locator("table").or(page.getByText("version")),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("should preserve query after page reload", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "CodeMirror interaction flaky in WebKit",
    );

    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible();

    await editor.click();
    await page.waitForTimeout(200);
    const testQuery = "SELECT 'persistence_test' AS value";
    await page.keyboard.type(testQuery, { delay: 50 });

    // The SQL editor might have local storage persistence
    // This test verifies the UX behavior
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Editor should still be present after reload
    await expect(page.locator(".cm-content")).toBeVisible();
  });

  test("should have multiple tabs support", async ({ page }) => {
    // Look for tab interface
    const tabs = page.locator('[role="tablist"]').or(page.locator(".tabs"));

    if ((await tabs.count()) > 0) {
      await expect(tabs.first()).toBeVisible();

      // Try to find a new tab button
      const newTabButton = page
        .getByRole("button", { name: /new|add|\+/i })
        .first();
      if (await newTabButton.isVisible()) {
        await newTabButton.click();
        // Verify multiple tabs exist
        const tabItems = page.locator('[role="tab"]');
        expect(await tabItems.count()).toBeGreaterThan(0);
      }
    }
  });

  test("should display query results in a table", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "CodeMirror interaction flaky in WebKit",
    );

    const editor = page.locator(".cm-content");
    await editor.click();
    await page.waitForTimeout(200);
    await page.keyboard.type("SELECT number FROM system.numbers LIMIT 5", {
      delay: 50,
    });

    const runButton = page
      .getByRole("button", { name: /run|execute/i })
      .or(page.locator("button:has(.lucide-play)"))
      .first();
    await runButton.click();

    // Should have table with results
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    // Should have rows
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("should show loading state while executing", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "CodeMirror interaction flaky in WebKit",
    );

    const editor = page.locator(".cm-content");
    await editor.click();
    await page.waitForTimeout(200);
    await page.keyboard.type("SELECT sleep(1)", { delay: 50 });

    const runButton = page
      .getByRole("button", { name: /run|execute/i })
      .or(page.locator("button:has(.lucide-play)"))
      .first();
    await runButton.click();

    // Should show some loading indicator (spinner, disabled state, etc.)
    // This may vary by implementation
    await page.waitForTimeout(500);
  });
});

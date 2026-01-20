import { login } from "./utils";

test.describe("Authentication", () => {
  test("should allow user to login", async ({ page }) => {
    await login(page);
  });

  // Logout test...
});

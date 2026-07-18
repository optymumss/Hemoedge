import { test, expect } from "@playwright/test";

for (const surface of ["/admin", "/org", "/app"]) {
  test(`${surface} redirects an unauthenticated visitor to /login`, async ({ page }) => {
    await page.goto(surface);
    await expect(page).toHaveURL(
      new RegExp(`/login\\?redirect=${encodeURIComponent(surface)}`),
    );
  });
}

test("login page renders the sign-in form", async ({ page }) => {
  await page.goto("/login");
  // The page also has a collapsed signup form with its own email/password
  // fields, so scope to the first (login) form specifically.
  const loginForm = page.locator("form").first();
  await expect(loginForm.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(loginForm.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(loginForm.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("login with bad credentials shows an error, not a crash", async ({ page }) => {
  await page.goto("/login");
  const loginForm = page.locator("form").first();
  await loginForm.getByLabel("Email", { exact: true }).fill("nobody@example.com");
  await loginForm.getByLabel("Password", { exact: true }).fill("definitely-wrong-password");
  await loginForm.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 15_000 });
});

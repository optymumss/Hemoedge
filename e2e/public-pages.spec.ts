import { test, expect } from "@playwright/test";

test("homepage renders the hero and sign-in link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "HemoEdge" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
});

test("public nav reaches blog, team, and contact", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Blog" }).click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Team" }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Contact" }).click();
  await expect(page).toHaveURL(/\/contact$/);
});

test("contact page renders a real contact form", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Message")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
});

test("unknown slug 404s", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
});

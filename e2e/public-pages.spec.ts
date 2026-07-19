import { test, expect } from "@playwright/test";

test("homepage renders the hero and sign-in link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "HemoEdge" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
});

test("public nav reaches blog, team, and contact", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Primary" });

  await page.goto("/");
  await nav.getByRole("link", { name: "Blog" }).click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.getByRole("heading", { name: "Notes from the lab" })).toBeVisible();

  await page.goto("/");
  await nav.getByRole("link", { name: "Team" }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole("heading", { name: "The people behind HemoEdge" })).toBeVisible();

  await page.goto("/");
  await nav.getByRole("link", { name: "Contact" }).click();
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

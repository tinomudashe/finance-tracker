import { expect, test } from "@playwright/test";

test("Demo login → Dashboard KPIs → Add Transaction → Verify Budgets", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore Demo Workspace/i }).click();

  await expect(page.getByText("Welcome back, Daniel")).toBeVisible();
  await expect(page.getByText("Net Worth")).toBeVisible();

  await page.getByRole("button", { name: /Add Transaction/i }).click();
  await page.getByPlaceholder("0.00").fill("42.50");
  await page.getByPlaceholder(/Weekly groceries/i).fill("FreshMart E2E test");
  await page.getByRole("button", { name: /Save transaction/i }).click();

  await page.getByRole("button", { name: "Budgets" }).click();
  await expect(page.getByText("Over budget")).toBeVisible();
});

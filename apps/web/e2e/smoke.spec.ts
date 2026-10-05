import { expect, test } from "@playwright/test";

test("first visit routes to onboarding and lists all 7 countries", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/onboarding/);
  for (const c of ["Philippines", "Nigeria", "United Kingdom", "Ghana", "Singapore", "Australia", "Egypt"]) {
    await expect(page.getByRole("radio", { name: new RegExp(c) })).toBeVisible();
  }
  // wave 3 is visible but disabled
  await expect(page.getByRole("radio", { name: /Australia/ })).toBeDisabled();
  await expect(page.getByRole("radio", { name: /Egypt/ })).toBeDisabled();
});

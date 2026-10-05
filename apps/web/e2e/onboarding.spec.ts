import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("new user picks Nigeria and lands on an empty dashboard", async ({ page }) => {
  await onboard(page, "Nigeria");
  await expect(page.getByText("Nigeria · Chief Mate CoC")).toBeVisible();
  await expect(page.getByTestId("readiness-score")).toHaveText("0%");
  await expect(page.getByText("Not started yet").first()).toBeVisible();
  // profile persisted: reload keeps us on the dashboard
  await page.reload();
  await expect(page.getByTestId("readiness-score")).toBeVisible();
});

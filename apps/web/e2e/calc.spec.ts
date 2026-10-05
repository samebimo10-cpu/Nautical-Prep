import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("practise 5 randomised free-surface questions with worked solutions", async ({ page }) => {
  await onboard(page, "Philippines");
  await page.goto("/calc/stab-calc-free-surface");
  const stems = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const stem = await page.getByTestId("calc-stem").innerText();
    stems.add(stem);
    await page.getByTestId("calc-step").click(); // reveal one step
    await expect(page.getByTestId("calc-step-text")).toHaveCount(1);
    await page.getByTestId("calc-input").fill("0.5");
    await page.getByTestId("calc-check").click();
    await expect(page.getByTestId("calc-result")).toBeVisible();
    await expect(page.getByTestId("calc-step-text")).toHaveCount(4); // full worked solution shown
    await page.getByTestId("calc-next").click();
  }
  expect(stems.size).toBeGreaterThanOrEqual(4);
});

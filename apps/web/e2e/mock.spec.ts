import { expect, test } from "@playwright/test";
import { onboard, waitForServiceWorker } from "./helpers";

test("a full mock exam can be completed offline and is graded by competence", async ({ page, context }) => {
  await onboard(page, "Nigeria");
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.goto("/mock");
  await expect(page.getByText("Official format not yet confirmed.")).toBeVisible();
  await page.getByTestId("start-mock").click();
  await expect(page.getByTestId("timer")).toContainText("1:59");
  // answer every MCQ correctly; leave calcs blank; flag one
  for (let i = 0; i < 50; i++) {
    const correct = page.locator('[data-testid^="mock-option-"][data-correct="true"]');
    if (await correct.count()) await correct.click();
    if (i === 3) await page.getByTestId("flag").click();
    if (i < 49) await page.getByTestId("mock-next").click();
  }
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("mock-submit").click();
  await expect(page.getByTestId("mock-verdict")).toBeVisible();
  const pct = Number((await page.getByTestId("mock-percent").innerText()).replace("%", ""));
  expect(pct).toBeGreaterThan(70);
  await expect(page.getByText("By competence")).toBeVisible();
  // mock persisted
  await page.goto("/mock");
  await expect(page.getByText("History")).toBeVisible();
});

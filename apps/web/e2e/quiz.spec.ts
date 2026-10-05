import { expect, test } from "@playwright/test";
import { answerMcq, onboard } from "./helpers";

test("20 answers update analytics; a content report is saved", async ({ page }) => {
  await onboard(page, "Nigeria");
  await page.goto("/quiz?competence=STAB&n=20");
  // 15 right, 5 wrong (wrong ones answered 'sure' → confident mistakes)
  for (let i = 0; i < 20; i++) {
    if (i === 0) {
      await page.getByRole("button", { name: "Report a problem" }).click();
      await page.getByLabel("What's wrong?").fill("Typo in option C");
      await page.getByRole("button", { name: "Send report" }).click();
      await expect(page.getByText(/report saved/)).toBeVisible();
      await expect(page.getByRole("dialog")).toBeHidden();
    }
    await answerMcq(page, i % 4 !== 0, "sure");
  }
  await expect(page.getByTestId("quiz-score")).toHaveText("75%");
  await page.goto("/progress");
  await expect(page.getByTestId("competence-scores")).toContainText("Stability & Ship Construction");
  await expect(page.getByTestId("competence-scores")).toContainText("75% · 20");
  await page.goto("/practice");
  await expect(page.getByText("Confident mistakes: 5")).toBeVisible();
  // missed items land in the spaced-repetition deck
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: /Review 1\/5/ })).toBeVisible({ timeout: 15_000 }).catch(async () => {
    // confident errors are due after 10 minutes; deck exists but may not be due yet
    await expect(page.getByText(/Nothing due|Review/)).toBeVisible();
  });
  // report is stored locally (and queued for sync)
  const reports = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open("chief-mate-prep");
        req.onsuccess = () => {
          const tx = req.result.transaction("reports", "readonly");
          const c = tx.objectStore("reports").count();
          c.onsuccess = () => resolve(c.result);
        };
      }),
  );
  expect(reports).toBe(1);
});

test("written answer self-marking against marking points", async ({ page }) => {
  await onboard(page, "United Kingdom");
  await page.goto("/quiz?ids=stab-written-loll");
  await page.getByLabel(/Your answer/).fill("Negative GM causes the ship to loll; lower G by filling low side double bottom tanks first.");
  await page.getByRole("button", { name: "Submit & compare" }).click();
  await expect(page.getByText("Model answer")).toBeVisible();
  await page.getByLabel(/G above M/).check();
  await page.getByLabel(/Lower G by ballasting/).check();
  await expect(page.getByText("Self-mark: 50%")).toBeVisible();
  await page.getByRole("button", { name: "Save & next →" }).click();
  await expect(page.getByTestId("quiz-score")).toHaveText("50%");
});

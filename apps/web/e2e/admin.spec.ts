import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("reviewer approves a draft item and the decision is recorded for export", async ({ page }) => {
  await onboard(page, "United Kingdom");
  await page.goto("/profile");
  await page.getByLabel(/Reviewer mode/).check();
  await page.goto("/admin");
  const banner = page.getByText(/draft items awaiting review/);
  const before = Number((await banner.innerText()).match(/(\d+) draft/)![1]);
  await page.getByLabel("Reviewer").fill("Capt. Test (Master Mariner)");
  await page.getByTestId("approve").click();
  await expect(page.getByText(`${before - 1} draft items awaiting review · 1 decisions made`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Export 1 decision(s)" })).toBeEnabled();
});

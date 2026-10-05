import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("sea-time tracker totals and eligibility shows 'not confirmed'", async ({ page }) => {
  await onboard(page, "Nigeria");
  await page.goto("/tracker");
  await expect(page.getByText(/not confirmed yet/)).toBeVisible();
  await page.getByText("Add a voyage").click();
  await page.getByLabel("Vessel name").fill("MV Lagos Star");
  await page.getByTestId("sea-from").fill("2025-01-01");
  await page.getByTestId("sea-to").fill("2025-03-31");
  await page.getByTestId("sea-add").click();
  await expect(page.getByTestId("sea-total")).toHaveText("90 days");
  await page.getByLabel("Vessel name").fill("MV Overlap");
  await page.getByTestId("sea-from").fill("2025-03-01");
  await page.getByTestId("sea-to").fill("2025-04-30");
  await page.getByTestId("sea-add").click();
  await expect(page.getByTestId("sea-total")).toHaveText("120 days"); // overlap not double counted
});

test("regulation update flags linked items for revision", async ({ page }) => {
  await onboard(page, "Nigeria");
  await page.goto("/profile");
  await page.getByLabel(/Reviewer mode/).check();
  await page.goto("/admin");
  await page.getByRole("tab", { name: "updates" }).click();
  await page.getByLabel("Title").fill("MARPOL Annex VI amendment");
  await page.getByLabel("Body").fill("Sulphur rules updated");
  await page.getByLabel("Item IDs").fill("law-marpol-004");
  await page.getByTestId("post-update").click();
  await page.goto("/");
  await expect(page.getByText("1 regulation update(s)")).toBeVisible();
  await page.goto("/updates");
  await page.getByRole("link", { name: /Revise the 1 affected/ }).click();
  await expect(page.getByTestId("stem")).toContainText("sulphur");
});

import { expect, test } from "@playwright/test";
import { answerMcq, onboard, waitForServiceWorker } from "./helpers";

test("app opens and runs offline; offline attempts sync when back online", async ({ page, context }) => {
  const received: unknown[] = [];
  await context.route("**/dev-sync", async (route) => {
    received.push(...(JSON.parse(route.request().postData() ?? "[]") as unknown[]));
    await route.fulfill({ status: 200, body: "ok" });
  });
  await onboard(page, "United Kingdom");
  await waitForServiceWorker(page);
  // let the onboarding events flush, then enable the dev sync backend
  await page.evaluate(() => localStorage.setItem("cm.devSyncUrl", "/dev-sync"));

  await context.setOffline(true);
  await page.reload(); // served by the service worker
  await expect(page.getByTestId("net-status")).toHaveText("Offline");
  await expect(page.getByTestId("readiness-score")).toBeVisible();

  await page.goto("/quiz?mode=mixed&n=3");
  for (let i = 0; i < 3; i++) await answerMcq(page, i !== 1);
  await expect(page.getByTestId("quiz-score")).toHaveText("67%");
  const before = received.length;

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => received.filter((r) => (r as { kind: string }).kind === "attempt").length, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
  expect(received.length).toBeGreaterThan(before);
});

test("offline: lessons, calculations and COLREGs scenarios work with network off", async ({ page, context }) => {
  await onboard(page, "Philippines");
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.goto("/study/STAB");
  await page.getByText(/Intact stability criteria/).click();
  await expect(page.getByText("0.055 m·rad").first()).toBeVisible();
  await page.goto("/colregs");
  await page.getByTestId("scenario-scen-head-on-night").click();
  await page.getByTestId("action-1").check();
  await page.getByRole("button", { name: "Rule 14" }).click();
  await page.getByRole("button", { name: "Rule 8" }).click();
  await page.getByTestId("scenario-submit").click();
  await expect(page.getByTestId("scenario-score")).toHaveText("Score 100%");
});

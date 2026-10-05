import { expect, type Page } from "@playwright/test";

/** Complete onboarding for a country and land on the dashboard. */
export async function onboard(page: Page, country = "Nigeria", name = "Ade") {
  await page.goto("/");
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole("radio", { name: new RegExp(country) }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Download size: \d+/)).toBeVisible();
  await page.getByRole("button", { name: "Download & start" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Good (morning|afternoon|evening), ${name}`) })).toBeVisible();
}

/** Wait until the service worker controls the page (needed before going offline). */
export async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((r) => navigator.serviceWorker.addEventListener("controllerchange", () => r(), { once: true }));
    }
  });
}

/** Answer the current MCQ in the quiz (correctly when `right`), choose confidence, and go next. */
export async function answerMcq(page: Page, right: boolean, confidence: "sure" | "unsure" | "guess" = "sure") {
  const correct = page.locator('[data-testid^="option-"][data-correct="true"]');
  const wrong = page.locator('[data-testid^="option-"]:not([data-correct="true"])').first();
  await (right ? correct : wrong).click();
  await page.getByTestId(`conf-${confidence}`).click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await page.getByTestId("next").click();
}

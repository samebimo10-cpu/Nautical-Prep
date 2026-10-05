import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("10-question UK-persona oral in text mode, with debrief of missed key points", async ({ page }) => {
  await onboard(page, "United Kingdom");
  await page.goto("/oral");
  await expect(page.getByLabel("Examiner style")).toHaveValue("uk");
  await page.getByTestId("start-oral").click();
  await expect(page.getByTestId("transcript")).toContainText("I'm your examiner");
  let turns = 0;
  while (turns < 25) {
    await expect(page.getByTestId("oral-input").or(page.getByTestId("oral-verdict"))).toBeVisible();
    if (await page.getByTestId("oral-verdict").isVisible()) break;
    await page.getByTestId("oral-input").fill("I would inform the Master and follow the company procedures.");
    const n = await page.getByTestId("transcript").locator("li").count();
    await page.getByTestId("oral-send").click();
    await expect.poll(() => page.getByTestId("transcript").locator("li").count()).toBeGreaterThanOrEqual(n + 2);
    turns++;
  }
  await expect(page.getByTestId("oral-verdict")).toHaveText("NOT YET");
  await expect(page.getByTestId("debrief").locator(":scope > li")).toHaveCount(10);
  await expect(page.getByTestId("debrief")).toContainText("Model answer");
  // weak answers trigger examiner probes (follow-ups)
  expect(turns).toBeGreaterThan(10);
});

test("voice oral: push-to-talk fills the transcript live (Web Speech API stubbed)", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = "en-GB";
      continuous = true;
      interimResults = true;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: "raise the alarm" }, isFinal: false }] }), 50);
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: "raise the alarm and inform the master" }, isFinal: true }] }), 120);
      }
      stop() {
        setTimeout(() => this.onend?.(), 10);
      }
    }
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak: (u: { onend?: () => void }) => setTimeout(() => u.onend?.(), 10), cancel() {} } });
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      constructor(public text: string) {}
    };
  });
  await onboard(page, "United Kingdom");
  await page.goto("/oral");
  await page.getByLabel(/Voice mode/).check();
  await page.getByTestId("start-oral").click();
  await page.getByTestId("ptt").click();
  await expect(page.getByTestId("oral-input")).toHaveValue("raise the alarm and inform the master");
  await page.getByTestId("ptt").click();
  await page.getByTestId("oral-send").click();
  await expect(page.getByTestId("transcript")).toContainText("raise the alarm and inform the master");
});

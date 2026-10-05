import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

for (const path of ["/", "/study", "/practice", "/oral", "/mock", "/colregs", "/tracker", "/more"]) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    await onboard(page, "United Kingdom");
    await page.goto(path);
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

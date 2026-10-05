// Bundle budget (spec M9): initial JS+CSS loaded by index.html must stay under the gzip budget.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const dist = new URL("../apps/web/dist/", import.meta.url).pathname;
const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 170);
const html = readFileSync(dist + "index.html", "utf8");
const assets = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
let total = 0;
for (const a of assets) {
  const kb = gzipSync(readFileSync(dist + a)).length / 1024;
  total += kb;
  console.log(`  ${a}: ${kb.toFixed(1)} KB gz`);
}
console.log(`Initial load: ${total.toFixed(1)} KB gz (budget ${BUDGET_KB} KB)`);
if (total > BUDGET_KB) { console.error("✗ Bundle budget exceeded"); process.exit(1); }
console.log("✓ Within bundle budget");

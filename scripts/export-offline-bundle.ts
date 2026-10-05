import { mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "fflate";
import { COUNTRIES, OfflineBundle } from "@cm/content-schema";
import { bundleFor, loadContent, ROOT } from "./content-lib";

/**
 * Build one gzipped JSON bundle per country into apps/web/public/bundles.
 *   --prod   reviewed items only (paid production bundle)
 *   --check  production content gate: fail if any non-reviewed item would ship (M9)
 *   --out    output dir override
 */
const args = process.argv.slice(2);
const prod = args.includes("--prod") || process.env.VITE_CONTENT_MODE === "prod";
const check = args.includes("--check");
const outIdx = args.indexOf("--out");
const out = outIdx >= 0 ? args[outIdx + 1]! : join(ROOT, "apps/web/public/bundles");

const content = loadContent();
if (content.errors.length) {
  console.error("Content invalid — run pnpm content:validate");
  process.exit(1);
}
const mode = prod ? "prod" : "dev";
if (check) {
  let bad = 0;
  for (const cc of COUNTRIES) {
    const b = bundleFor(content, cc, "prod");
    const offenders = [...b.items, ...b.scenarios].filter((i) => i.status !== "reviewed");
    bad += offenders.length;
    console.log(`${cc}: ${b.items.length} reviewed items, ${b.scenarios.length} reviewed scenarios${offenders.length ? `, ${offenders.length} NON-REVIEWED` : ""}`);
  }
  if (bad) {
    console.error(`✗ Production gate failed: ${bad} non-reviewed item(s) in a paid bundle`);
    process.exit(1);
  }
  console.log("✓ Production gate: paid bundles contain reviewed items only");
}

mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith(".gz") || f === "manifest.json") rmSync(join(out, f));
const manifest: { generated_at: string; mode: string; countries: Record<string, { version: string; file: string; bytes: number; items: number }> } = {
  generated_at: new Date().toISOString(),
  mode,
  countries: {},
};
for (const cc of COUNTRIES) {
  const b = bundleFor(content, cc, mode);
  const body = { country: cc, mode, config: b.config, items: b.items, scenarios: b.scenarios, booking_md: b.booking_md };
  const version = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 12);
  const bundle = OfflineBundle.parse({ ...body, version, generated_at: manifest.generated_at });
  const gz = gzipSync(new TextEncoder().encode(JSON.stringify(bundle)), { level: 9 });
  const file = `${cc}.${version}.json.gz`;
  writeFileSync(join(out, file), gz);
  manifest.countries[cc] = { version, file, bytes: gz.length, items: b.items.length };
}
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`✓ ${mode} bundles written to ${out}`);
for (const [cc, m] of Object.entries(manifest.countries)) console.log(`  ${cc}: ${m.items} items, ${(m.bytes / 1024).toFixed(0)} KB`);

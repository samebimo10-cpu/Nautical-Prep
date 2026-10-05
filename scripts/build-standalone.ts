/**
 * Build a single self-contained HTML file of the app with the offline content packs embedded.
 * Opens from disk (file://), works fully offline, no server or install needed.
 *   pnpm build:standalone   →  apps/web/dist-standalone/chief-mate-prep.html
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./content-lib";

const web = join(ROOT, "apps/web");
const bundles = join(web, "public/bundles");
execSync("npx tsx scripts/export-offline-bundle.ts", { cwd: ROOT, stdio: "inherit" });
execSync("npx vite build", { cwd: web, stdio: "inherit", env: { ...process.env, VITE_STANDALONE: "1" } });

const manifest = JSON.parse(readFileSync(join(bundles, "manifest.json"), "utf8"));
const ENABLED = ["ph", "ng", "uk", "gh", "sg"]; // wave 3 (au, eg) is "coming soon" in the UI
const files: Record<string, string> = {};
for (const cc of ENABLED) {
  const entry = manifest.countries[cc];
  files[entry.file] = readFileSync(join(bundles, entry.file)).toString("base64");
}
const payload = JSON.stringify({ manifest, files }).replace(/</g, "\\u003c");
const out = join(web, "dist-standalone");
let html = readFileSync(join(out, "index.html"), "utf8");
// injected at the end so the <title> stays in the first 8 KB; module scripts run after parsing, so this is defined first
html = html.replace("</body>", `<script>window.__CM_BUNDLES__=${payload};</script>\n</body>`);
html = html.replace(/<link rel="(icon|apple-touch-icon)"[^>]*>/g, "");
// Library code contains a literal U+FFFD inside JS strings; escape it so the file is clean UTF-8 text.
html = html.replace(/\uFFFD/g, "\\uFFFD");
const target = join(out, "chief-mate-prep.html");
writeFileSync(target, html);
rmSync(join(out, "index.html"));
console.log(`✓ Standalone app: ${target} (${(html.length / 1024).toFixed(0)} KB)`);

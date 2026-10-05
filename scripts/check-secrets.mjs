// Fails if a secret-looking value is present in the client build output (spec M6).
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
const dist = new URL("../apps/web/dist", import.meta.url).pathname;
if (!existsSync(dist)) { console.error("apps/web/dist missing — run pnpm build first"); process.exit(1); }
const patterns = [/sk-ant-[A-Za-z0-9_-]{10,}/, /sk_live_[A-Za-z0-9]{10,}/, /sk_test_[A-Za-z0-9]{10,}/, /service_role/, /SUPABASE_SERVICE_ROLE_KEY/, /ANTHROPIC_API_KEY/];
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
let bad = 0;
for (const f of walk(dist).filter((f) => /\.(js|html|css|json|webmanifest)$/.test(f))) {
  const s = readFileSync(f, "utf8");
  for (const p of patterns) if (p.test(s)) { console.error(`✗ ${p} found in ${f}`); bad++; }
}
if (bad) process.exit(1);
console.log("✓ No secrets in client build output");

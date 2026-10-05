/**
 * Apply review decisions exported from the in-app reviewer queue to the YAML content.
 *   pnpm content:apply-reviews review-decisions-2026-10-05.json
 * reviewed → status: reviewed, needs_review: false, reviewer, last_reviewed
 * retired  → status: retired
 * changes  → logged to docs/CONTENT_TODO.md (no YAML change)
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { parseDocument, isMap, isSeq, type YAMLMap, type YAMLSeq } from "yaml";
import { loadContent, ROOT } from "./content-lib";

interface Decision { item_id: string; decision: "reviewed" | "retired" | "changes"; reviewer: string; note: string; decided_at: string }
const file = process.argv[2];
if (!file) {
  console.error("usage: apply-reviews <decisions.json>");
  process.exit(1);
}
const decisions = new Map((JSON.parse(readFileSync(file, "utf8")) as Decision[]).map((d) => [d.item_id, d]));
const { files } = loadContent();
let applied = 0;
for (const rel of files.filter((f) => f.endsWith(".yaml") && !f.endsWith("config.yaml"))) {
  const path = `${ROOT}/${rel}`;
  const doc = parseDocument(readFileSync(path, "utf8"));
  const root = doc.contents;
  const items = isMap(root) ? root.get("items") : root;
  if (!isSeq(items)) continue;
  let changed = false;
  for (const node of (items as YAMLSeq).items) {
    if (!isMap(node)) continue;
    const m = node as YAMLMap;
    const d = decisions.get(String(m.get("id")));
    if (!d || d.decision === "changes") continue;
    m.set("status", d.decision);
    if (d.decision === "reviewed") {
      m.set("needs_review", false);
      m.set("reviewer", d.reviewer);
      m.set("last_reviewed", d.decided_at);
    }
    changed = true;
    applied++;
  }
  if (changed) writeFileSync(path, doc.toString({ lineWidth: 0 }));
}
const changes = [...decisions.values()].filter((d) => d.decision === "changes");
if (changes.length) appendFileSync(`${ROOT}/docs/CONTENT_TODO.md`, `\n### Reviewer change requests (${new Date().toISOString().slice(0, 10)})\n${changes.map((d) => `- [ ] \`${d.item_id}\` — ${d.note} (${d.reviewer})`).join("\n")}\n`);
console.log(`✓ Applied ${applied} decision(s); ${changes.length} change request(s) logged. Run pnpm content:validate && pnpm content:bundle.`);

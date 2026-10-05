/**
 * Authoring tool: spread MCQ correct answers evenly over A–D by moving the correct option
 * to a round-robin target position (swap). Skips items whose options are an ordered numeric
 * scale (keeps "0.05 / 0.15 / 0.30 / 0.50" readable). Edits YAML in place, preserving comments.
 *   pnpm tsx scripts/rebalance-mcq.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseDocument, isMap, isSeq, YAMLMap, YAMLSeq } from "yaml";
import { loadContent, ROOT } from "./content-lib";

const { files } = loadContent();
let k = 0;
const counts = [0, 0, 0, 0];
const numeric = (opts: string[]) => {
  const n = opts.map((o) => parseFloat(String(o).replace(/[^\d.-]/g, "")));
  return n.every((x) => !Number.isNaN(x)) && n.every((x, i) => i === 0 || x >= n[i - 1]!);
};
for (const rel of files.filter((f) => f.endsWith(".yaml") && !f.includes("scenarios") && !f.endsWith("config.yaml"))) {
  const path = `${ROOT}/${rel}`;
  const doc = parseDocument(readFileSync(path, "utf8"));
  const root = doc.contents;
  const defaultsType = isMap(root) ? (root.getIn(["defaults", "type"]) as string | undefined) : undefined;
  const items = isMap(root) ? root.get("items") : root;
  if (!isSeq(items)) continue;
  let changed = false;
  for (const node of (items as YAMLSeq).items) {
    if (!isMap(node)) continue;
    const m = node as YAMLMap;
    const type = (m.get("type") as string | undefined) ?? defaultsType;
    if (type !== "mcq") continue;
    const opts = (m.get("options") as YAMLSeq).items as unknown[];
    const values = opts.map((o) => String((o as { value?: unknown }).value ?? o));
    const ci = Number(m.get("correct_index"));
    if (numeric(values)) {
      counts[ci]!++;
      continue;
    }
    const target = k++ % 4;
    if (target !== ci) {
      [opts[ci], opts[target]] = [opts[target], opts[ci]];
      m.set("correct_index", target);
      changed = true;
    }
    counts[target]!++;
  }
  if (changed) writeFileSync(path, doc.toString({ lineWidth: 0 }));
}
console.log("Answer positions A–D:", counts);

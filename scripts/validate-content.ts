import { COMPETENCES, COUNTRIES } from "@cm/content-schema";
import { loadContent } from "./content-lib";

const c = loadContent();
const table: Record<string, Record<string, number>> = {};
for (const cc of ["*", ...COUNTRIES]) {
  table[cc] = {};
  for (const comp of COMPETENCES) table[cc]![comp] = c.items.filter((i) => i.competence === comp && (cc === "*" ? i.countries.includes("*") : i.countries.includes(cc as never))).length;
}
const byType: Record<string, number> = {};
for (const i of c.items) byType[i.type] = (byType[i.type] ?? 0) + 1;
const byStatus: Record<string, number> = {};
for (const i of c.items) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;

console.log(`Content files: ${c.files.length} · items: ${c.items.length} · COLREG scenarios: ${c.scenarios.length} · country configs: ${c.configs.size}`);
console.log("By type:", byType);
console.log("By status:", byStatus);
console.log("Items by country (\"*\" = core, all countries) × competence:");
console.table(table);
if (c.errors.length) {
  console.error(`\n✗ ${c.errors.length} content error(s):`);
  for (const e of c.errors) console.error(`  ${e.file}${e.id ? ` [${e.id}]` : ""}: ${e.message}`);
  process.exit(1);
}
console.log("✓ All content valid");

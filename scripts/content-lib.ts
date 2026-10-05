import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { ColregScenario, CountryConfig, Item, COUNTRIES, type CountryCode } from "@cm/content-schema";

export const ROOT = new URL("..", import.meta.url).pathname;
export const CONTENT = join(ROOT, "content");

const ITEM_DEFAULTS = { countries: ["*"], status: "draft", needs_review: true, sources: [], last_reviewed: null, reviewer: null };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export interface LoadError {
  file: string;
  id?: string;
  message: string;
}

export interface LoadedContent {
  items: Item[];
  scenarios: ColregScenario[];
  configs: Map<CountryCode, CountryConfig>;
  booking: Map<CountryCode, string>;
  errors: LoadError[];
  files: string[];
}

/** File format: either a list of items, or { defaults: {...}, items: [...] }. */
export function loadContent(): LoadedContent {
  const errors: LoadError[] = [];
  const items: Item[] = [];
  const scenarios: ColregScenario[] = [];
  const configs = new Map<CountryCode, CountryConfig>();
  const booking = new Map<CountryCode, string>();
  const files = walk(CONTENT).filter((f) => /\.(ya?ml|md)$/.test(f));

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (file.endsWith("booking.md")) {
      const cc = file.split("/").at(-2) as CountryCode;
      booking.set(cc, readFileSync(file, "utf8"));
      continue;
    }
    if (file.endsWith(".md")) continue;
    let doc: unknown;
    try {
      doc = parse(readFileSync(file, "utf8"));
    } catch (e) {
      errors.push({ file: rel, message: `YAML parse error: ${(e as Error).message}` });
      continue;
    }
    if (file.endsWith("config.yaml")) {
      const r = CountryConfig.safeParse(doc);
      if (r.success) configs.set(r.data.code, r.data);
      else errors.push({ file: rel, message: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    const isScenario = file.includes("scenarios");
    const d = doc as { defaults?: Record<string, unknown>; items?: unknown[] } | unknown[];
    const list = Array.isArray(d) ? d : (d.items ?? []);
    const defaults = Array.isArray(d) ? {} : (d.defaults ?? {});
    for (const raw of list) {
      const merged = { ...(isScenario ? { status: "draft", needs_review: true } : ITEM_DEFAULTS), ...defaults, ...(raw as object) };
      const schema: z.ZodTypeAny = isScenario ? ColregScenario : Item;
      const r = schema.safeParse(merged);
      const id = (raw as { id?: string }).id;
      if (!r.success) {
        errors.push({ file: rel, id, message: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        continue;
      }
      if (isScenario) scenarios.push(r.data as ColregScenario);
      else items.push(r.data as Item);
    }
  }
  errors.push(...semanticChecks(items, scenarios, configs));
  return { items, scenarios, configs, booking, errors, files: files.map((f) => relative(ROOT, f)) };
}

function semanticChecks(items: Item[], scenarios: ColregScenario[], configs: Map<CountryCode, CountryConfig>): LoadError[] {
  const errs: LoadError[] = [];
  const ids = new Map<string, number>();
  for (const i of [...items, ...scenarios]) ids.set(i.id, (ids.get(i.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) errs.push({ file: "*", id, message: `duplicate id (${n}×)` });
  for (const i of items) {
    if (i.status === "reviewed" && (!i.reviewer || !i.last_reviewed)) errs.push({ file: "*", id: i.id, message: "reviewed items need reviewer and last_reviewed" });
    if (i.status === "draft" && !i.needs_review) errs.push({ file: "*", id: i.id, message: "draft items must have needs_review: true" });
    if (i.type === "mcq" && new Set(i.options).size !== 4) errs.push({ file: "*", id: i.id, message: "mcq options must be distinct" });
    if (i.type === "lesson") for (const r of i.related_item_ids) if (!ids.has(r)) errs.push({ file: "*", id: i.id, message: `related item ${r} not found` });
    if (i.competence === "LOCAL" && i.countries.includes("*")) errs.push({ file: "*", id: i.id, message: "LOCAL items must target specific countries" });
  }
  for (const s of scenarios) {
    if (s.correct_action >= s.actions.length) errs.push({ file: "*", id: s.id, message: "correct_action out of range" });
    for (const r of s.correct_rules) if (!s.rule_options.includes(r)) errs.push({ file: "*", id: s.id, message: `correct rule ${r} not in rule_options` });
  }
  for (const c of COUNTRIES) if (!configs.has(c)) errs.push({ file: `content/countries/${c}/config.yaml`, message: "missing country config" });
  return errs;
}

export function bundleFor(content: LoadedContent, country: CountryCode, mode: "dev" | "prod") {
  const ok = (s: string) => (mode === "prod" ? s === "reviewed" : s !== "retired");
  const items = content.items.filter((i) => (i.countries.includes("*") || i.countries.includes(country)) && ok(i.status));
  const scenarios = content.scenarios.filter((s) => ok(s.status));
  return { items, scenarios, config: content.configs.get(country)!, booking_md: content.booking.get(country) ?? null };
}

export { existsSync };

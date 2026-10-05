import { z } from "zod";

export const COMPETENCES = ["NAV", "STAB", "CARGO", "COLREG", "LAW", "MGMT", "LOCAL"] as const;
export const COUNTRIES = ["ph", "ng", "uk", "gh", "sg", "au", "eg"] as const;
export const ITEM_TYPES = ["mcq", "written", "calc", "oral", "lesson"] as const;

export const Competence = z.enum(COMPETENCES);
export type Competence = z.infer<typeof Competence>;
export const CountryCode = z.enum(COUNTRIES);
export type CountryCode = z.infer<typeof CountryCode>;

export const COMPETENCE_LABELS: Record<Competence, string> = {
  NAV: "Navigation",
  STAB: "Stability & Ship Construction",
  CARGO: "Cargo Handling & Stowage",
  COLREG: "COLREGs & Watchkeeping",
  LAW: "Conventions & Maritime Law",
  MGMT: "Ship Management & Emergencies",
  LOCAL: "Country-specific",
};

/** Relative syllabus weight used by "study next" and mock blueprints (draft — see DECISIONS.md). */
export const SYLLABUS_WEIGHTS: Record<Competence, number> = {
  NAV: 1.0,
  STAB: 1.2,
  CARGO: 1.1,
  COLREG: 1.0,
  LAW: 1.1,
  MGMT: 0.9,
  LOCAL: 0.6,
};

const Source = z.object({ label: z.string().min(1), ref: z.string().min(1) });

const Base = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id must be a lowercase slug"),
  competence: Competence,
  topic: z.string().min(1),
  countries: z.array(z.union([z.literal("*"), CountryCode])).min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  sources: z.array(Source).default([]),
  status: z.enum(["draft", "reviewed", "retired"]),
  needs_review: z.boolean(),
  last_reviewed: z.string().nullable().default(null),
  reviewer: z.string().nullable().default(null),
});

export const McqItem = Base.extend({
  type: z.literal("mcq"),
  stem: z.string().min(5),
  options: z.array(z.string().min(1)).length(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().min(5),
});

export const MarkingPoint = z.object({ point: z.string().min(2), weight: z.number().positive() });

export const WrittenItem = Base.extend({
  type: z.literal("written"),
  prompt: z.string().min(5),
  model_answer: z.string().min(5),
  marking_points: z.array(MarkingPoint).min(1),
});

export const VariableRange = z.object({
  min: z.number(),
  max: z.number(),
  step: z.number().positive().default(1),
});

export const CalcItem = Base.extend({
  type: z.literal("calc"),
  template: z.string().min(5),
  variables: z.record(VariableRange),
  calc_fn: z.string().min(1),
  units: z.string(),
  tolerance: z.number().nonnegative(),
  worked_solution_template: z.string().min(5),
});

/**
 * A key point an examiner listens for. `match` holds keyword groups used by the
 * offline examiner: each group is "a|b|c" (any synonym). The point counts as hit
 * when at least `min_groups` (default: all, or 60% when >2) groups are present.
 */
export const KeyPoint = z.union([
  z.string().min(2),
  z.object({
    point: z.string().min(2),
    match: z.array(z.string().min(1)).min(1),
    min_groups: z.number().int().positive().optional(),
  }),
]);
export type KeyPoint = z.infer<typeof KeyPoint>;

export const OralItem = Base.extend({
  type: z.literal("oral"),
  question: z.string().min(5),
  model_answer: z.string().min(5),
  key_points: z.array(KeyPoint).min(1),
  follow_ups: z.array(z.string()).default([]),
  examiner_style: z.string().default("generic"),
  /** A dangerous/wrong answer here can fail the oral on its own (safety-critical). */
  critical: z.boolean().default(false),
});

export const LessonItem = Base.extend({
  type: z.literal("lesson"),
  title: z.string().min(2),
  body_md: z.string().min(10),
  related_item_ids: z.array(z.string()).default([]),
});

export const Item = z.discriminatedUnion("type", [McqItem, WrittenItem, CalcItem, OralItem, LessonItem]);
export type Item = z.infer<typeof Item>;
export type McqItem = z.infer<typeof McqItem>;
export type WrittenItem = z.infer<typeof WrittenItem>;
export type CalcItem = z.infer<typeof CalcItem>;
export type OralItem = z.infer<typeof OralItem>;
export type LessonItem = z.infer<typeof LessonItem>;

export const ExamComponent = z.object({
  id: z.string(),
  format: z.string(),
  duration_minutes: z.number().nullable().default(null),
  pass_mark_percent: z.number().nullable().default(null),
  question_count: z.number().nullable().default(null),
});

export const CountryConfig = z.object({
  code: CountryCode,
  name: z.string(),
  authority: z.string(),
  currency: z.string(),
  wave: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  exam_components: z.array(ExamComponent),
  eligibility: z.object({
    sea_time_months: z.number().nullable(),
    required_courses: z.array(z.string()).default([]),
  }),
  local_topics: z.array(z.string()).default([]),
  examiner_persona: z.string().default("generic"),
  status: z.enum(["draft", "reviewed"]),
  notes: z.array(z.string()).default([]),
});
export type CountryConfig = z.infer<typeof CountryConfig>;

/** COLREGs scenario (M7). Bearings are relative to own ship's head, degrees. */
export const ColregTarget = z.object({
  label: z.string(),
  relative_bearing: z.number().min(0).max(360),
  range_nm: z.number().positive(),
  heading_rel: z.number().min(0).max(360),
  vessel: z.string(),
  lights: z.array(z.string()).default([]),
  shapes: z.array(z.string()).default([]),
  sound: z.string().optional(),
});

export const ColregScenario = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string(),
  situation: z.string(),
  visibility: z.enum(["good", "restricted"]),
  time: z.enum(["day", "night"]),
  own_ship: z.string(),
  targets: z.array(ColregTarget).min(1),
  actions: z.array(z.string()).min(2),
  correct_action: z.number().int().min(0),
  rules: z.array(z.string()).min(1),
  rule_options: z.array(z.string()).min(2),
  correct_rules: z.array(z.string()).min(1),
  explanation: z.string(),
  status: z.enum(["draft", "reviewed", "retired"]),
  needs_review: z.boolean(),
});
export type ColregScenario = z.infer<typeof ColregScenario>;

/** Offline bundle shipped to the device per country. */
export const OfflineBundle = z.object({
  version: z.string(),
  country: CountryCode,
  generated_at: z.string(),
  mode: z.enum(["dev", "prod"]),
  config: CountryConfig,
  items: z.array(Item),
  scenarios: z.array(ColregScenario),
  booking_md: z.string().nullable(),
});
export type OfflineBundle = z.infer<typeof OfflineBundle>;

export function itemAppliesTo(item: { countries: string[] }, country: string): boolean {
  return item.countries.includes("*") || item.countries.includes(country);
}

export function keyPointText(k: KeyPoint): string {
  return typeof k === "string" ? k : k.point;
}

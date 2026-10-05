# Content guide — for subject-matter experts

Content lives in `content/` as YAML and is validated against Zod schemas (`packages/content-schema`). It is versioned in Git so every change is reviewable.

```
content/core/{nav,stab,cargo,colreg,law,mgmt}/{mcq,oral,written,calc,lessons}.yaml
content/core/colreg/scenarios.yaml
content/countries/{ph,ng,uk,gh,sg,au,eg}/{config.yaml,booking.md,items.yaml}
```

Each file is `{ defaults: {...}, items: [...] }`. Defaults usually set `competence` and `type`. Every item automatically gets `countries: ["*"]`, `status: draft`, `needs_review: true` unless set.

## Golden rules
1. **Original content only.** Never copy past papers, textbooks or commercial question banks. Write your own question, even when the topic is common.
2. **Cite sources** (`sources: [{label, ref}]`) at the level you are sure of, e.g. "SOLAS Ch. III Reg. 19". Don't invent paragraph numbers.
3. **Unsure of a fact?** Leave it out or mark it in `docs/CONTENT_TODO.md`. Never guess pass marks, fees or circular numbers.
4. **Numbers come from code.** Calculation items name a `calc_fn` in `packages/calc`. Never type an answer into a calc item.

## Item types
- **mcq**: `stem`, exactly 4 distinct `options`, `correct_index` (0–3), `explanation` (say *why*). Don't write "all of the above". After adding items, run `pnpm tsx scripts/rebalance-mcq.ts` to keep answer positions even.
- **written**: `prompt`, `model_answer`, `marking_points: [{point, weight}]`.
- **oral**: `question`, `model_answer`, `key_points`, `follow_ups`, `critical`.
  - A key point is either a string, or `{point, match: ["group1 alt|alt", "group2"]}`. The offline examiner counts the point as hit when enough groups appear (all groups if 1–2, otherwise 60%). Alternatives can be phrases. Words are stemmed, so "loading" matches "load".
  - Set `critical: true` where an unsafe answer should fail the oral (enclosed spaces, fire, MOB, pilot transfer...).
  - The test suite **requires your model answer to score ≥ 80% against your own key points** and a vague answer to score < 35%. If it fails, add synonyms to `match`.
- **calc**: `template` with `{{var}}`, `variables` ranges `{min,max,step}`, `calc_fn`, `units`, `tolerance`, `worked_solution_template` using `{{value:dp}}` from the function's named intermediate values. The test suite generates 300 random variants of every template.
- **lesson**: `title`, `body_md` (Markdown, tables welcome), `related_item_ids` (used for "Test yourself").
- **scenario** (COLREGs): see existing examples. `relative_bearing`/`heading_rel` are relative to own ship's head.

## Review workflow
1. Turn on **Profile → Reviewer mode** in the app. Open **More → Reviewer / admin**.
2. Enter your name and credentials, then Approve / Needs changes (with a note) / Retire.
3. Export decisions and give the JSON to the developer, who runs `pnpm content:apply-reviews file.json` → `pnpm content:validate` → commit.
4. Approved items (`status: reviewed`, `reviewer`, `last_reviewed`) appear in the next production bundle.

## Commands
`pnpm content:validate` (counts by country, competence and status; fails on any error) · `pnpm test` (includes content quality tests) · `pnpm content:bundle` · `pnpm content:import`

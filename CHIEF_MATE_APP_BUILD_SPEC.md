# Chief Mate CoC Prep App — Build Spec for Claude Code

> **How to use this file:** Put it at the repo root and add `CLAUDE.md` with the single line
> `Read CHIEF_MATE_APP_BUILD_SPEC.md and follow it. Work milestone by milestone.`
> Then tell Claude Code: "Start milestone M0."

---

## 0. Instructions to Claude Code

1. Work **one milestone at a time, in order** (M0 → M9). Do not start a milestone until the previous one's acceptance criteria pass.
2. At the start of each milestone, create a task list from its **Tasks** section. At the end, run every command in its **Verify** section and paste the results into `docs/PROGRESS.md` under that milestone.
3. Commit after each completed task with a conventional commit message (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
4. When you reach a **🛑 HUMAN CHECKPOINT**, stop, list exactly what you need from the human (keys, accounts, decisions), and wait. Never invent credentials or skip the checkpoint.
5. **Never fabricate regulatory facts.** Any exam format, pass mark, fee, circular number or legal citation you are not given must be stored with `status: "draft"` and `needs_review: true`, and listed in `docs/CONTENT_TODO.md`. The app must never show draft content to paying users in production.
6. **Never reproduce past exam papers, textbooks or copyrighted question banks.** All questions are original.
7. **Numbers come from code, not AI.** Every calculation answer is produced by tested deterministic functions in `packages/calc`. The LLM may explain, never compute final answers.
8. Keep the app working offline at every milestone after M2.
9. If a requirement here is ambiguous, choose the simplest option that satisfies the acceptance criteria, record the decision in `docs/DECISIONS.md`, and continue.

---

## 1. Product summary

A mobile-first app that prepares Second Officers for the **Chief Mate Certificate of Competency (STCW Reg. II/2, management level)** in seven countries: **Philippines, Nigeria, UK, Ghana, Singapore, Australia, Egypt**. Content is a shared STCW core (~70%) plus country packs (~30%). The differentiator is an **AI oral examiner** that simulates each country's oral exam.

Users study mostly **at sea on poor or no connectivity**, on mid-range Android phones. Offline-first is mandatory.

Launch waves:
- **Wave 1:** Philippines, Nigeria, UK
- **Wave 2:** Ghana, Singapore
- **Wave 3:** Australia, Egypt (Arabic UI)

---

## 2. Tech stack (fixed — do not substitute without recording in DECISIONS.md)

| Layer | Choice | Reason |
| --- | --- | --- |
| App | React 18 + TypeScript + Vite, installable **PWA** (vite-plugin-pwa, Workbox) | Shareable by link/WhatsApp, no store needed for MVP, works offline |
| Native wrap | Capacitor (Android first, iOS second) — milestone M8 | Store presence later from the same codebase |
| UI | Tailwind CSS + Radix UI primitives | Accessible, light bundle |
| State | Zustand; TanStack Query for server data | Simple |
| Offline store | Dexie (IndexedDB) | Full content + progress cached on device |
| Backend | Supabase: Postgres, Auth (email OTP + Google), Storage, Edge Functions (Deno) | One managed service, row-level security |
| AI | Anthropic API (Claude) called **only** from Edge Functions; key never in client | Oral examiner, answer grading, explanations |
| Voice | Browser Web Speech API for STT/TTS in M6; server STT/TTS behind an interface for later swap | Zero cost to start |
| Payments | Paystack (NG, GH, card) first; payment provider interface so GCash/Maya, Stripe and app-store billing can be added | Local rails |
| Content | Markdown/YAML files in `content/` → validated → imported to Postgres by script | Git-reviewable content |
| Tests | Vitest (unit), Playwright (e2e, incl. offline mode), Zod schemas for all data | |
| CI | GitHub Actions: lint, typecheck, unit, e2e, content validation | |
| Monorepo | pnpm workspaces | |

---

## 3. Repository structure

```
/
├── CLAUDE.md
├── CHIEF_MATE_APP_BUILD_SPEC.md
├── apps/
│   └── web/                  # React PWA
│       ├── src/
│       │   ├── features/     # onboarding, study, quiz, mock, oral, calc, tracker, account, admin
│       │   ├── lib/          # supabase client, dexie db, sync, analytics
│       │   ├── components/
│       │   └── i18n/         # en, ar, fil
│       └── e2e/
├── packages/
│   ├── calc/                 # deterministic maritime calculation engine + tests
│   ├── content-schema/       # Zod schemas shared by app, importer, edge functions
│   └── ui/                   # shared components (optional)
├── supabase/
│   ├── migrations/
│   ├── functions/            # oral-examiner, grade-answer, explain, payments-webhook
│   └── seed.sql
├── content/
│   ├── core/                 # shared STCW II/2 items by competence
│   └── countries/{ph,ng,uk,gh,sg,au,eg}/
├── scripts/                  # validate-content, import-content, export-offline-bundle
└── docs/
    ├── PROGRESS.md
    ├── DECISIONS.md
    ├── CONTENT_TODO.md
    └── CONTENT_GUIDE.md
```

---

## 4. Domain model

### 4.1 Taxonomy

**Competences (STCW II/2 core)** — use these exact codes:

| Code | Competence |
| --- | --- |
| NAV | Navigation: passage planning, voyage optimisation, ECDIS, celestial, compass error, tides, weather routing, radar/ARPA |
| STAB | Stability and ship construction: GZ, free surface, damage stability, drydocking, shear force and bending moment |
| CARGO | Cargo handling and stowage: bulk (IMSBC), grain, tankers, containers, ro-ro, IMDG, lashing |
| COLREG | Collision regulations and watchkeeping at management level |
| LAW | Conventions and law: SOLAS, MARPOL, MLC, STCW, Load Line, ISM, ISPS, PSC, charter parties, B/L |
| MGMT | Ship management: BRM, leadership, maintenance, emergency response, IAMSAR, medical |
| LOCAL | Country-specific legislation, circulars and local navigation knowledge |

**Countries:** `ph`, `ng`, `uk`, `gh`, `sg`, `au`, `eg`.

### 4.2 Content item types

All items share base fields:

```ts
{
  id: string;              // slug, e.g. "stab-free-surface-001"
  type: "mcq" | "written" | "calc" | "oral" | "lesson";
  competence: "NAV"|"STAB"|"CARGO"|"COLREG"|"LAW"|"MGMT"|"LOCAL";
  topic: string;           // e.g. "free-surface"
  countries: string[];     // ["*"] = all
  difficulty: 1 | 2 | 3;
  sources: { label: string; ref: string }[];  // e.g. SOLAS Ch. II-1 Reg. 5
  status: "draft" | "reviewed" | "retired";
  needs_review: boolean;
  last_reviewed: string | null;  // ISO date
  reviewer: string | null;
}
```

Type-specific fields:
- **mcq:** `stem`, `options[4]`, `correct_index`, `explanation`
- **written:** `prompt`, `model_answer`, `marking_points[]` (each with weight)
- **calc:** `template` (stem with `{{var}}` placeholders), `variables` (ranges), `calc_fn` (name of a function in `packages/calc`), `units`, `tolerance`, `worked_solution_template`
- **oral:** `question`, `model_answer`, `key_points[]`, `follow_ups[]`, `examiner_style` (`"uk" | "sg" | "generic" | ...`)
- **lesson:** `title`, `body_md`, `related_item_ids[]`

### 4.3 Country config (`content/countries/{code}/config.yaml`)

```yaml
code: ng
name: Nigeria
authority: NIMASA
currency: NGN
exam_components:            # all values draft until confirmed by human
  - id: written
    format: draft
    duration_minutes: null
    pass_mark_percent: null
  - id: oral
    format: draft
eligibility:
  sea_time_months: null     # draft
  required_courses: []      # e.g. ["Medical Care", "Advanced Fire Fighting", "ECDIS", "GMDSS"]
local_topics: []
examiner_persona: generic
status: draft
```

### 4.4 Database tables (Postgres, all with RLS)

- `profiles` (user_id, display_name, country, target_exam_date, rank, locale, created_at)
- `items` (imported content; `status` filter enforced in RLS: non-admins only see `reviewed` in production)
- `country_configs`
- `attempts` (user_id, item_id, answer, score, time_ms, created_at)
- `mock_exams` (user_id, country, started_at, finished_at, score, passed, item_ids)
- `oral_sessions` (user_id, country, transcript jsonb, rubric_scores jsonb, verdict, created_at)
- `srs_cards` (user_id, item_id, ease, interval_days, due_at)
- `sea_service` (user_id, vessel, vessel_type, grt, from_date, to_date, capacity)
- `certificates` (user_id, course, issued_at, expires_at, file_path)
- `subscriptions` (user_id, tier, country, provider, status, current_period_end)
- `content_reports` (user_id, item_id, message, status)
- `admins` (user_id)

---

## 5. Milestones

Each milestone has **Tasks**, **Acceptance criteria** and **Verify** commands.

### M0 — Scaffold and tooling
**Tasks**
1. Init pnpm monorepo with the structure in §3.
2. Vite + React + TS app in `apps/web`; Tailwind; ESLint + Prettier; strict TS.
3. `packages/content-schema` with Zod schemas for §4.2–4.3.
4. Vitest and Playwright configured; one smoke test each.
5. GitHub Actions workflow: install, lint, typecheck, test, build.
6. Create `docs/PROGRESS.md`, `DECISIONS.md`, `CONTENT_TODO.md`, `CONTENT_GUIDE.md`.

**Acceptance criteria:** `pnpm dev` serves a placeholder home page; all checks pass in CI.
**Verify:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`

🛑 **HUMAN CHECKPOINT A:** Ask for: GitHub repo URL; Supabase project URL + anon key + service role key (for local `.env` only); app name and brand colours (or permission to use a neutral default).

### M1 — Backend, auth, onboarding
**Tasks**
1. Supabase migrations for all tables in §4.4 with RLS policies; `supabase/seed.sql` with dev data.
2. Auth: email OTP and Google sign-in.
3. Onboarding flow: choose country (7 options, wave-3 countries labelled "coming soon"), rank, target exam date.
4. Profile screen; sign-out; delete-account (removes user rows).

**Acceptance criteria:** A new user can sign up, pick Nigeria, and land on an empty dashboard. RLS tests prove a user cannot read another user's attempts.
**Verify:** `pnpm test` (incl. RLS tests against local Supabase via `supabase start`), `pnpm e2e -- onboarding`

### M2 — Content pipeline and offline storage
**Tasks**
1. `scripts/validate-content.ts`: validates every file in `content/` against Zod schemas; fails CI on error; prints count by country/competence/status.
2. `scripts/import-content.ts`: upserts items and country configs into Postgres.
3. `scripts/export-offline-bundle.ts`: produces a compressed JSON bundle per country (core + country items, `reviewed` only in prod; all in dev).
4. App downloads the bundle into Dexie on first login and on version change; shows download size and progress.
5. PWA: service worker caches app shell; app opens and runs fully with network off.
6. Background sync queue for attempts/progress recorded offline.
7. **Seed content:** write 10 sample items per competence per wave-1 country (mix of types) as **original drafts** with `status: draft`, `needs_review: true`, and log them in `CONTENT_TODO.md`. Write 3 sample `config.yaml` files with all regulatory values `null`/`draft`.
8. Write `docs/CONTENT_GUIDE.md`: how subject experts author and review items.

**Acceptance criteria:** Content validates; bundle installs; Playwright test with `context.setOffline(true)` can open the app and answer a question; offline attempts sync when back online.
**Verify:** `pnpm content:validate && pnpm content:import && pnpm e2e -- offline`

### M3 — Calculation engine
**Tasks**
1. `packages/calc` pure TS functions with JSDoc formulas and units, covering at least:
   - Stability: KG after loading/discharging, free surface correction (FSM / displacement), GM, GZ from KN tables, list correction, angle of loll, drydock critical GM / upthrust (P force)
   - Trim: change of trim, final drafts using MCTC and LCF
   - Shear force and bending moment at a section (simplified)
   - Navigation: great circle distance and initial course, mercator sailing, compass error from azimuth/amplitude (given computed values), secondary-port tide height (simple cosine method)
   - Cargo: stowage factor/space, grain heeling moment check against allowable, lashing force basic check
2. Each function has unit tests with at least 3 hand-verified cases; mark the source of each test case in a comment. If a test case cannot be verified from a reliable formula, mark `// NEEDS EXPERT CHECK` and list it in `CONTENT_TODO.md`.
3. `calc` items: generator substitutes random variables within ranges, calls `calc_fn`, renders a worked step-by-step solution, and grades within `tolerance`.
4. Calculation practice screen with step reveal.

**Acceptance criteria:** ≥95% line coverage on `packages/calc`; a user can practise 5 randomised free-surface questions and see worked solutions.
**Verify:** `pnpm --filter calc test -- --coverage`

### M4 — Study, quiz and analytics
**Tasks**
1. Study home: competences with progress bars for the user's country.
2. Quiz mode: pick competence/topic/difficulty, N questions; MCQ instant feedback with explanation and sources; written answers saved for AI grading (M6) and self-marking against marking points now.
3. Weak-area analytics: score per competence and topic over the last 30 days; "study next" recommendation (lowest score × syllabus weight).
4. Lessons reader (Markdown).
5. Content report button on every item → `content_reports`.

**Acceptance criteria:** Answering 20 questions updates analytics correctly (unit-tested scoring logic); reports land in DB.
**Verify:** `pnpm test && pnpm e2e -- quiz`

### M5 — Mock exams and spaced repetition
**Tasks**
1. Mock exam builder from country config (`exam_components`). If config values are `null`, use a clearly labelled "practice format" default (e.g. 50 questions, 120 minutes, 70% pass) and show a banner: "Official format not yet confirmed".
2. Timer, flag-for-review, submit, results by competence, pass/fail against pass mark.
3. Mock exams fully offline.
4. SRS (SM-2) on missed items and lesson key points; daily review queue.

**Acceptance criteria:** A full mock can be completed offline and syncs later; SRS scheduling unit-tested.
**Verify:** `pnpm test && pnpm e2e -- mock`

🛑 **HUMAN CHECKPOINT B:** Ask for: Anthropic API key (to set as a Supabase secret, never committed); monthly AI budget cap; confirmation of the examiner persona tone per country.

### M6 — AI grading and oral examiner
**Tasks**
1. Edge Function `grade-answer`: input = written item + user answer; retrieves the item's model answer and marking points; calls Claude with a strict rubric prompt; returns JSON `{score, points_hit[], points_missed[], feedback}` validated by Zod. Retry once on invalid JSON.
2. Edge Function `oral-examiner`: stateful session. System prompt sets the country persona, restricts the examiner to questions from `oral` items for that country plus their follow-ups, and grades each answer against `key_points`. Ends after N questions or time limit with verdict and debrief.
3. Grounding rule: the model may only use the provided items as truth; if a user asks something outside them, the examiner says it will move on. Log any answer it flags low-confidence.
4. Text oral mode (works with intermittent connectivity; queues if offline and shows "needs connection").
5. Voice oral mode: Web Speech API STT/TTS behind a `VoiceProvider` interface; push-to-talk; transcript shown live.
6. Per-user daily AI quota by tier; usage logged; hard budget cap from env.
7. Prompts stored in `supabase/functions/_prompts/` as versioned files; unit tests with mocked model responses.

**Acceptance criteria:** A user completes a 10-question UK-persona oral in text and voice; the debrief lists missed key points; quota enforcement tested; no API key reachable from client bundle (test greps build output).
**Verify:** `pnpm test && pnpm e2e -- oral && ! grep -r "sk-ant" apps/web/dist`

### M7 — COLREGs simulator, tracker, update feed
**Tasks**
1. COLREGs scenario player: SVG top-down view of own ship and targets (bearing, aspect, lights/shapes, visibility); user selects action and rule; feedback cites rules. Ship 20 original draft scenarios (`needs_review: true`).
2. Sea-time tracker: log service; totals by capacity; compare against country `eligibility.sea_time_months` (show "not confirmed" if null).
3. Certificate tracker: upload to Storage, expiry alerts (in-app; push later).
4. Regulation update feed: admin posts update linked to affected item IDs; affected items flagged in users' study lists.
5. Exam booking guide page per country rendered from `content/countries/{code}/booking.md` (draft until confirmed).

**Acceptance criteria:** Scenario player works offline; tracker totals unit-tested; update marks linked items.
**Verify:** `pnpm test && pnpm e2e -- colregs tracker`

🛑 **HUMAN CHECKPOINT C:** Ask for: Paystack keys and business details; final pricing per country and tier; whether to start with web payments only.

### M8 — Payments, tiers, admin, native builds
**Tasks**
1. `PaymentProvider` interface; Paystack implementation; webhook Edge Function updates `subscriptions`.
2. Tiers: Free (limited bank, 1 mock, eligibility checker), Pro (per country), Pro + Oral, enforced server-side and in RLS.
3. Paywall screens; restore purchase; local currency display.
4. Admin panel (route guarded by `admins` table): content review queue (draft → reviewed with reviewer + date), reports triage, update feed posting, usage stats.
5. Capacitor Android project; build an AAB; document iOS steps in `docs/NATIVE.md`.

**Acceptance criteria:** Test-mode Paystack purchase unlocks Pro; admin can approve a draft item and it appears in the next offline bundle.
**Verify:** `pnpm test && pnpm e2e -- payments admin && pnpm --filter web cap:build:android`

### M9 — Hardening and launch prep
**Tasks**
1. Performance: initial load < 3 s on throttled 3G in Lighthouse; bundle budget enforced in CI; Lighthouse PWA score ≥ 90.
2. Accessibility: axe checks in Playwright, no serious violations.
3. i18n scaffolding: English complete; Arabic (RTL) and Filipino keys stubbed for wave 3.
4. Privacy: privacy policy and terms placeholders (`docs/LEGAL_TODO.md` for human/lawyer), data export and deletion.
5. Analytics events (privacy-respecting, e.g. PostHog or Supabase table): signup, onboarding complete, quiz complete, mock complete, oral complete, paywall view, purchase.
6. Production content gate: build fails if any item shown in a paid production bundle has `status != reviewed`.
7. Write `docs/RUNBOOK.md`: deploy, rotate keys, import content, roll back.

**Acceptance criteria:** All Verify commands green; production bundle contains reviewed items only.
**Verify:** `pnpm ci:all` (aggregate script running every check above)

🛑 **HUMAN CHECKPOINT D (pre-launch):** Report: number of reviewed vs draft items per country, open items in `CONTENT_TODO.md` and `LEGAL_TODO.md`, and anything blocking launch.

---

## 6. Work Claude Code cannot do (human/expert owned)

Track these in `docs/CONTENT_TODO.md`; Claude Code builds the tooling but does not decide them:

- Confirming each country's official exam format, pass marks, fees, eligibility and application steps with the authority (MARINA, NIMASA, MCA, GMA, MPA, AMSA, Egyptian maritime authority)
- Writing and **expert-reviewing** the full question bank (target: ~2,000 core items + ~300 per country before paid launch)
- Verifying calculation test cases flagged `NEEDS EXPERT CHECK`
- Legal: privacy policy, terms, company/payments setup
- Pricing decisions and app-store accounts

---

## 7. Definition of done (whole project)

- All milestones M0–M9 accepted and logged in `docs/PROGRESS.md`
- Wave 1 countries live with reviewed content only in paid tiers
- App fully usable offline except AI grading and oral sessions
- No secrets in client code; RLS on every table
- CI green on `main`

# Progress

Verified in the build sandbox on 2026-10-05 (Node 22, pnpm 10, Chromium via Playwright, Postgres 16).

## Summary
| Milestone | Status | Evidence |
|---|---|---|
| M0 Scaffold & tooling | ✅ | pnpm monorepo, Vite/React/TS strict, Tailwind, ESLint/Prettier, Vitest, Playwright, GitHub Actions (`.github/workflows/ci.yml`) |
| M1 Backend, auth, onboarding | ✅ code / ⏳ live project | Migrations for every §4.4 table + RLS (`supabase/migrations`), RLS tests pass on Postgres 16. Email OTP + Google sign-in screens, 7-country onboarding (wave 3 "coming soon"), profile, sign-out, delete account. **Needs Checkpoint A** to run against a real Supabase project |
| M2 Content pipeline & offline | ✅ | validate / import / bundle scripts, Dexie storage, PWA service worker, offline e2e, sync queue tested by going offline then online |
| M3 Calculation engine | ✅ | `packages/calc`: **100% line coverage**, 97.6% branch. 18 calc templates, each generated 300× in tests. Step-reveal practice screen |
| M4 Study, quiz, analytics | ✅ | Competence progress, quiz builder, confidence ratings, MCQ explanations and sources, written self-marking, weak-area analytics, lessons, content reports |
| M5 Mocks & SRS | ✅ | Practice-format mock with banner, timer, flags, competence results, fully offline. SM-2 with confidence weighting |
| M6 AI grading & oral examiner | ✅ code / ⏳ key | `grade-answer` and `oral-examiner` Edge Functions (Claude, structured outputs, retry, grounding, quotas, budget cap, usage log), versioned prompts, mocked-model unit tests. Text + voice oral (offline engine e2e-tested; AI engine needs **Checkpoint B**). No secrets in build (`pnpm secrets:check`) |
| M7 COLREGs, trackers, updates | ✅ | 20 scenarios in an SVG player (day/night/fog), sea-time tracker (overlap-safe), certificate expiry, regulation update feed flagging items, booking guide pages |
| M8 Payments, tiers, admin, native | ✅ code / ⏳ keys | `PaymentProvider` + Paystack inline + signed webhook → `subscriptions`, tiers enforced server-side (quotas/RLS), paywall, restore, reviewer/admin queue with export/apply. Capacitor config. **Needs Checkpoint C** and an Android SDK for the AAB |
| M9 Hardening | ✅ mostly | Route code-splitting, 129 KB gz initial load (170 KB budget in CI), axe checks with no serious violations on 8 screens, i18n scaffold (en + ar/fil stubs, RTL), data export/deletion, analytics events, production content gate, RUNBOOK. Lighthouse not run in the sandbox |

## Verify results (latest run)
```
pnpm content:validate   → 47 files · 289 items · 20 scenarios · 7 configs · ✓ All content valid
                          by type: mcq 182 · oral 69 · calc 18 · written 9 · lesson 11 (all draft)
pnpm lint               → ✓ (0 problems)
pnpm typecheck          → ✓
pnpm test               → 17 files · 262 tests passed
                          calc coverage: lines 100% · branches 97.56%
                          content quality: every oral model answer ≥ 80% on own key points; 18 calc templates × 300 seeds
pnpm build              → ✓ PWA (48 precache entries)
pnpm size:check         → initial load 129.3 KB gz (budget 170) ✓
pnpm secrets:check      → ✓ no secrets in apps/web/dist
pnpm test:rls           → 289 items imported · RLS TESTS PASSED (B cannot read/insert A's attempts, cannot self-grant subscription, drafts hidden in prod)
pnpm e2e                → 21 passed (mobile Chromium / Pixel 7 profile):
                          smoke · onboarding (Nigeria → dashboard) · offline reload + quiz + sync-on-reconnect ·
                          offline lessons/COLREG · 20-question quiz → analytics + report + SRS · written self-mark ·
                          5 randomised free-surface calcs with worked steps · full 50-question mock offline ·
                          10-question UK-persona oral with debrief · voice push-to-talk (stubbed Web Speech) ·
                          sea-time totals · regulation update flags items · reviewer approval · axe ×8
pnpm content:import     → dry run wrote supabase/seed-content.sql (no Supabase keys yet)
pnpm content:gate       → ✓ paid bundles contain reviewed items only (currently 0 reviewed → prod bundles empty)
```

## Waiting on you (checkpoints)
- **A:** Supabase project URL + anon key (+ service role key for local import only), Google OAuth client, app name and brand colours (neutral defaults are in use).
- **B:** Anthropic API key (set as a Supabase secret `ANTHROPIC_API_KEY`), monthly AI budget (`AI_MONTHLY_BUDGET_USD`), approval of the examiner persona tone per country.
- **C:** Paystack keys and business details, final prices per country and tier, web-only payments vs app-store billing.
- **D (pre-launch):** expert review of the question bank. 0 of 289 items are reviewed, so production bundles are empty by design. Confirm every country's exam format, pass marks, fees and eligibility (`CONTENT_TODO.md`), plus `LEGAL_TODO.md`.

# Runbook

## Local development
```bash
pnpm install
pnpm dev                 # builds content bundles, serves the PWA on :5173 (local-only mode)
pnpm ci:all              # every check: validate, lint, typecheck, unit, build, size, secrets, e2e, import, gate
pnpm test:rls            # throwaway Postgres + migrations + RLS tests (needs postgresql installed)
```

## Environment
Client (`apps/web/.env`, public values only): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_CONTENT_MODE=prod|dev`.
Server (Supabase secrets, **never** in the client): `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD`, `PAYSTACK_SECRET_KEY`, `CONTENT_MODE`.
Scripts: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` for `pnpm content:import`.

## Deploy
1. `supabase link --project-ref <ref>` → `supabase db push` (migrations) → `psql ... -f supabase/seed.sql`.
2. `supabase secrets set ANTHROPIC_API_KEY=... AI_MONTHLY_BUDGET_USD=50 PAYSTACK_SECRET_KEY=...`
3. `supabase functions deploy grade-answer oral-examiner payments-webhook`. Set the Paystack webhook URL to `/functions/v1/payments-webhook`.
4. Database setting for the production content gate: `alter database postgres set app.content_mode = 'prod';`
5. Add admins: `insert into public.admins (user_id) values ('<uuid>');`
6. Content: `pnpm content:validate && SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm content:import`
7. Web: `VITE_CONTENT_MODE=prod pnpm build` (runs `content:bundle` in prod mode, reviewed items only) → deploy `apps/web/dist` to any static host with SPA fallback to `index.html`. Serve `/bundles/*.gz` with long cache headers. The app copes with or without `Content-Encoding`.

## Rotate keys
- Anthropic / Paystack secret: `supabase secrets set ...` then redeploy functions. Revoke the old key in the provider console.
- Supabase anon key: rotate in the dashboard, rebuild the web app with the new `VITE_SUPABASE_ANON_KEY`.
- Service role key: rotate in the dashboard. It is only used by CI/import scripts and Edge Functions (auto-injected).

## Content release
Reviewers export decisions → `pnpm content:apply-reviews file.json` → `pnpm content:validate && pnpm test` → commit → `pnpm content:import` → rebuild web. Each bundle is content-hashed, so devices download the new pack automatically next time they're online.

## Roll back
- Web: redeploy the previous `dist` (the service worker auto-updates).
- Content: `git revert` the content commit, re-import, rebuild.
- DB: write a forward migration that reverses the change (don't edit applied migrations). Restore from Supabase PITR for data loss.
- Functions: `supabase functions deploy <name>` from the previous commit.

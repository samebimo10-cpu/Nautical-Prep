-- Chief Mate Prep — initial schema (spec §4.4). RLS on every table.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- helpers
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Production content gate: when app.content_mode = 'prod', non-admins only see reviewed items.
create or replace function public.content_mode() returns text
language sql stable as $$ select coalesce(current_setting('app.content_mode', true), 'prod') $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  country text not null check (country in ('ph','ng','uk','gh','sg','au','eg')),
  target_exam_date date,
  rank text,
  locale text not null default 'en',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- content
create table public.items (
  id text primary key,
  type text not null check (type in ('mcq','written','calc','oral','lesson')),
  competence text not null check (competence in ('NAV','STAB','CARGO','COLREG','LAW','MGMT','LOCAL')),
  topic text not null,
  countries text[] not null,
  difficulty smallint not null check (difficulty between 1 and 3),
  status text not null check (status in ('draft','reviewed','retired')),
  needs_review boolean not null default true,
  last_reviewed date,
  reviewer text,
  body jsonb not null,           -- full validated item (content-schema)
  updated_at timestamptz not null default now()
);
create index items_competence_idx on public.items (competence, type);

create table public.country_configs (
  code text primary key,
  config jsonb not null,
  status text not null default 'draft',
  updated_at timestamptz not null default now()
);

create table public.colreg_scenarios (
  id text primary key,
  body jsonb not null,
  status text not null default 'draft',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- learner data
create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  answer jsonb,
  score real not null check (score between 0 and 1),
  time_ms integer not null default 0,
  local_id bigint,
  created_at timestamptz not null default now()
);
create index attempts_user_idx on public.attempts (user_id, created_at desc);

create table public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  country text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  score real,
  passed boolean,
  item_ids text[] not null default '{}'
);

create table public.oral_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  country text not null,
  transcript jsonb not null default '[]',
  rubric_scores jsonb not null default '[]',
  state jsonb,                   -- server-side examiner state for the AI engine
  verdict text,
  created_at timestamptz not null default now()
);

create table public.srs_cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  ease real not null default 2.5,
  interval_days integer not null default 0,
  due_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table public.sea_service (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  vessel text not null,
  vessel_type text,
  grt integer,
  from_date date not null,
  to_date date not null check (to_date >= from_date),
  capacity text not null
);

create table public.certificates (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  course text not null,
  issued_at date,
  expires_at date,
  file_path text
);

create table public.subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  tier text not null check (tier in ('free','pro','pro_oral')),
  country text not null,
  provider text not null,
  provider_ref text unique,
  status text not null check (status in ('active','cancelled','expired','pending')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, country)
);

create table public.content_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','triaged','fixed','rejected')),
  created_at timestamptz not null default now()
);

create table public.regulation_updates (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  item_ids text[] not null default '{}',
  published_at timestamptz not null default now()
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  props jsonb not null default '{}',
  at timestamptz not null default now()
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('grade','oral_turn','explain')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10,5) not null default 0,
  low_confidence boolean not null default false,
  created_at timestamptz not null default now()
);
create index ai_usage_user_day_idx on public.ai_usage (user_id, created_at);

-- ---------------------------------------------------------------- RLS
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.country_configs enable row level security;
alter table public.colreg_scenarios enable row level security;
alter table public.attempts enable row level security;
alter table public.mock_exams enable row level security;
alter table public.oral_sessions enable row level security;
alter table public.srs_cards enable row level security;
alter table public.sea_service enable row level security;
alter table public.certificates enable row level security;
alter table public.subscriptions enable row level security;
alter table public.content_reports enable row level security;
alter table public.regulation_updates enable row level security;
alter table public.analytics_events enable row level security;
alter table public.ai_usage enable row level security;

create policy admins_self on public.admins for select using (user_id = auth.uid());

-- own-row tables
create policy profiles_own on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy attempts_own on public.attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mocks_own on public.mock_exams for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy orals_own on public.oral_sessions for select using (user_id = auth.uid());
create policy orals_insert on public.oral_sessions for insert with check (user_id = auth.uid());
create policy srs_own on public.srs_cards for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sea_own on public.sea_service for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy certs_own on public.certificates for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reports_insert on public.content_reports for insert with check (user_id = auth.uid());
create policy reports_read on public.content_reports for select using (user_id = auth.uid() or public.is_admin());
create policy reports_admin on public.content_reports for update using (public.is_admin());
create policy events_insert on public.analytics_events for insert with check (user_id = auth.uid());
create policy events_admin on public.analytics_events for select using (public.is_admin());
create policy usage_read on public.ai_usage for select using (user_id = auth.uid() or public.is_admin());
-- subscriptions: read own; writes only via service role (payments webhook)
create policy subs_read on public.subscriptions for select using (user_id = auth.uid());

-- content: reviewed-only for non-admins in prod
create policy items_read on public.items for select using (
  public.is_admin() or status = 'reviewed' or (public.content_mode() = 'dev' and status <> 'retired')
);
create policy items_admin on public.items for all using (public.is_admin()) with check (public.is_admin());
create policy configs_read on public.country_configs for select using (true);
create policy configs_admin on public.country_configs for all using (public.is_admin()) with check (public.is_admin());
create policy scen_read on public.colreg_scenarios for select using (public.is_admin() or status = 'reviewed' or public.content_mode() = 'dev');
create policy scen_admin on public.colreg_scenarios for all using (public.is_admin()) with check (public.is_admin());
create policy updates_read on public.regulation_updates for select using (true);
create policy updates_admin on public.regulation_updates for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- account deletion
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();   -- cascades to every user table
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------- entitlements (server-side tier)
create or replace function public.current_tier(p_country text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select tier from public.subscriptions
                   where user_id = auth.uid() and country = p_country and status = 'active'
                     and (current_period_end is null or current_period_end > now())), 'free');
$$;

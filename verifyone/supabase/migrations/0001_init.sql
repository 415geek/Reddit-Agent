-- VerifyOne — initial schema (Phase 1 target; applied when Supabase is connected)
-- Auth users live in auth.users (Supabase Auth). All app tables reference auth.uid().

-- ── Users & credits ──────────────────────────────────────────────────────────

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  aup_accepted_at timestamptz,
  aup_version text,
  created_at timestamptz not null default now()
);

create table public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,                       -- positive = grant/refund, negative = spend
  reason text not null,                         -- 'signup_grant' | 'search' | 'refund' | 'admin_grant' | 'purchase'
  search_id uuid,
  created_at timestamptz not null default now()
);

-- ── Searches & provider calls ────────────────────────────────────────────────

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_type text not null check (input_type in ('phone', 'email', 'address')),
  input_raw text not null,
  input_normalized text not null,
  input_details jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'complete', 'partial', 'failed')),
  total_credits integer not null default 0,
  overall_confidence text,
  created_at timestamptz not null default now()
);
create index searches_user_created_idx on public.searches (user_id, created_at desc);
create index searches_normalized_idx on public.searches (input_type, input_normalized);

create table public.provider_requests (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches(id) on delete cascade,
  provider text not null,
  endpoint text,
  status text not null check (status in ('ok', 'no_match', 'error', 'skipped', 'mock')),
  cost_credits integer not null default 0,
  cost_usd numeric(10,4) not null default 0,    -- actual vendor cost for budget tracking
  cache_hit boolean not null default false,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now()
);
create index provider_requests_search_idx on public.provider_requests (search_id);
create index provider_requests_provider_day_idx on public.provider_requests (provider, created_at);

-- Raw vendor payloads: retention-limited, admin-only, encrypted at rest by Supabase.
create table public.provider_responses (
  id uuid primary key default gen_random_uuid(),
  provider_request_id uuid not null references public.provider_requests(id) on delete cascade,
  raw jsonb not null,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

-- ── Resolved entities (normalized report data) ───────────────────────────────

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches(id) on delete cascade,
  profile jsonb not null,                       -- UnifiedProfile as JSON, field-level sources inline
  created_at timestamptz not null default now()
);
create index entities_search_idx on public.entities (search_id);

-- Provider response cache shared across users (keyed on normalized input, no user data).
create table public.provider_cache (
  cache_key text primary key,                   -- '<provider>:<type>:<normalized>'
  result jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index provider_cache_expiry_idx on public.provider_cache (expires_at);

-- ── User workspace ───────────────────────────────────────────────────────────

create table public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  search_id uuid not null references public.searches(id) on delete cascade,
  note text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, search_id)
);

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('search_history', 'account', 'ccpa_opt_out', 'subject_opt_out')),
  detail text,
  status text not null default 'open' check (status in ('open', 'done', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.user_profiles enable row level security;
alter table public.credit_balances enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.searches enable row level security;
alter table public.provider_requests enable row level security;
alter table public.provider_responses enable row level security;
alter table public.entities enable row level security;
alter table public.provider_cache enable row level security;
alter table public.saved_reports enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.audit_logs enable row level security;

create policy "own profile" on public.user_profiles
  for select using (auth.uid() = id);
create policy "update own profile" on public.user_profiles
  for update using (auth.uid() = id);

create policy "own balance" on public.credit_balances
  for select using (auth.uid() = user_id);

create policy "own transactions" on public.credit_transactions
  for select using (auth.uid() = user_id);

create policy "own searches" on public.searches
  for select using (auth.uid() = user_id);
create policy "insert own searches" on public.searches
  for insert with check (auth.uid() = user_id);

create policy "own provider runs" on public.provider_requests
  for select using (
    exists (select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid())
  );

-- provider_responses: no user-facing policy — service role only (raw payloads).
-- provider_cache: no user-facing policy — service role only.
-- audit_logs: no user-facing policy — service role / admin dashboards only.

create policy "own entities" on public.entities
  for select using (
    exists (select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid())
  );

create policy "own saved reports" on public.saved_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own deletion requests" on public.deletion_requests
  for select using (auth.uid() = user_id);
create policy "create deletion requests" on public.deletion_requests
  for insert with check (auth.uid() = user_id);

-- ── Signup: profile + starter credits ────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id) values (new.id);
  insert into public.credit_balances (user_id, balance) values (new.id, 20);
  insert into public.credit_transactions (user_id, delta, reason)
    values (new.id, 20, 'signup_grant');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

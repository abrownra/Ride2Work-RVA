-- Differential Module: surcharge rules table + trips column

create table if not exists public.differential_rules (
  id          uuid primary key default gen_random_uuid(),
  name        text    not null,
  time_start  time,               -- null = no time condition
  time_end    time,               -- null = no time condition
  days        int[],              -- null = any day; 0=Sun, 1=Mon ... 6=Sat
  surcharge   numeric not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- RLS: admins (authenticated) can manage rules; anon can read active rules (needed by driver PWA)
alter table public.differential_rules enable row level security;

create policy "Anon read active rules"
  on public.differential_rules for select
  using (active = true);

create policy "Admins full access"
  on public.differential_rules for all
  to authenticated
  using (true)
  with check (true);

-- Snapshot differential surcharge per rider on each completed trip
alter table public.trips
  add column if not exists rate_differential numeric not null default 0;

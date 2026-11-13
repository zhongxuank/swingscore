-- Swingscore: contests and rounds, visible only to the organiser who owns them.
-- Run this once in the Supabase SQL editor.

create type round_stage as enum ('prelim', 'quarter_final', 'semi_final', 'final');
create type round_kind as enum ('callback', 'final');
create type round_status as enum ('setup', 'scoring', 'complete');

create table contests (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references contests (id) on delete cascade,
  position integer not null check (position >= 1),
  stage round_stage not null,
  kind round_kind not null,
  status round_status not null default 'setup',
  yes_count integer check (yes_count >= 0),
  alt_count integer check (alt_count >= 0),
  max_per_heat integer check (max_per_heat >= 1),
  chief_judge_counts boolean not null default false,
  created_at timestamptz not null default now(),
  unique (contest_id, position),
  unique (contest_id, stage),
  -- Only the final is a final-kind round, and a final has no yes, alternate or heat settings.
  check ((stage = 'final') = (kind = 'final')),
  check (kind = 'callback' or (yes_count is null and alt_count is null and max_per_heat is null))
);

create index contests_organiser_idx on contests (organiser_id, created_at desc);
create index rounds_contest_idx on rounds (contest_id, position);

alter table contests enable row level security;
alter table rounds enable row level security;

create policy "organiser reads own contests" on contests
  for select to authenticated using (organiser_id = auth.uid());
create policy "organiser creates own contests" on contests
  for insert to authenticated with check (organiser_id = auth.uid());
create policy "organiser updates own contests" on contests
  for update to authenticated using (organiser_id = auth.uid()) with check (organiser_id = auth.uid());

create policy "organiser reads rounds of own contests" on rounds
  for select to authenticated
  using (exists (select 1 from contests c where c.id = rounds.contest_id and c.organiser_id = auth.uid()));
create policy "organiser adds rounds to own contests" on rounds
  for insert to authenticated
  with check (exists (select 1 from contests c where c.id = rounds.contest_id and c.organiser_id = auth.uid()));
create policy "organiser updates rounds of own contests" on rounds
  for update to authenticated
  using (exists (select 1 from contests c where c.id = rounds.contest_id and c.organiser_id = auth.uid()))
  with check (exists (select 1 from contests c where c.id = rounds.contest_id and c.organiser_id = auth.uid()));

-- No delete policies: contests are archived, never deleted, from the app.

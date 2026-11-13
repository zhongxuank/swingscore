-- Swingscore: competitors, round panels and heats, visible only to the organiser who owns the contest.
-- Run this once in the Supabase SQL editor, after 20261113090000_contests_and_rounds.sql.
-- Names avoid the old app's tables (competitors, judges, heats), which may still be in the project.

create type contest_dancer_role as enum ('leader', 'follower');
create type round_judge_assignment as enum ('leaders', 'followers', 'both');

-- Everyone signed up for a contest. A bib is unique within the contest.
create table contest_competitors (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references contests (id) on delete cascade,
  bib text not null check (bib ~ '^[0-9A-Za-z-]{1,12}$'),
  role contest_dancer_role not null,
  name text not null default '',
  created_at timestamptz not null default now(),
  unique (contest_id, bib)
);

-- A round's panel. At most one chief judge per round; the chief judge judges both roles.
create table round_judges (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  assignment round_judge_assignment not null,
  is_chief boolean not null default false,
  created_at timestamptz not null default now(),
  check (not is_chief or assignment = 'both')
);

create unique index round_judges_one_chief on round_judges (round_id) where is_chief;
create index round_judges_round_idx on round_judges (round_id, created_at);

-- The saved heats of a callback round, one row per dancer on the floor. Redancers are not judged.
create table round_heat_slots (
  round_id uuid not null references rounds (id) on delete cascade,
  role contest_dancer_role not null,
  heat_number integer not null check (heat_number >= 1),
  slot integer not null check (slot >= 1),
  competitor_id uuid not null references contest_competitors (id) on delete cascade,
  redancer boolean not null default false,
  primary key (round_id, role, heat_number, slot)
);

create index contest_competitors_contest_idx on contest_competitors (contest_id);

alter table contest_competitors enable row level security;
alter table round_judges enable row level security;
alter table round_heat_slots enable row level security;

-- True when the signed-in user owns the contest. Used by every policy below.
create function owns_contest(target uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from contests c where c.id = target and c.organiser_id = auth.uid());
$$;

create function owns_round(target uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from rounds r join contests c on c.id = r.contest_id
    where r.id = target and c.organiser_id = auth.uid()
  );
$$;

create policy "organiser manages competitors" on contest_competitors
  for all to authenticated using (owns_contest(contest_id)) with check (owns_contest(contest_id));

create policy "organiser manages panels" on round_judges
  for all to authenticated using (owns_round(round_id)) with check (owns_round(round_id));

create policy "organiser manages heats" on round_heat_slots
  for all to authenticated
  using (owns_round(round_id))
  with check (
    owns_round(round_id)
    and exists (
      select 1 from contest_competitors cc join rounds r on r.contest_id = cc.contest_id
      where cc.id = round_heat_slots.competitor_id and r.id = round_heat_slots.round_id and cc.role = round_heat_slots.role
    )
  );

-- Replaces a round's heats in one step, so a failed save never leaves half the old heats.
-- slots is a JSON array of {role, heat_number, slot, competitor_id, redancer}.
create function replace_round_heats(target_round uuid, slots jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not owns_round(target_round) then
    raise exception 'Round % not found.', target_round using errcode = 'P0002';
  end if;
  delete from round_heat_slots where round_id = target_round;
  insert into round_heat_slots (round_id, role, heat_number, slot, competitor_id, redancer)
  select target_round, s.role, s.heat_number, s.slot, s.competitor_id, s.redancer
  from jsonb_to_recordset(slots) as s(role contest_dancer_role, heat_number integer, slot integer, competitor_id uuid, redancer boolean);
end;
$$;

grant execute on function owns_contest(uuid), owns_round(uuid), replace_round_heats(uuid, jsonb) to authenticated;

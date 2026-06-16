create extension if not exists "pgcrypto";

create type competition_kind as enum ('contest');
create type competition_status as enum ('draft', 'running', 'finalized');
create type round_stage as enum ('prelim', 'quarter_final', 'semi_final', 'final');
create type scoring_method as enum ('callback', 'relative_placement');
create type round_status as enum ('draft', 'running', 'finalized');
create type dancer_role as enum ('Leader', 'Follower');
create type judge_assignment_role as enum ('leaders', 'followers', 'both');
create type chief_judge_mode as enum ('none', 'tiebreak_only', 'full_panel');
create type access_role as enum ('admin', 'judge', 'chief', 'emcee');

create table competitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id),
  name text not null,
  division text not null,
  kind competition_kind not null,
  status competition_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz,
  archived_at timestamptz
);

create table competition_rounds (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  name text not null,
  stage round_stage not null default 'prelim',
  scoring_method scoring_method not null default 'callback',
  status round_status not null default 'draft',
  round_order integer not null default 1 check (round_order > 0),
  source_round_id uuid references competition_rounds(id) on delete set null,
  required_yeses integer not null default 12 check (required_yeses >= 0),
  required_alts integer not null default 3 check (required_alts between 0 and 3),
  advancement_count integer not null default 24 check (advancement_count >= 0),
  leader_chief_judge_mode chief_judge_mode not null default 'tiebreak_only',
  follower_chief_judge_mode chief_judge_mode not null default 'tiebreak_only',
  chief_judge_counts_for_final boolean not null default false,
  alt_profile jsonb not null default '{"yes":10,"alt1":4.5,"alt2":4.3,"alt3":4.2,"no":0}'::jsonb,
  started_at timestamptz,
  setup_locked_at timestamptz,
  finalized_at timestamptz,
  setup_snapshot jsonb not null default '{}'::jsonb,
  unique (competition_id, round_order)
);

create table competitors (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  bib_number text not null,
  preferred_name text not null,
  role dancer_role not null,
  legal_first_name text,
  legal_last_name text,
  is_filler boolean not null default false,
  unique (competition_id, bib_number)
);

create table judges (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  display_name text not null,
  role_assignment judge_assignment_role not null default 'both',
  is_chief_judge boolean not null default false
);

create table judge_assignments (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references competition_rounds(id) on delete cascade,
  judge_id uuid not null references judges(id) on delete cascade,
  role_assignment judge_assignment_role not null default 'both',
  unique (round_id, judge_id)
);

create table heats (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references competition_rounds(id) on delete cascade,
  heat_number integer not null,
  competitor_id uuid not null references competitors(id) on delete cascade,
  partner_competitor_id uuid references competitors(id) on delete set null,
  is_filler boolean not null default false,
  unique (round_id, heat_number, competitor_id)
);

create table couples (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  leader_id uuid not null references competitors(id) on delete cascade,
  follower_id uuid references competitors(id) on delete set null,
  dance_order integer not null,
  unique (competition_id, leader_id),
  unique (competition_id, follower_id)
);

create table pairings (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  rotation_number integer not null default 1,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table score_entries (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references competition_rounds(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  judge_id uuid not null references judges(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete cascade,
  couple_id uuid references couples(id) on delete cascade,
  role dancer_role,
  score_x2 integer not null default 0 check (score_x2 = 0 or score_x2 between 2 and 200),
  is_chief_judge boolean not null default false,
  draft boolean not null default true,
  updated_at timestamptz not null default now(),
  check ((competitor_id is not null and couple_id is null) or (competitor_id is null and couple_id is not null))
);

create table judge_submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references competition_rounds(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  judge_id uuid not null references judges(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  validation_snapshot jsonb not null default '{}'::jsonb,
  unique (round_id, competition_id, judge_id)
);

create table advancement_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references competition_rounds(id) on delete cascade,
  role dancer_role not null,
  snapshot jsonb not null,
  finalized_by uuid references auth.users(id),
  finalized_at timestamptz not null default now()
);

create table final_placements (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  snapshot jsonb not null,
  finalized_by uuid references auth.users(id),
  finalized_at timestamptz not null default now()
);

create table emcee_announcements (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  title text not null,
  body jsonb not null,
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);

create table access_links (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  round_id uuid references competition_rounds(id) on delete cascade,
  judge_id uuid references judges(id) on delete cascade,
  role access_role not null,
  token_hash text not null unique,
  label text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table result_exports (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  export_type text not null,
  format text not null,
  payload jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references competitions(id) on delete cascade,
  actor_id uuid references auth.users(id),
  actor_label text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table competitions enable row level security;
alter table competition_rounds enable row level security;
alter table competitors enable row level security;
alter table judges enable row level security;
alter table judge_assignments enable row level security;
alter table heats enable row level security;
alter table couples enable row level security;
alter table pairings enable row level security;
alter table score_entries enable row level security;
alter table judge_submissions enable row level security;
alter table advancement_results enable row level security;
alter table final_placements enable row level security;
alter table emcee_announcements enable row level security;
alter table access_links enable row level security;
alter table result_exports enable row level security;
alter table audit_events enable row level security;

create policy "owners manage competitions" on competitions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owners read child records" on competition_rounds
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners manage competitors" on competitors
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners manage judges" on judges
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners manage judge assignments" on judge_assignments
  for all using (
    exists (
      select 1
      from competition_rounds r
      join competitions c on c.id = r.competition_id
      where r.id = round_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from competition_rounds r
      join competitions c on c.id = r.competition_id
      where r.id = round_id and c.owner_id = auth.uid()
    )
  );

create policy "owners manage heats" on heats
  for all using (
    exists (
      select 1
      from competition_rounds r
      join competitions c on c.id = r.competition_id
      where r.id = round_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from competition_rounds r
      join competitions c on c.id = r.competition_id
      where r.id = round_id and c.owner_id = auth.uid()
    )
  );

create policy "owners manage couples" on couples
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners manage pairings" on pairings
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners manage scores" on score_entries
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners manage submissions" on judge_submissions
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners manage advancement results" on advancement_results
  for all using (
    exists (
      select 1
      from competition_rounds r
      join competitions c on c.id = r.competition_id
      where r.id = round_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from competition_rounds r
      join competitions c on c.id = r.competition_id
      where r.id = round_id and c.owner_id = auth.uid()
    )
  );

create policy "owners manage final placements" on final_placements
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners manage emcee announcements" on emcee_announcements
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners manage access links" on access_links
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners manage exports" on result_exports
  for all using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create policy "owners read audit events" on audit_events
  for select using (exists (select 1 from competitions c where c.id = competition_id and c.owner_id = auth.uid()));

create publication supabase_realtime for table
  score_entries,
  judge_submissions,
  pairings,
  advancement_results,
  final_placements,
  emcee_announcements;

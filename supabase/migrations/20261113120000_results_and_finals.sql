-- Swingscore: chief judge results for callback rounds, finals couples, finals scores and placements,
-- and what the emcee sees. Run this once in the Supabase SQL editor, after 20261113110000_private_links_and_scores.sql.

create type callback_result_status as enum ('advancing', 'alternate', 'out');

-- The chief judge's decision for one role of a callback round: how many advance and how many alternates.
create table round_cuts (
  round_id uuid not null references rounds (id) on delete cascade,
  role contest_dancer_role not null,
  cut integer not null check (cut >= 0),
  alternates integer not null check (alternates between 0 and 3),
  decided_at timestamptz not null default now(),
  primary key (round_id, role)
);

-- The combined ranking stored when the cut is decided. The emcee and the next round read this, never live scores.
create table round_results (
  round_id uuid not null references rounds (id) on delete cascade,
  competitor_id uuid not null references contest_competitors (id) on delete cascade,
  role contest_dancer_role not null,
  rank integer not null check (rank >= 1),
  points_x100 integer not null,
  status callback_result_status not null,
  alternate_order integer check (alternate_order between 1 and 3),
  primary key (round_id, competitor_id),
  check ((status = 'alternate') = (alternate_order is not null))
);

-- Final couples, numbered for the floor. Pairs can change until the first final score is saved.
create table final_couples (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  couple_number integer not null check (couple_number >= 1),
  leader_id uuid not null references contest_competitors (id) on delete cascade,
  follower_id uuid not null references contest_competitors (id) on delete cascade,
  unique (round_id, couple_number),
  unique (round_id, leader_id),
  unique (round_id, follower_id)
);

create table final_scores (
  judge_id uuid not null references round_judges (id) on delete cascade,
  couple_id uuid not null references final_couples (id) on delete cascade,
  round_id uuid not null references rounds (id) on delete cascade,
  tenths integer check (tenths between 0 and 1000),
  client_at timestamptz not null,
  saved_at timestamptz not null default now(),
  primary key (judge_id, couple_id)
);

create table final_submissions (
  judge_id uuid primary key references round_judges (id) on delete cascade,
  round_id uuid not null references rounds (id) on delete cascade,
  submitted_at timestamptz not null default now()
);

-- Final placements as decided by the organiser after Relative Placement (including any tie they settled).
create table final_placements (
  round_id uuid not null references rounds (id) on delete cascade,
  couple_id uuid not null references final_couples (id) on delete cascade,
  place integer not null check (place >= 1),
  decided_at timestamptz not null default now(),
  primary key (round_id, couple_id),
  unique (round_id, place)
);

create index final_scores_round_idx on final_scores (round_id);

alter table round_cuts enable row level security;
alter table round_results enable row level security;
alter table final_couples enable row level security;
alter table final_scores enable row level security;
alter table final_submissions enable row level security;
alter table final_placements enable row level security;

create function final_scoring_started(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from final_scores where round_id = target);
$$;

create policy "organiser reads cuts" on round_cuts for select to authenticated using (owns_round(round_id));
create policy "organiser reopens cuts" on round_cuts for delete to authenticated using (owns_round(round_id));
create policy "organiser reads results" on round_results for select to authenticated using (owns_round(round_id));
create policy "organiser clears results" on round_results for delete to authenticated using (owns_round(round_id));

create policy "organiser reads couples" on final_couples for select to authenticated using (owns_round(round_id));
create policy "organiser adds couples before scoring" on final_couples for insert to authenticated
  with check (owns_round(round_id) and not final_scoring_started(round_id));
create policy "organiser edits couples before scoring" on final_couples for update to authenticated
  using (owns_round(round_id) and not final_scoring_started(round_id))
  with check (owns_round(round_id) and not final_scoring_started(round_id));
create policy "organiser removes couples before scoring" on final_couples for delete to authenticated
  using (owns_round(round_id) and not final_scoring_started(round_id));

create policy "organiser reads final scores" on final_scores for select to authenticated using (owns_round(round_id));
create policy "organiser reads final submissions" on final_submissions for select to authenticated using (owns_round(round_id));
create policy "organiser reopens final sheets" on final_submissions for delete to authenticated using (owns_round(round_id));
create policy "organiser manages placements" on final_placements for all to authenticated
  using (owns_round(round_id)) with check (owns_round(round_id));

-- Replaces a final's couples in one step. couples is a JSON array of {couple_number, leader_id, follower_id}.
create function replace_final_couples(target_round uuid, couples jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not owns_round(target_round) then
    raise exception 'Round % not found.', target_round using errcode = 'P0002';
  end if;
  if final_scoring_started(target_round) then
    raise exception 'Scoring has started, so the couples are fixed.' using errcode = '22023';
  end if;
  delete from final_couples where round_id = target_round;
  insert into final_couples (round_id, couple_number, leader_id, follower_id)
  select target_round, c.couple_number, c.leader_id, c.follower_id
  from jsonb_to_recordset(couples) as c(couple_number integer, leader_id uuid, follower_id uuid);
end;
$$;

-- The chief judge sets how many Yes and Alternate marks each judge gives, before judging.
create function set_callback_counts(token text, yes integer, alternates integer) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  link round_access_links;
  judge round_judges;
  rnd rounds;
begin
  link := link_for_token(token);
  if link.id is null or link.kind <> 'judge' then raise exception 'This link cannot do that.' using errcode = 'P0002'; end if;
  select * into judge from round_judges where id = link.judge_id;
  select * into rnd from rounds where id = link.round_id;
  if not judge.is_chief then raise exception 'Only the chief judge can set the counts.' using errcode = '22023'; end if;
  if rnd.kind <> 'callback' then raise exception 'Only callback rounds have Yes and Alternate counts.' using errcode = '22023'; end if;
  if yes is null or yes < 0 or alternates is null or alternates < 0 then
    raise exception 'Counts must be whole numbers, zero or more.' using errcode = '22023';
  end if;
  update rounds set yes_count = yes, alt_count = alternates where id = rnd.id;
  return 'saved';
end;
$$;

-- Everything the chief judge needs to combine a callback round: the panel, who has submitted, and every score.
create function load_round_scores(token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  link round_access_links;
  judge round_judges;
begin
  link := link_for_token(token);
  if link.id is null or link.kind <> 'judge' then return null; end if;
  select * into judge from round_judges where id = link.judge_id;
  if not judge.is_chief then return null; end if;
  return jsonb_build_object(
    'judges', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'name', j.name, 'assignment', j.assignment, 'isChief', j.is_chief))
      from round_judges j where j.round_id = link.round_id), '[]'::jsonb),
    'submissions', coalesce((select jsonb_agg(jsonb_build_object('judgeId', s.judge_id, 'role', s.role))
      from sheet_submissions s where s.round_id = link.round_id), '[]'::jsonb),
    'scores', coalesce((select jsonb_agg(jsonb_build_object('judgeId', cs.judge_id, 'competitorId', cs.competitor_id, 'tenths', cs.tenths))
      from callback_scores cs where cs.round_id = link.round_id and cs.tenths is not null), '[]'::jsonb),
    'cuts', coalesce((select jsonb_agg(jsonb_build_object('role', c.role, 'cut', c.cut, 'alternates', c.alternates, 'decidedAt', c.decided_at))
      from round_cuts c where c.round_id = link.round_id), '[]'::jsonb)
  );
end;
$$;

-- The chief judge decides the cut for one role. Every judge scoring that role, and the chief judge, must
-- have submitted. results is a JSON array of {competitor_id, rank, points_x100, status, alternate_order},
-- computed on the chief judge's screen from the submitted scores.
create function decide_cut(token text, cut_role contest_dancer_role, cut integer, alternates integer, results jsonb) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  link round_access_links;
  judge round_judges;
  rnd rounds;
  waiting integer;
  bad integer;
  advancing integer;
begin
  link := link_for_token(token);
  if link.id is null or link.kind <> 'judge' then raise exception 'This link cannot do that.' using errcode = 'P0002'; end if;
  select * into judge from round_judges where id = link.judge_id;
  select * into rnd from rounds where id = link.round_id;
  if not judge.is_chief then raise exception 'Only the chief judge can decide the cut.' using errcode = '22023'; end if;
  if rnd.kind <> 'callback' then raise exception 'Only callback rounds have a cut.' using errcode = '22023'; end if;

  select count(*) into waiting from round_judges j
  where j.round_id = rnd.id and cut_role = any (judge_roles(j.assignment))
    and not exists (select 1 from sheet_submissions s where s.judge_id = j.id and s.role = cut_role);
  if waiting > 0 then
    raise exception '% judges have not submitted yet.', waiting using errcode = '22023';
  end if;

  -- Every entry must be a dancer judged in this round, in this role, listed once.
  select count(*) into bad from jsonb_to_recordset(results) as r(competitor_id uuid)
  where not exists (
    select 1 from round_heat_slots s join contest_competitors cc on cc.id = s.competitor_id
    where s.round_id = rnd.id and s.competitor_id = r.competitor_id and not s.redancer and cc.role = cut_role
  );
  if bad > 0 then raise exception 'The results list someone who was not judged in this role.' using errcode = '22023'; end if;
  if (select count(distinct s.competitor_id) from round_heat_slots s join contest_competitors cc on cc.id = s.competitor_id
      where s.round_id = rnd.id and not s.redancer and cc.role = cut_role)
     <> (select count(distinct r.competitor_id) from jsonb_to_recordset(results) as r(competitor_id uuid))
     or jsonb_array_length(results) <> (select count(distinct r.competitor_id) from jsonb_to_recordset(results) as r(competitor_id uuid)) then
    raise exception 'The results must list every judged dancer once.' using errcode = '22023';
  end if;
  select count(*) into advancing from jsonb_to_recordset(results) as r(status callback_result_status) where r.status = 'advancing';
  if advancing <> cut then raise exception 'The cut does not match the results.' using errcode = '22023'; end if;

  delete from round_results where round_id = rnd.id and role = cut_role;
  insert into round_results (round_id, competitor_id, role, rank, points_x100, status, alternate_order)
  select rnd.id, r.competitor_id, cut_role, r.rank, r.points_x100, r.status, r.alternate_order
  from jsonb_to_recordset(results) as r(competitor_id uuid, rank integer, points_x100 integer, status callback_result_status, alternate_order integer);

  insert into round_cuts (round_id, role, cut, alternates) values (rnd.id, cut_role, cut, alternates)
  on conflict (round_id, role) do update set cut = excluded.cut, alternates = excluded.alternates, decided_at = now();

  if (select count(*) from round_cuts where round_id = rnd.id) = 2 then
    update rounds set status = 'complete' where id = rnd.id;
  end if;
  return 'decided';
end;
$$;

-- A judge's raw score for one final couple. Same rules as callback scores: order-safe and blocked after submit.
create function save_final_score(token text, couple uuid, score integer, changed_at timestamptz) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  link round_access_links;
  rnd rounds;
begin
  link := link_for_token(token);
  if link.id is null or link.kind <> 'judge' then raise exception 'This link cannot score.' using errcode = 'P0002'; end if;
  select * into rnd from rounds where id = link.round_id;
  if rnd.kind <> 'final' then raise exception 'This round is not a final.' using errcode = '22023'; end if;
  if rnd.status = 'complete' then raise exception 'This round is finished.' using errcode = '22023'; end if;
  if score is not null and (score < 0 or score > 1000) then raise exception 'Scores run from 0.0 to 100.0.' using errcode = '22023'; end if;
  if not exists (select 1 from final_couples where id = couple and round_id = rnd.id) then
    raise exception 'That couple is not in this final.' using errcode = '22023';
  end if;
  if exists (select 1 from final_submissions where judge_id = link.judge_id) then
    raise exception 'This sheet is already submitted.' using errcode = '22023';
  end if;
  insert into final_scores (judge_id, couple_id, round_id, tenths, client_at)
  values (link.judge_id, couple, rnd.id, score, changed_at)
  on conflict (judge_id, couple_id) do update
    set tenths = excluded.tenths, client_at = excluded.client_at, saved_at = now()
    where final_scores.client_at <= excluded.client_at;
  return 'saved';
end;
$$;

-- Submits a final sheet: every couple scored and no two equal scores.
create function submit_final_sheet(token text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  link round_access_links;
  missing integer;
  ties integer;
begin
  link := link_for_token(token);
  if link.id is null or link.kind <> 'judge' then raise exception 'This link cannot score.' using errcode = 'P0002'; end if;
  if not exists (select 1 from final_couples where round_id = link.round_id) then
    raise exception 'The couples are not set yet.' using errcode = '22023';
  end if;
  select count(*) into missing from final_couples fc
  where fc.round_id = link.round_id
    and not exists (select 1 from final_scores fs where fs.couple_id = fc.id and fs.judge_id = link.judge_id and fs.tenths is not null);
  if missing > 0 then raise exception '% couples still need a score.', missing using errcode = '22023'; end if;
  select count(*) into ties from (
    select tenths from final_scores where judge_id = link.judge_id and tenths is not null group by tenths having count(*) > 1
  ) t;
  if ties > 0 then raise exception 'Two couples cannot have the same score in a final.' using errcode = '22023'; end if;
  insert into final_submissions (judge_id, round_id) values (link.judge_id, link.round_id) on conflict (judge_id) do nothing;
  return 'submitted';
end;
$$;

-- Replaces load_access from the previous file: adds final couples and scores, and stored results for the emcee.
create or replace function load_access(token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  link round_access_links;
  rnd rounds;
  judge round_judges;
  roles contest_dancer_role[];
begin
  link := link_for_token(token);
  if link.id is null then return null; end if;
  select * into rnd from rounds where id = link.round_id;
  if link.kind = 'judge' then
    select * into judge from round_judges where id = link.judge_id;
  end if;
  if link.kind = 'judge' and rnd.kind = 'callback' then
    roles := judge_roles(judge.assignment);
  else
    roles := array['leader', 'follower']::contest_dancer_role[];
  end if;

  return jsonb_build_object(
    'kind', link.kind,
    'contest', (select jsonb_build_object('id', c.id, 'name', c.name) from contests c where c.id = rnd.contest_id),
    'round', jsonb_build_object(
      'id', rnd.id, 'stage', rnd.stage, 'kind', rnd.kind, 'status', rnd.status, 'position', rnd.position,
      'yesCount', rnd.yes_count, 'altCount', rnd.alt_count, 'maxPerHeat', rnd.max_per_heat,
      'chiefJudgeCounts', rnd.chief_judge_counts
    ),
    'judge', case when judge.id is null then null else jsonb_build_object(
      'id', judge.id, 'name', judge.name, 'assignment', judge.assignment, 'isChief', judge.is_chief
    ) end,
    'roles', to_jsonb(roles),
    'competitors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cc.id, 'bib', cc.bib, 'role', cc.role,
        'name', case when link.kind = 'emcee' then cc.name else '' end
      ))
      from contest_competitors cc where cc.contest_id = rnd.contest_id and cc.role = any (roles)
    ), '[]'::jsonb),
    'heats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', s.role, 'heatNumber', s.heat_number, 'slot', s.slot, 'competitorId', s.competitor_id, 'redancer', s.redancer
      ))
      from round_heat_slots s where s.round_id = rnd.id and s.role = any (roles)
    ), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object('competitorId', cs.competitor_id, 'tenths', cs.tenths, 'clientAt', cs.client_at))
      from callback_scores cs where link.kind = 'judge' and cs.judge_id = link.judge_id and cs.tenths is not null
    ), '[]'::jsonb),
    'submitted', coalesce((
      select jsonb_agg(ss.role) from sheet_submissions ss where link.kind = 'judge' and ss.judge_id = link.judge_id
    ), '[]'::jsonb),
    'couples', coalesce((
      select jsonb_agg(jsonb_build_object('id', fc.id, 'number', fc.couple_number, 'leaderId', fc.leader_id, 'followerId', fc.follower_id) order by fc.couple_number)
      from final_couples fc where fc.round_id = rnd.id
    ), '[]'::jsonb),
    'finalScores', coalesce((
      select jsonb_agg(jsonb_build_object('coupleId', fs.couple_id, 'tenths', fs.tenths, 'clientAt', fs.client_at))
      from final_scores fs where link.kind = 'judge' and fs.judge_id = link.judge_id and fs.tenths is not null
    ), '[]'::jsonb),
    'finalSubmitted', link.kind = 'judge' and exists (select 1 from final_submissions where judge_id = link.judge_id),
    -- Stored results only, and only for the emcee.
    'cuts', case when link.kind = 'emcee' then coalesce((
      select jsonb_agg(jsonb_build_object('role', c.role, 'cut', c.cut, 'alternates', c.alternates)) from round_cuts c where c.round_id = rnd.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'results', case when link.kind = 'emcee' then coalesce((
      select jsonb_agg(jsonb_build_object('competitorId', r.competitor_id, 'role', r.role, 'rank', r.rank, 'status', r.status, 'alternateOrder', r.alternate_order))
      from round_results r where r.round_id = rnd.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'placements', case when link.kind = 'emcee' then coalesce((
      select jsonb_agg(jsonb_build_object('coupleId', p.couple_id, 'place', p.place) order by p.place) from final_placements p where p.round_id = rnd.id
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

revoke all on function final_scoring_started(uuid) from public, anon;
grant execute on function final_scoring_started(uuid) to authenticated;
grant execute on function set_callback_counts(text, integer, integer), load_round_scores(text),
  decide_cut(text, contest_dancer_role, integer, integer, jsonb), save_final_score(text, uuid, integer, timestamptz),
  submit_final_sheet(text), load_access(text) to anon, authenticated;
grant execute on function replace_final_couples(uuid, jsonb) to authenticated;

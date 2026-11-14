-- Swingscore: private links for judges, the chief judge and the emcee, and callback-round scores.
-- Run this once in the Supabase SQL editor, after 20261113100000_competitors_panel_heats.sql.
--
-- People with a private link have no account. They never read tables directly: every read and write goes
-- through the functions below, which take the raw token, hash it, and act only on that link's round and role.
-- Only the SHA-256 hash of a token is stored.

create type access_link_kind as enum ('judge', 'emcee');

create table round_access_links (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  kind access_link_kind not null,
  -- Set for judge links (including the chief judge, who is a judge with is_chief). Null for the emcee.
  judge_id uuid references round_judges (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check ((kind = 'judge') = (judge_id is not null))
);

-- One live link per judge and one emcee link per round. Making a new link replaces the old one.
create unique index round_access_links_one_per_judge on round_access_links (judge_id) where kind = 'judge';
create unique index round_access_links_one_emcee on round_access_links (round_id) where kind = 'emcee';

-- A judge's raw score for one dancer in a callback round. Null tenths means the score was cleared.
-- client_at is when the phone made the change, so a late retry never overwrites a newer score.
create table callback_scores (
  judge_id uuid not null references round_judges (id) on delete cascade,
  competitor_id uuid not null references contest_competitors (id) on delete cascade,
  round_id uuid not null references rounds (id) on delete cascade,
  tenths integer check (tenths between 0 and 1000),
  client_at timestamptz not null,
  saved_at timestamptz not null default now(),
  primary key (judge_id, competitor_id)
);

create index callback_scores_round_idx on callback_scores (round_id);

-- A judge's sheet for one role, once submitted. The organiser can delete it to reopen the sheet.
create table sheet_submissions (
  judge_id uuid not null references round_judges (id) on delete cascade,
  round_id uuid not null references rounds (id) on delete cascade,
  role contest_dancer_role not null,
  submitted_at timestamptz not null default now(),
  primary key (judge_id, role)
);

alter table round_access_links enable row level security;
alter table callback_scores enable row level security;
alter table sheet_submissions enable row level security;

create policy "organiser manages links" on round_access_links
  for all to authenticated using (owns_round(round_id)) with check (owns_round(round_id));
create policy "organiser reads scores" on callback_scores
  for select to authenticated using (owns_round(round_id));
create policy "organiser reads submissions" on sheet_submissions
  for select to authenticated using (owns_round(round_id));
create policy "organiser reopens sheets" on sheet_submissions
  for delete to authenticated using (owns_round(round_id));

-- The link a raw token belongs to, or null. Internal: not callable from the app.
create function link_for_token(token text) returns round_access_links
language sql stable security definer set search_path = public as $$
  select l.* from round_access_links l
  where l.token_hash = encode(sha256(convert_to(coalesce(token, ''), 'UTF8')), 'hex');
$$;
revoke all on function link_for_token(text) from public, anon, authenticated;

-- The roles a judge scores: leaders, followers, or both.
create function judge_roles(assignment round_judge_assignment) returns contest_dancer_role[]
language sql immutable as $$
  select case assignment
    when 'leaders' then array['leader']::contest_dancer_role[]
    when 'followers' then array['follower']::contest_dancer_role[]
    else array['leader', 'follower']::contest_dancer_role[]
  end;
$$;

-- Everything a private link may see, as one JSON document. Null for a wrong token.
-- Judges see bibs only (no names) and only their own scores. The emcee sees names and no scores.
create function load_access(token text) returns jsonb
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
    ), '[]'::jsonb)
  );
end;
$$;

-- Saves or clears one score from a judge link. Safe to resend: an older change never overwrites a newer one.
-- Returns 'saved', or raises with a plain message the sheet can show.
create function save_callback_score(token text, competitor uuid, score integer, changed_at timestamptz) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  link round_access_links;
  rnd rounds;
  judge round_judges;
  dancer contest_competitors;
begin
  link := link_for_token(token);
  if link.id is null or link.kind <> 'judge' then
    raise exception 'This link cannot score.' using errcode = 'P0002';
  end if;
  select * into rnd from rounds where id = link.round_id;
  select * into judge from round_judges where id = link.judge_id;
  if rnd.kind <> 'callback' then raise exception 'This round is not a callback round.' using errcode = '22023'; end if;
  if rnd.status = 'complete' then raise exception 'This round is finished.' using errcode = '22023'; end if;
  if score is not null and (score < 0 or score > 1000) then raise exception 'Scores run from 0.0 to 100.0.' using errcode = '22023'; end if;

  select * into dancer from contest_competitors where id = competitor and contest_id = rnd.contest_id;
  if dancer.id is null or not (dancer.role = any (judge_roles(judge.assignment))) then
    raise exception 'That dancer is not on this sheet.' using errcode = '22023';
  end if;
  if exists (select 1 from sheet_submissions where judge_id = judge.id and role = dancer.role) then
    raise exception 'This sheet is already submitted.' using errcode = '22023';
  end if;

  insert into callback_scores (judge_id, competitor_id, round_id, tenths, client_at)
  values (judge.id, dancer.id, rnd.id, score, changed_at)
  on conflict (judge_id, competitor_id) do update
    set tenths = excluded.tenths, client_at = excluded.client_at, saved_at = now()
    where callback_scores.client_at <= excluded.client_at;
  return 'saved';
end;
$$;

-- Submits a judge's sheet for one role. Every dancer on the floor for that role (not counting redance
-- slots) needs a score, and the chief judge's scores must not tie.
create function submit_callback_sheet(token text, sheet_role contest_dancer_role) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  link round_access_links;
  judge round_judges;
  missing integer;
  ties integer;
begin
  link := link_for_token(token);
  if link.id is null or link.kind <> 'judge' then
    raise exception 'This link cannot score.' using errcode = 'P0002';
  end if;
  select * into judge from round_judges where id = link.judge_id;
  if not (sheet_role = any (judge_roles(judge.assignment))) then
    raise exception 'This judge does not score that role.' using errcode = '22023';
  end if;

  if not exists (select 1 from round_heat_slots where round_id = link.round_id) then
    raise exception 'Heats are not built yet.' using errcode = '22023';
  end if;

  select count(*) into missing
  from contest_competitors cc
  join rounds r on r.contest_id = cc.contest_id and r.id = link.round_id
  where cc.role = sheet_role
    and exists (select 1 from round_heat_slots s where s.round_id = r.id and s.competitor_id = cc.id and not s.redancer)
    and not exists (select 1 from callback_scores cs where cs.judge_id = judge.id and cs.competitor_id = cc.id and cs.tenths is not null);
  if missing > 0 then
    raise exception '% dancers still need a score.', missing using errcode = '22023';
  end if;

  if judge.is_chief then
    select count(*) into ties from (
      select cs.tenths from callback_scores cs join contest_competitors cc on cc.id = cs.competitor_id
      where cs.judge_id = judge.id and cc.role = sheet_role and cs.tenths is not null
      group by cs.tenths having count(*) > 1
    ) t;
    if ties > 0 then
      raise exception 'Chief judge scores cannot tie. Change the equal scores first.' using errcode = '22023';
    end if;
  end if;

  insert into sheet_submissions (judge_id, round_id, role) values (judge.id, link.round_id, sheet_role)
  on conflict (judge_id, role) do nothing;
  return 'submitted';
end;
$$;

grant execute on function load_access(text), save_callback_score(text, uuid, integer, timestamptz), submit_callback_sheet(text, contest_dancer_role)
  to anon, authenticated;
grant execute on function judge_roles(round_judge_assignment) to anon, authenticated;

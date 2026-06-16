insert into competitions (id, name, division, kind, status)
values ('00000000-0000-0000-0000-000000000101', 'Novice Jack and Jill', 'Novice', 'contest', 'running')
on conflict do nothing;

insert into competition_rounds (
  id,
  competition_id,
  name,
  stage,
  scoring_method,
  status,
  round_order,
  required_yeses,
  required_alts,
  advancement_count,
  leader_chief_judge_mode,
  follower_chief_judge_mode
) values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  'Prelims',
  'prelim',
  'callback',
  'running',
  1,
  4,
  3,
  6,
  'tiebreak_only',
  'tiebreak_only'
) on conflict do nothing;

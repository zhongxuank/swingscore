insert into competitions (id, name, division, kind, status)
values ('00000000-0000-0000-0000-000000000101', 'SwingScore Live Alpha', 'Novice Jack and Jill', 'prelims', 'running')
on conflict do nothing;

insert into competition_rounds (
  id,
  competition_id,
  name,
  required_yeses,
  required_alts,
  advancement_count,
  leader_chief_judge_mode,
  follower_chief_judge_mode
) values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  'Prelims',
  4,
  3,
  6,
  'tiebreak_only',
  'tiebreak_only'
) on conflict do nothing;

# SwingScore

SwingScore is a West Coast Swing contest scoring system. The Beta setup model treats a contest as the division-level container and runs Prelim, Semi-Final, and Final stages as separate rounds with their own judges, setup locks, scoring rules, and result snapshots.

For the current implementation status, handoff notes, limitations, and Beta roadmap, see [`docs/BETA_HANDOFF.md`](docs/BETA_HANDOFF.md).

## Quick Start

```bash
npm install
npm run dev
```

Open:

- Admin: `http://localhost:3000/admin`
- Contest Manager: `http://localhost:3000/admin/competitions`
- Judge demo: `http://localhost:3000/judge/demo-judge`
- Chief Judge demo: `http://localhost:3000/chief/demo-chief`
- Emcee demo: `http://localhost:3000/emcee/demo-emcee`
- Exports: `http://localhost:3000/export/demo-novice-jj`

## Supabase

The schema and environment placeholders are included, but production Supabase credentials are not required for the demo workspace.

1. Create a Supabase project.
2. Apply `supabase/migrations/0001_initial_schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

## Scoring Notes

- Scores are stored as `score_x2` integer half-points. `0` means unscored.
- Judges and Chief Judge always enter raw scores.
- Callback Rounds are role-based and derive callbacks from rankings and the default WSDC callback profile: Yes `10`, Alt 1 `4.5`, Alt 2 `4.3`, Alt 3 `4.2`, No `0`.
- Chief Judge modes are `none`, `tiebreak_only`, and `full_panel`.
- In `tiebreak_only`, Chief Judge raw scores are excluded from original aggregation and used only after original calculations identify a meaningful boundary tie.
- Final Rounds score couples, convert raw scores to ordinals, and use Relative Placement majority rules.
- The UI does not claim WSDC approval or certification.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

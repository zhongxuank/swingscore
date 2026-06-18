# SwingScore Beta Handoff

Last updated: 2026-06-18

This document consolidates the Alpha-to-Beta work completed so far and charts the next implementation path. It is intended for future agents who need to continue the project without reconstructing the full conversation history.

## Product Direction

SwingScore is moving from a live alpha demo into a Beta model built around **Contests with Rounds**.

- A **Contest** is the division-level container, such as `Novice Jack & Jill`.
- A contest contains ordered **Rounds**.
- A **Callback Round** is individually scored and role-based. Prelim, Quarter-Final, and Semi-Final rounds are Callback Rounds.
- A **Final Round** is couple-scored and uses Relative Placement.
- "Prelim", "Semi-Final", and "Final" are round stages, not separate top-level competition types.
- Leaders and Followers are scored separately in Callback Rounds.
- Advancement counts and alternates are role-level: 8 callbacks means 8 Leaders and 8 Followers.
- Chief Judge scoring must always be raw-score entry. The UI should never ask the Chief Judge to manually assign callbacks or placements.
- If Chief Judge scores count, they are included in normal scoring. If they do not count, they are used for review or tiebreaking only.
- The UI must not claim WSDC approval or certification.

## Completed Changes

### Scoring UX

- Replaced numeric score inputs with full-row touch sliders for judges.
- Added gesture handling so horizontal swipes score while vertical swipes still scroll.
- Removed the extra score bar once the row background itself communicated score.
- Added stable bottom warning/action areas so validation messages do not shift the score list.
- Added Callback Round score background colors:
  - Green for current Yes range.
  - Yellow for current alternate range.
  - Red for current No range.
  - Uncolored for unscored rows.
- Increased bib prominence and moved competitor names into subtitle text.
- Added boundary tie highlighting by group color without adding layout-shifting labels.
- Warning text for ties includes the tied bib numbers.
- Chief Judge raw score entry uses the same row slider interaction.

### Role-Aware Judging

- Judges now have role assignments: Leaders, Followers, or Both.
- Callback judge views only show roles that the access link permits.
- If a judge has Both access, the interface exposes a role toggle between Leader and Follower sheets.
- Chief Judge access can support both role review and raw score entry.
- Heat sheets show Leaders and Followers in separate columns, including emcee-facing views.

### Contest Manager

- `/admin/competitions` is now the Contest Manager.
- Admin can create, edit, archive, restore, and open contests.
- Archive is represented separately from contest lifecycle status.
- Alpha flavor copy such as "A Supabase-ready control room..." has been removed from the core admin surfaces.
- Current persistence is localStorage-backed, not Supabase-backed.

### Round Setup

- Contest detail pages now manage rounds under a contest.
- Supported round stages are `prelim`, `quarter_final`, `semi_final`, and `final`.
- Supported scoring methods are `callback` and `relative_placement`.
- Callback Round tabs: Setup, Competitors, Judges, Heats, Results, Exports, Access.
- Final Round tabs: Setup, Judges, Pairings, Results, Exports, Access.
- Admin can add a Prelim Callback Round, generate a Semi-Final Callback Round, and add or generate a Final Round shell.
- Round setup includes Start actions and setup-lock messaging.
- Heat builder UI exists for Callback Rounds with heat-count and max-dancers-per-heat controls.
- Final Round pairings are leader-ordered, with follower assignment intended to remain editable until scoring/finalization rules block it.

### Judge Panel Configuration

- Judge assignments are round-specific.
- The Judges tab now owns panel setup.
- Admin can set the number of scoring judges.
- Admin can name each scoring judge.
- Callback Round judges can be assigned Leaders, Followers, or Both.
- Chief Judge has a name field.
- Chief Judge score-counting is configured from the Judges tab.
- For Callback Rounds, Chief Judge can be assigned Leaders, Followers, or Both when scores count.
- Before confirming a panel, the UI shows counted judge summaries:
  - Leaders counted judge count and name list.
  - Followers counted judge count and name list.
  - Finals counted panel count and name list.
- Final Rounds validate the scoring panel as odd-numbered and at least 3 scoring judges.
- If the Chief Judge score counts in a Final Round, they are included in that odd-number validation.
- If the Chief Judge does not count, only the other scoring judges are counted.

### Access Links

- Round setup includes an Access tab.
- Access links are generated after the judge panel is confirmed.
- Judge access links include judge names and role labels for easier recognition.
- Chief Judge and Emcee links are generated with round context.
- A WhatsApp-friendly copy block is available in the Access tab. Format:

```text
**Novice Prelims Judge Sheets**
Zee (Chief Judge): http://...
Xuan (Leader): http://...
Joshua (Leader): http://...
Steph (Follower): http://...
```

- Current token format is deterministic and readable for local QA only. It is not production-safe.

### Tests

- Added tests for access link generation and token parsing.
- Added tests for round setup helpers:
  - Callback heat generation.
  - Competitor advancement into later rounds.
  - Finals odd scoring-panel validation.
  - Finals pairing completeness validation.
- Expanded Playwright coverage for Contest Manager, round setup, judge panel confirmation, access links, and the latest Chief Judge score-count controls.

## Current Architecture Map

- `src/lib/types.ts`
  - Core Contest, Round, Judge, Competitor, Heat, Couple, Score, and Access Link types.
- `src/lib/rounds.ts`
  - Round labels, Callback/Final checks, Chief Judge count detection, heat generation, advancement list helpers, Finals panel validation, and Finals pairing validation.
- `src/lib/access-links.ts`
  - Local QA access link generation and parsing.
- `src/lib/data/local-contest-store.ts`
  - localStorage merge layer for contests, rounds, and round judge panels.
- `src/lib/data/demo-data.ts`
  - Demo competition, rounds, competitors, judges, scores, heats, couples, and static demo links.
- `src/components/workspaces/contest-manager.tsx`
  - Contest Manager create/edit/archive/restore/open UI.
- `src/components/workspaces/admin-workspace.tsx`
  - Contest detail, round setup tabs, judge setup, heat builder, pairings shell, results shell, exports shell, and access links.
- `src/components/workspaces/judge-workspace.tsx`
  - Judge scoring UI and generated-token header context.
- `src/components/workspaces/chief-workspace.tsx`
  - Chief Judge raw score UI and generated-token header context.
- `src/components/workspaces/emcee-workspace.tsx`
  - Emcee view and generated-token header context.
- `tests/live-alpha.spec.ts`
  - Browser flow coverage for current alpha/beta setup behaviors.

## Important Limitations

The current Beta setup is still a local alpha shell in several places.

- Contest and round shells persist in localStorage.
- Competitors, heats, pairings, scores, submissions, finalized results, and snapshots are not yet fully persisted per contest/round.
- Judge, Chief Judge, and Emcee routes can understand generated access-token context, but their scoring bodies are still primarily demo-data-backed.
- Access tokens are readable and deterministic. Replace with opaque random tokens hashed at rest before production use.
- Round generation from prior results is currently a setup shell, not a complete snapshot-backed data migration.
- Start locking is represented in the UI, but a full lock/unlock/submission invalidation model still needs implementation.
- Supabase schema files exist, but the current local UI is not yet wired end-to-end to Supabase.
- Realtime score updates are not yet wired into the Beta local round model.

## Next Build Roadmap

### 1. Persist Real Round Data

Build a shared persistence model for:

- Round competitors.
- Callback heat entries.
- Final pairings.
- Judge assignments.
- Raw scores.
- Submission status.
- Advancement snapshots.
- Final placement snapshots.
- Export records.
- Audit events.

This can start as localStorage for Beta QA, but shape the APIs to swap to Supabase route handlers/server actions later.

### 2. Replace Demo-Backed Access Routes

Create one shared access-token data loader that returns:

- Contest.
- Round.
- Access role.
- Judge assignment, if applicable.
- Competitors.
- Heats or pairings.
- Existing score drafts.
- Submission state.
- Result snapshots.

Then update:

- `/judge/[token]`
- `/chief/[token]`
- `/emcee/[token]`

Each route should branch by `round.scoringMethod`.

### 3. Complete Callback Round Setup

- Persist imported competitors per contest.
- Persist selected competitors per round.
- Generate Callback Rounds from finalized prior Callback Round results.
- Make advancement and alternate counts role-specific throughout setup.
- Complete heat generation and manual heat editing.
- Lock competitors, judges, scoring rules, and heats when a Callback Round starts.
- Support emergency unlock with audit event and clear warnings about invalidating live submissions.

### 4. Complete Callback Round Judging

- Judge access should load only assigned role sheets.
- Both-role judges should toggle Leader/Follower without mixing submissions.
- Autosave each score change into round-specific storage.
- Submission should validate only meaningful boundary ties.
- Boundary ties should be shown clearly by role and bib group.
- Chief Judge raw scores should resolve boundary ties according to round Chief Judge mode:
  - `none`: no CJ scoring.
  - `tiebreak_only`: original panel aggregation first, CJ raw score only for meaningful ties.
  - `full_panel`: CJ raw scores included as a normal judging sheet for assigned roles.

### 5. Complete Final Round Setup

- Generate Final Round pairings from the latest finalized Callback Round.
- Use leader bib order as the stable sheet order.
- Allow follower bib/name to be blank initially.
- Allow follower assignment edits until scoring/finalization rules block them.
- Block finalization until required pairings are complete.
- Enforce odd scoring judges with at least 3 counted judges.

### 6. Complete Final Round Judging

- Final judges score couples by raw score.
- Convert raw scores to ordinals per judge.
- Block duplicate raw scores within a judge's Final sheet before submission.
- Include Chief Judge scores in ordinals only when Chief Judge score counts.
- Finalize with Relative Placement majority rules and immutable snapshots.

### 7. Complete Emcee And Exports

- Emcee should read finalized snapshots, not live mutable calculations.
- Emcee needs read-only views for:
  - Callback lists ordered by bib.
  - Alternates by role.
  - Heat sheets with Leader/Follower columns.
  - Final pairings.
  - Placements.
  - Filler instructions.
- CSV exports should include:
  - Competitor lists.
  - Advancement lists.
  - Finals imports/pairings.
  - Results.
  - Full raw score sheets for all judges.
  - Chief Judge raw scores.
- Print/PDF exports should cover callback sheets, heat sheets, and finals placements.

### 8. Supabase And Security

- Add/finish migrations for all Beta entities.
- Add RLS policies for admin-authenticated access and token-scoped public access.
- Store opaque access token hashes, never readable tokens.
- Add audit events for setup changes, starts, unlocks, submissions, finalizations, and exports.
- Move localStorage behavior behind a demo adapter so Supabase can become the default production adapter.

### 9. Realtime, Offline, And PWA Hardening

- Add Supabase realtime subscriptions for score saves, judge completion status, pairings, advancement snapshots, and emcee announcements.
- Preserve visible Saving/Saved/Offline/Reconnecting states.
- Ensure mobile judging remains stable with weak connectivity.
- Verify PWA installability and service worker behavior.

## QA Checklist For Future Agents

After changing setup UI, round data, or access links, run:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Use the in-app browser to verify:

- Contest Manager create/edit/archive/restore/open.
- Add Prelim Callback Round.
- Configure judge count, names, role assignments, and Chief Judge count behavior.
- Confirm panel and verify Access tab links.
- Copy WhatsApp judge message.
- Open generated Judge, Chief Judge, and Emcee links.
- Callback heat sheets show Leaders and Followers in separate columns.
- Final Round odd-judge validation behaves correctly.

Avoid running `npm run build` while `npm run dev` is serving the same `.next` directory unless the dev server will be restarted afterward.

## Useful Local URLs

- Admin: `http://localhost:3000/admin`
- Contest Manager: `http://localhost:3000/admin/competitions`
- Demo contest: `http://localhost:3000/admin/competitions/demo-novice-jj`
- Judge demo: `http://localhost:3000/judge/demo-judge`
- Chief Judge demo: `http://localhost:3000/chief/demo-chief`
- Emcee demo: `http://localhost:3000/emcee/demo-emcee`


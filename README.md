# Swingscore

Live scoring for West Coast Swing contests. One organiser sets up a contest, judges score on their phones from private links, and results show on screen.

This is a rebuild. The old app is on `main` and is the reference. See `CONTEXT.md` for the words the code and docs use, and the Swingscore Rebuild Spec for the plan and the ticket order.

## Layout

- `src/core/` pure scoring logic: scores in tenths, ordinals, Relative Placement per the WSDC paper, callback marks, ranking with the chief judge tie-break, round rules.
- `src/data/` the data layer screens use (`ContestStore`), an in-memory version, and the contract tests every version must pass.
- `supabase/migrations/` database setup SQL. Run each file once in the Supabase SQL editor, in name order.
- `src/app/` the Next.js app.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run typecheck
npm run lint
```

## Environment

Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key). `SUPABASE_SERVICE_ROLE_KEY` is only needed for the private judge links and must never be committed.

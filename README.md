# Swingscore

Live scoring for West Coast Swing contests. One organiser sets up a contest, judges score on their phones from private links, and results show on screen.

This is a rebuild. The old app is on `main` and is the reference. See `CONTEXT.md` for the words the code and docs use, and the Swingscore Rebuild Spec for the plan and the ticket order.

## Layout

- `src/core/` pure scoring logic: scores in tenths, ordinals, Relative Placement per the WSDC paper, callback marks, ranking with the chief judge tie-break, round rules.
- `src/data/` the data layer screens use (`ContestStore`), an in-memory version, and the contract tests every version must pass.
- `supabase/migrations/` database setup SQL. Run each file once in the Supabase SQL editor, in name order.
- `src/lib/supabase/` Supabase clients for the browser, server and middleware. Only `src/data/supabase-store.ts` and the sign-in routes use them.
- `src/app/` the Next.js app: `/sign-in`, `/auth/callback`, `/contests` and `/contests/[id]`.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run typecheck
npm run lint
npm run test:live  # store contract and sign-in flow against the real Supabase project (needs all three keys)
```

## Environment

Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key). `SUPABASE_SERVICE_ROLE_KEY` is only needed for the live tests (they create and delete throwaway organisers) and, later, the private judge links. It must never be committed or used in client code.

Sign-in: in Supabase, Authentication, URL Configuration must list every address the app runs on (for example `http://localhost:3000`, later the deployed address). The default email link must be opened in the same browser that asked for it.

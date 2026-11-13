# Swingscore agent notes

- Read `CONTEXT.md` first. Use its terms exactly (Contest, Round, Callback Round, Final Round, Entry, Chief Judge, Cut, Heat, Redancer, Draw).
- The plan and ticket order are in the Swingscore Rebuild Spec (Claude Doc). Work one ticket at a time, test first.
- Scores are whole tenths (0 to 1000, shown 0.0 to 100.0). An unscored entry has no value.
- Pure rules go in `src/core/` with no framework or database imports. Screens talk to `ContestStore` in `src/data/`, never to Supabase directly.
- Any new store version must pass `runContestStoreContract` in `src/data/store.contract.ts`.
- Relative Placement follows the WSDC paper. Never break a tie by id or bib. Return it as unresolved.
- Chief judge raw scores never tie. They break ties in prelims and are not a Relative Placement tiebreaker.
- Never commit keys. The service role key stays out of the repo and out of client code.
- Before finishing: `npm run lint`, `npm run typecheck`, `npm test`.
- Live checks against the real Supabase project: `npm run test:live` (needs all three keys; in cloud sessions also set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`). It never sends email.

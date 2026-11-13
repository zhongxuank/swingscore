# Swingscore domain glossary

Swingscore scores West Coast Swing competitions live. This file defines the words the code, tickets and docs must use. Decisions here come from the 2026-11-13 grilling with the organiser. It is a draft for the rebuild and is not yet reviewed against the WSDC Relative Placement rules (see "Open items").

## Terms

- **Contest**: one division-level competition, such as "Novice Jack & Jill". It holds an ordered list of Rounds. Not the whole event.
- **Round**: one stage of a Contest. Stages are Prelim, Quarter-Final, Semi-Final and Final. A Round is either a **Callback Round** or a **Final Round**.
- **Callback Round**: individually scored. Leaders and followers are scored and ranked separately. Output is who advances.
- **Final Round**: scored per couple with Relative Placement. Output is a placement per couple.
- **Entry**: the thing that gets scored, identified by a bib. For Jack & Jill this is one dancer in a Callback Round and a leader plus follower couple in a Final Round. Keep the model from assuming this, so Strictly and Pro-Am can be added later.
- **Bib**: the number that identifies a competitor.
- **Role**: Leader or Follower.
- **Organiser**: the one person per event who signs in with an email link and sets everything up. Usually the project owner.
- **Judge**: scores entries on a private link, with no account. Default is one role per judge. A judge may be assigned both roles, but that is not the default.
- **Chief Judge (CJ)**: judges both roles by default, sets the Yes and Alternate counts, and decides the cut. Their raw score breaks ties. Whether it also counts in the panel is a per-round toggle, off by default.
- **Raw score**: the number a judge gives an entry. Runs from 0.0 to 100.0 in steps of 0.1, stored as integer tenths (0 to 1000). An unscored entry has no value, so 0.0 is a real score. Judges and the CJ always enter raw scores, never callbacks or placements directly.
- **Yes / Alternate / No**: a judge's mark for an entry in a Callback Round, derived from their raw-score ranking and the Yes and Alternate counts the CJ set.
- **Cut**: the number of entries per role that advance. Decided by the CJ after scores are combined. It often differs from the Yes count, so it is never fixed in setup.
- **Alternate**: an entry named as a backup for the cut, up to 3 per role, shown to the emcee (MC).
- **Heat**: a group of entries on the floor together in a Callback Round, filled in bib order up to a maximum set for floor space.
- **Redancer**: a dancer brought back from an earlier heat to fill the last heat. Not judged. Always shown clearly as a redancer.
- **Draw**: the partner assignment for a Final Round. The app generates couples from settings (leader order, follower order with a flip option, rotation direction, shift) and does not randomise. The organiser can edit any pair before scoring starts. After the single rotation, couples are fixed for the Final.
- **Emcee (MC)**: read-only view of callbacks, alternates, heat sheets, pairings and placements.
- **Judge sheet**: one judge's scores for one Round, per role. Scoring works across all heats, with a heat view and an overall view.

## Rules to keep

- Scores autosave, queue offline, and sync when the connection returns.
- A judge cannot submit two equal raw scores in a Final Round.
- The CJ's raw scores never tie in any round, so any equal scores on a CJ sheet block submission.
- Final Rounds need an odd counted panel (5 or 7 scoring judges, plus the CJ only if the toggle counts them).
- A tie at the cut is resolved by the CJ's raw score.
- The UI never claims WSDC approval or certification.

## Relative Placement rules (source: Tigges, "Unraveling the Mystery of the Relative Placement Scoring System", updated 12.20.2021)

1. Check each judge has no tied raw scores. Block submission if they do.
2. Convert each judge's raw scores to ordinals (highest score is 1).
3. Majority is more than half of the counting judges. Walk the levels 1st, 1st-2nd, 1st-3rd and so on, counting judges who placed an entry at that level or better. An entry is placed at the first level where its count reaches the majority.
4. If several entries reach majority at the same level, place them all before moving to the next level. Break ties among them in this order:
   1. Higher count at that level.
   2. Lower sum of the ordinals that make up the count.
   3. Move to the next level and compare counts only (more is better), repeating level by level.
   4. Head to head: whichever entry a majority of judges placed above the other.
5. The CJ's score is not used to break these ties. It counts only when the toggle makes it one of the counted judges, or to stand in for a judge whose sheet is unusable.

The old repo's `relative-placement.ts` reproduces the paper's full 12-couple example and its head-to-head example (checked 2026-11-13). Two differences remain: it also compares sums at later levels (the paper compares counts only), and it falls back to bib order when head-to-head is tied. The rebuild should follow the paper and report an unresolved tie to the organiser instead of resolving it silently.

## Open items

- Setup locks and emergency unlock are out of the first release.
- Pro-Am and Strictly formats are out of the first release.
- Exports (CSV, printable placement sheet) are out of the first release.

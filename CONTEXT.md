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
- **Raw score**: the number a judge gives an entry. Stored as integer half-points. Judges and the CJ always enter raw scores, never callbacks or placements directly.
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
- Final Rounds need an odd counted panel (5 or 7 scoring judges, plus the CJ only if the toggle counts them).
- A tie at the cut is resolved by the CJ's raw score.
- The UI never claims WSDC approval or certification.

## Open items

- The WSDC Relative Placement tiebreak order has not been read yet. The old repo's tiebreak (more majority, then lower sum, then head-to-head, then bib order) is a guess until checked.
- Pro-Am and Strictly formats are out of the first release.
- Exports (CSV, printable placement sheet) are out of the first release.

# Testing Swingscore on your own computer

## One-time setup

1. Install Node 20 or newer.
2. Get the code and switch to the branch under test:
   ```
   git fetch origin
   git switch claude/project-thread-cw7b6b
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in all three values from Supabase, Project Settings, API keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY` (the secret key). It stays in this file on your computer. Git ignores the file, so never paste the key anywhere else.

## Each time

1. Start the app in one terminal: `npm run dev`
2. In a second terminal, make a demo contest: `npm run demo -- you@example.com` (use your own email)

The demo command prints links and saves them to `demo-links.txt`:

- **Organiser:** signs you in with no email and opens the prelim. It works once, for about an hour.
- **Chief judge, four judges and the emcee:** the private links for the prelim.

The demo has 12 leaders and 12 followers, three heats of up to 5, and 6 Yes and 2 Alternates per judge. Run it again any time for a fresh contest, and archive old ones from the contest list.

To sign in again without making a new contest, run `npm run signin -- you@example.com`.

## What to try

Open each private link in a different browser or a private window, so they don't share a sign-in.

1. **Organiser:** look over the competitors, the panel and the heats. The progress section shows who has submitted.
2. **Judges:** double tap the track to score, double tap again to clear, and use the 0.1 nudges. Switch between the heat and overall views. Turn the network off in the browser's developer tools, keep scoring, then turn it back on. The scores should still save. Submit when every dancer has a score.
3. **Chief judge:** score both roles and submit. Then, on "Counts and cut", choose how many go through and decide each role.
4. **Emcee:** the callbacks and alternates appear once the chief judge decides the cuts.
5. **Final:** on the organiser screen, open the final. Add an odd panel of judges, draw the couples and make the links. Score as each final judge, then check the results, settle any ties and publish. The emcee link for the final shows the placements.

## On a phone

A phone can't open `localhost`. Put your computer and phone on the same Wi-Fi. Find your computer's local address (for example `192.168.1.20`). Set `NEXT_PUBLIC_APP_URL=http://192.168.1.20:3000` in `.env.local`, restart `npm run dev`, and run the demo again. The new judge links then open on the phone. Installing to the home screen needs a secure (https) address, so test that after deploying.

## Automated checks

- `npm test`: unit tests, no keys needed.
- `npm run test:live`: the full suite against Supabase. It uses throwaway accounts and deletes them afterwards.

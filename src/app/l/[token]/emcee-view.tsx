"use client";

import type { AccessView } from "@/data/access";
import type { DancerRole } from "@/data/types";
import { buildRoleSheet } from "@/lib/judge-sheet";

const ROLE_TITLE: Record<DancerRole, string> = { leader: "Leaders", follower: "Followers" };
const byBib = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** The emcee's read-only view. It shows only stored results, never live scores. */
export function EmceeView({ view }: { view: AccessView }) {
  const people = new Map(view.competitors.map((c) => [c.id, c]));
  const who = (id: string) => {
    const person = people.get(id);
    return person ? `${person.bib}${person.name ? ` ${person.name}` : ""}` : "?";
  };

  if (view.round.kind === "final") {
    const placeOf = new Map(view.placements.map((p) => [p.coupleId, p.place]));
    const placed = [...view.couples].filter((c) => placeOf.has(c.id)).sort((a, b) => placeOf.get(a.id)! - placeOf.get(b.id)!);
    return (
      <main className="space-y-6 p-4">
        {placed.length > 0 ? (
          <section aria-label="Placements">
            <h2 className="mb-2 text-lg font-semibold">Placements</h2>
            <ol className="space-y-1 text-sm">
              {placed.map((couple) => (
                <li key={couple.id}>
                  <span className="inline-block w-10 font-semibold">{placeOf.get(couple.id)}.</span>
                  {who(couple.leaderId)} &amp; {who(couple.followerId)}
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <p className="text-sm text-gray-600">Placements appear here once the organiser publishes them.</p>
        )}
        <section aria-label="Pairings">
          <h2 className="mb-2 text-lg font-semibold">Pairings</h2>
          {view.couples.length === 0 ? <p className="text-sm text-gray-600">Couples are not set yet.</p> : null}
          <ul className="space-y-1 text-sm">
            {view.couples.map((couple) => (
              <li key={couple.id}>
                <span className="inline-block w-10 font-mono font-semibold">{couple.number}</span>
                {who(couple.leaderId)} &amp; {who(couple.followerId)}
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  const leaders = buildRoleSheet(view, "leader");
  const followers = buildRoleSheet(view, "follower");
  const heatNumbers = [...new Set([...leaders.heats, ...followers.heats].map((h) => h.number))].sort((a, b) => a - b);

  return (
    <main className="space-y-6 p-4">
      {view.cuts.length > 0 ? (
        <section aria-label="Callbacks" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(["leader", "follower"] as const).map((role) => {
            const decided = view.cuts.find((c) => c.role === role);
            const results = view.results.filter((r) => r.role === role);
            const callbacks = results.filter((r) => r.status === "advancing").map((r) => r.competitorId).sort((a, b) => byBib(people.get(a)?.bib ?? "", people.get(b)?.bib ?? ""));
            const alternates = results.filter((r) => r.status === "alternate").sort((a, b) => (a.alternateOrder ?? 0) - (b.alternateOrder ?? 0));
            return (
              <div key={role} aria-label={`${ROLE_TITLE[role]} callbacks`}>
                <h2 className="mb-1 font-semibold">
                  {ROLE_TITLE[role]} callbacks {decided ? `(${decided.cut})` : ""}
                </h2>
                {!decided ? (
                  <p className="text-sm text-gray-600">Not decided yet.</p>
                ) : (
                  <>
                    <ul className="space-y-0.5 text-sm">
                      {callbacks.map((id) => (
                        <li key={id}>{who(id)}</li>
                      ))}
                    </ul>
                    {alternates.length > 0 ? (
                      <>
                        <h3 className="mt-2 text-xs font-semibold uppercase text-gray-500">Alternates, in order</h3>
                        <ol className="space-y-0.5 text-sm">
                          {alternates.map((r) => (
                            <li key={r.competitorId}>
                              Alt {r.alternateOrder}: {who(r.competitorId)}
                            </li>
                          ))}
                        </ol>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </section>
      ) : null}

      {heatNumbers.length === 0 ? <p className="text-sm text-gray-600">Heats are not ready yet.</p> : null}
      {heatNumbers.map((number) => (
        <section key={number} className="rounded border border-gray-200 p-3" aria-label={`Heat ${number}`}>
          <h2 className="font-semibold">Heat {number}</h2>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            {[leaders, followers].map((sheet) => (
              <div key={sheet.role}>
                <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{ROLE_TITLE[sheet.role]}</h3>
                <ul className="space-y-0.5">
                  {(sheet.heats.find((h) => h.number === number)?.rows ?? []).map((row) => (
                    <li key={`${row.competitorId}-${row.redancer}`} className={row.redancer ? "text-amber-800" : undefined}>
                      {who(row.competitorId)}
                      {row.redancer ? <span className="ml-1 text-xs font-semibold">(redancer)</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

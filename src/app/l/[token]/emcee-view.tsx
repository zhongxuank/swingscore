"use client";

import type { AccessView } from "@/data/access";
import { buildRoleSheet } from "@/lib/judge-sheet";

/** Heat sheets with leaders and followers in separate columns. Callbacks and placements arrive with later tickets. */
export function EmceeView({ view }: { view: AccessView }) {
  const names = new Map(view.competitors.map((c) => [c.id, c.name]));
  const leaders = buildRoleSheet(view, "leader");
  const followers = buildRoleSheet(view, "follower");
  const heatNumbers = [...new Set([...leaders.heats, ...followers.heats].map((h) => h.number))].sort((a, b) => a - b);

  if (heatNumbers.length === 0) return <p className="p-4 text-sm text-gray-600">Heats are not ready yet.</p>;
  return (
    <main className="space-y-4 p-4">
      {heatNumbers.map((number) => (
        <section key={number} className="rounded border border-gray-200 p-3" aria-label={`Heat ${number}`}>
          <h2 className="font-semibold">Heat {number}</h2>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            {[leaders, followers].map((sheet) => (
              <div key={sheet.role}>
                <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{sheet.role === "leader" ? "Leaders" : "Followers"}</h3>
                <ul className="space-y-0.5">
                  {(sheet.heats.find((h) => h.number === number)?.rows ?? []).map((row) => (
                    <li key={`${row.competitorId}-${row.redancer}`} className={row.redancer ? "text-amber-800" : undefined}>
                      <span className="font-mono font-semibold">{row.bib}</span> {names.get(row.competitorId)}
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

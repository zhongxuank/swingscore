import Link from "next/link";
import { ArrowRight, ClipboardList, Gavel, Rows3 } from "lucide-react";

export default function AdminHomePage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 lg:px-12">
      <section className="mx-auto flex max-w-7xl flex-col gap-8 rounded-[8px] border border-graphite/15 bg-chalk/90 p-6 shadow-panel backdrop-blur sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-brass">SwingScore admin</p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-black leading-tight text-ink sm:text-6xl">
              Manage contests, rounds, judges, and results.
            </h1>
          </div>
          <Link
            href="/admin/competitions"
            className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-graphite px-5 py-3 text-sm font-bold text-paper transition hover:bg-ink"
          >
            Open Contest Manager
            <ArrowRight size={18} />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ClipboardList,
              title: "Contests",
              body: "Create division-level contest containers and keep old records archived."
            },
            {
              icon: Rows3,
              title: "Rounds",
              body: "Run Callback Rounds for prelims and semis, then generate Final Rounds."
            },
            {
              icon: Gavel,
              title: "Judges",
              body: "Assign judging sheets per round and protect scoring once a round starts."
            }
          ].map((item) => (
            <article key={item.title} className="rounded-[8px] border border-graphite/15 bg-paper p-5">
              <item.icon className="text-brass" size={22} />
              <h2 className="mt-5 text-xl font-black text-graphite">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-graphite/75">{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

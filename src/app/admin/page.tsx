import Link from "next/link";
import { ArrowRight, ClipboardList, RadioTower, ShieldCheck } from "lucide-react";

export default function AdminHomePage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 lg:px-12">
      <section className="mx-auto flex max-w-7xl flex-col gap-8 rounded-[8px] border border-graphite/15 bg-chalk/90 p-6 shadow-panel backdrop-blur sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-brass">SwingScore live alpha</p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-black leading-tight text-ink sm:text-6xl">
              Run the contest from raw scores to awards.
            </h1>
          </div>
          <Link
            href="/admin/competitions/demo-novice-jj"
            className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-graphite px-5 py-3 text-sm font-bold text-paper transition hover:bg-ink"
          >
            Open demo event
            <ArrowRight size={18} />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ClipboardList,
              title: "Setup",
              body: "Import competitors, assign judges, configure callbacks, and create heat sheets."
            },
            {
              icon: RadioTower,
              title: "Live judging",
              body: "Mobile-first judge links autosave raw scores and restore drafts after refresh."
            },
            {
              icon: ShieldCheck,
              title: "Chief Judge",
              body: "Review every sheet, use CJ raw scores for ties, and finalize immutable results."
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

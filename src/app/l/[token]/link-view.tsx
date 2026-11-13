"use client";

import { useCallback, useEffect, useState } from "react";
import { STAGE_LABELS } from "@/core/round-rules";
import { useAccessStore } from "@/components/use-access";
import type { AccessView } from "@/data/access";
import { ChiefTools } from "./chief-tools";
import { EmceeView } from "./emcee-view";
import { FinalSheet } from "./final-sheet";
import { JudgeSheet } from "./judge-sheet";

type State = { kind: "loading" } | { kind: "bad" } | { kind: "error"; message: string } | { kind: "ready"; view: AccessView };

export function LinkView({ token }: { token: string }) {
  const access = useAccessStore();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [tab, setTab] = useState<"score" | "results">("score");

  const load = useCallback(async () => {
    try {
      const view = await access.load(token);
      setState(view ? { kind: "ready", view } : { kind: "bad" });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Could not load this link." });
    }
  }, [access, token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "loading") return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  if (state.kind === "bad") {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold">This link doesn&apos;t work</h1>
        <p className="mt-2 text-sm text-gray-600">It may have been replaced or typed wrongly. Ask the organiser for a new link.</p>
      </main>
    );
  }
  if (state.kind === "error") {
    return (
      <main className="mx-auto max-w-md p-6">
        <p role="alert" className="text-sm text-red-700">
          Could not load this link: {state.message}
        </p>
        <button type="button" onClick={() => void load()} className="mt-3 rounded border border-gray-300 px-3 py-1.5 text-sm">
          Try again
        </button>
      </main>
    );
  }

  const { view } = state;
  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b border-gray-200 px-4 py-3">
        <p className="text-xs text-gray-500">
          {view.contest.name} · {STAGE_LABELS[view.round.stage]}
        </p>
        <h1 className="text-lg font-semibold">
          {view.kind === "emcee" ? "Emcee" : view.judge?.isChief ? `Chief judge: ${view.judge.name}` : `Judge: ${view.judge?.name}`}
        </h1>
      </header>
      {view.kind === "emcee" ? (
        <EmceeView view={view} />
      ) : view.round.kind === "final" ? (
        <FinalSheet token={token} view={view} onReload={load} />
      ) : view.judge?.isChief ? (
        <>
          <div className="flex gap-2 px-4 pt-3" role="tablist" aria-label="Chief judge">
            {(["score", "results"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${tab === value ? "bg-gray-900 text-white" : "border border-gray-300"}`}
              >
                {value === "score" ? "My sheet" : "Counts and cut"}
              </button>
            ))}
          </div>
          {tab === "score" ? <JudgeSheet token={token} view={view} onReload={load} /> : <ChiefTools token={token} view={view} onReload={load} />}
        </>
      ) : (
        <JudgeSheet token={token} view={view} onReload={load} />
      )}
    </div>
  );
}

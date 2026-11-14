"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import type { AccessLinkInfo, AccessLinkTarget, Round, RoundJudge } from "@/data/types";
import { accessLinkPath } from "@/lib/access-token";

interface Holder {
  key: string;
  label: string;
  target: AccessLinkTarget;
}

/** Private links for each judge, the chief judge and the emcee. A token is shown only right after it is made. */
export function LinksSection({ round, judges }: { round: Round; judges: RoundJudge[] }) {
  const store = useContestStore();
  const [links, setLinks] = useState<AccessLinkInfo[]>([]);
  const [fresh, setFresh] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLinks(await store.listAccessLinks(round.id));
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }, [store, round.id]);

  useEffect(() => {
    void load();
  }, [load, judges]);

  const holders: Holder[] = [
    ...judges.map((judge) => ({
      key: judge.id,
      label: judge.isChief ? `${judge.name} (chief judge)` : judge.name,
      target: { kind: "judge", judgeId: judge.id } as const
    })),
    { key: "emcee", label: "Emcee", target: { kind: "emcee" } as const }
  ];

  const existing = (holder: Holder) =>
    links.find((link) => (holder.target.kind === "emcee" ? link.kind === "emcee" : link.judgeId === holder.target.judgeId));

  async function make(holder: Holder) {
    setError(null);
    try {
      const { token } = await store.createAccessLink(round.id, holder.target);
      setFresh((current) => ({ ...current, [holder.key]: `${window.location.origin}${accessLinkPath(token)}` }));
      await load();
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }

  async function copy(holder: Holder, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(holder.key);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="space-y-3" aria-label="Private links">
      <h2 className="text-lg font-semibold">Private links</h2>
      <p className="text-sm text-gray-600">
        Send each person their own link. A link is shown once, so copy it when you make it. Making a new link stops the old one working.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-gray-200 rounded border border-gray-200 text-sm">
        {holders.map((holder) => {
          const link = existing(holder);
          const url = fresh[holder.key];
          return (
            <li key={holder.key} className="space-y-2 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{holder.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{link ? "Link made" : "No link yet"}</span>
                  <button type="button" onClick={() => void make(holder)} className="rounded border border-gray-300 px-2 py-1 text-xs" aria-label={`${link ? "Make new link" : "Make link"} for ${holder.label}`}>
                    {link ? "Make new link" : "Make link"}
                  </button>
                </span>
              </div>
              {url ? (
                <div className="flex gap-2">
                  <input readOnly value={url} aria-label={`Link for ${holder.label}`} className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <button type="button" onClick={() => void copy(holder, url)} className="rounded border border-gray-300 px-2 py-1 text-xs">
                    {copied === holder.key ? "Copied" : "Copy"}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { STAGE_LABELS } from "@/core/round-rules";
import type { Round, RoundSettings } from "@/data/types";

const STATUS_LABELS: Record<Round["status"], string> = { setup: "Setup", scoring: "Scoring", complete: "Complete" };

const toField = (value: number | null) => (value === null ? "" : String(value));
const fromField = (value: string): number | null => (value.trim() === "" ? null : Number(value));

export function RoundSettingsForm({ round, onSave }: { round: Round; onSave: (settings: RoundSettings) => Promise<void> }) {
  const [yesCount, setYesCount] = useState(toField(round.yesCount));
  const [altCount, setAltCount] = useState(toField(round.altCount));
  const [maxPerHeat, setMaxPerHeat] = useState(toField(round.maxPerHeat));
  const [chiefJudgeCounts, setChiefJudgeCounts] = useState(round.chiefJudgeCounts);
  const [saving, setSaving] = useState(false);
  const isCallback = round.kind === "callback";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const settings: RoundSettings = isCallback
      ? { yesCount: fromField(yesCount), altCount: fromField(altCount), maxPerHeat: fromField(maxPerHeat), chiefJudgeCounts }
      : { chiefJudgeCounts };
    await onSave(settings);
    setSaving(false);
  }

  const numberInput = (id: string, label: string, value: string, set: (value: string) => void, min: number, hint: string) => (
    <label htmlFor={id} className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        step={1}
        value={value}
        onChange={(event) => set(event.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
      />
      <span className="mt-1 block text-xs text-gray-500">{hint}</span>
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border border-gray-200 p-4" aria-label={`${STAGE_LABELS[round.stage]} settings`}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">
          {round.position}. {STAGE_LABELS[round.stage]}
        </h3>
        <span className="text-xs text-gray-500">
          {isCallback ? "Callback round" : "Final round, Relative Placement"} · {STATUS_LABELS[round.status]}
        </span>
      </div>

      {isCallback ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {numberInput(`yes-${round.id}`, "Yes per judge", yesCount, setYesCount, 0, "Set by the chief judge")}
          {numberInput(`alt-${round.id}`, "Alternates per judge", altCount, setAltCount, 0, "Usually up to 3")}
          {numberInput(`heat-${round.id}`, "Max per heat", maxPerHeat, setMaxPerHeat, 1, "For floor space")}
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={chiefJudgeCounts} onChange={(event) => setChiefJudgeCounts(event.target.checked)} />
        Chief judge&apos;s scores count in the panel
      </label>

      <button type="submit" disabled={saving} className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
        {saving ? "Saving…" : "Save round"}
      </button>
    </form>
  );
}

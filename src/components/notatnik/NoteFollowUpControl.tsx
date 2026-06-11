"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { formatFollowUpLabel, isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import { FollowUpQuickDates } from "./FollowUpQuickDates";

export function NoteFollowUpControl({
  value,
  onChange,
  disabled,
  saving,
}: {
  value: string | null;
  onChange: (next: string | null) => void | Promise<void>;
  disabled?: boolean;
  saving?: boolean;
}) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const valueKey = value ?? "";
  const [draft, setDraft] = useState(valueKey);
  const [appliedValueKey, setAppliedValueKey] = useState(valueKey);
  if (!editing && valueKey !== appliedValueKey) {
    setAppliedValueKey(valueKey);
    setDraft(valueKey);
  }

  const label = formatFollowUpLabel(value);
  const due = isFollowUpDue(value);

  async function commit(next: string | null) {
    await onChange(next);
    setEditing(false);
  }

  if (editing && !disabled) {
    return (
      <div className="space-y-1.5">
        <FollowUpQuickDates
          value={draft || null}
          disabled={saving}
          onPick={(iso) => setDraft(iso)}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor={inputId} className="sr-only">
            Data przypomnienia
          </label>
          <input
            id={inputId}
            type="date"
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            className={cn(
              "rounded border border-slate-200/80 bg-white/90 px-1.5 py-0.5 text-[11px]",
              controlFocusClass
            )}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void commit(draft.trim() || null)}
            className="rounded px-1 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            OK
          </button>
          {value ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void commit(null)}
              className="rounded px-1 py-0.5 text-[11px] text-slate-500 hover:bg-black/5 disabled:opacity-50"
            >
              Usuń
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setDraft(value ?? "");
              setEditing(false);
            }}
            className="rounded px-1 py-0.5 text-[11px] text-slate-500 hover:bg-black/5 disabled:opacity-50"
          >
            Anuluj
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || saving}
      onClick={() => !disabled && setEditing(true)}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] transition hover:bg-black/5 disabled:opacity-50",
        due ? "font-semibold text-violet-800" : "text-slate-500"
      )}
    >
      <span aria-hidden>⏰</span>
      <span className="truncate">{label ? `Przypomnienie: ${label}` : "Przypomnij…"}</span>
    </button>
  );
}

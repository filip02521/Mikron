"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { formatFollowUpLabel, isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import { FollowUpQuickDates } from "./FollowUpQuickDates";
import { IconClock } from "@/components/icons/StrokeIcons";

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
  const [editDraft, setEditDraft] = useState("");

  const label = formatFollowUpLabel(value);
  const due = isFollowUpDue(value);

  function startEditing() {
    if (disabled) return;
    setEditDraft(value ?? "");
    setEditing(true);
  }

  async function commit(next: string | null) {
    await onChange(next);
    setEditing(false);
  }

  if (editing && !disabled) {
    return (
      <div className="space-y-1.5">
        <FollowUpQuickDates
          value={editDraft || null}
          disabled={saving}
          onPick={(iso) => setEditDraft(iso)}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor={inputId} className="sr-only">
            Data przypomnienia
          </label>
          <input
            id={inputId}
            type="date"
            value={editDraft}
            disabled={saving}
            onChange={(e) => setEditDraft(e.target.value)}
            className={cn(
              "rounded border border-slate-200/80 bg-white/90 px-1.5 py-0.5 text-[11px]",
              controlFocusClass
            )}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void commit(editDraft.trim() || null)}
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
            onClick={() => setEditing(false)}
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
      onClick={startEditing}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-medium transition disabled:opacity-50",
        due
          ? "bg-violet-50 text-violet-800 hover:bg-violet-100"
          : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-700"
      )}
    >
      <IconClock size={13} strokeWidth={2} className={due ? "text-violet-600" : "text-slate-400"} />
      <span className="truncate">{label ? `Przypomnienie: ${label}` : "Przypomnij…"}</span>
    </button>
  );
}

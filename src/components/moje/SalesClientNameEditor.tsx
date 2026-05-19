"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function SalesClientNameEditor({
  value,
  disabled,
  onSave,
}: {
  value: string | null;
  disabled?: boolean;
  onSave: (name: string | null) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const display = value?.trim() || null;

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-5 text-xs">
        <span className="text-slate-400">Klient:</span>
        {display ? (
          <span className="font-medium text-slate-800">{display}</span>
        ) : (
          <span className="text-slate-400 italic">nie przypisano</span>
        )}
        {!disabled ? (
          <button
            type="button"
            className={cn(
              "inline-flex min-h-9 items-center font-medium text-indigo-600 underline decoration-indigo-200 underline-offset-2",
              "hover:text-indigo-800 disabled:opacity-50"
            )}
            disabled={disabled}
            onClick={() => setEditing(true)}
          >
            {display ? "Zmień" : "Przypisz"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="mt-2 space-y-2 pl-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const next = draft.trim() || null;
          await onSave(next);
          setEditing(false);
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="block text-xs text-slate-500">
        Klient końcowy
        <input
          type="text"
          maxLength={80}
          placeholder="np. Kowalski / firma ABC"
          disabled={disabled || saving}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
          autoFocus
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={disabled || saving}
          className="min-h-10 rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Zapis…" : "Zapisz"}
        </button>
        <button
          type="button"
          disabled={saving}
          className="min-h-10 rounded-md px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
          onClick={() => {
            setDraft(value ?? "");
            setEditing(false);
          }}
        >
          Anuluj
        </button>
        {display ? (
          <button
            type="button"
            disabled={saving}
            className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(null);
                setDraft("");
                setEditing(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            Usuń przypisanie
          </button>
        ) : null}
      </div>
    </form>
  );
}

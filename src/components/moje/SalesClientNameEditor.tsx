"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

/** Formularz przypisania klienta — tylko z menu Więcej lub gdy już otwarty. Bez stanu „nie przypisano” na liście. */
export function SalesClientNameEditor({
  value,
  disabled,
  onSave,
  openOnMount = false,
}: {
  value: string | null;
  disabled?: boolean;
  onSave: (name: string | null) => void | Promise<void>;
  openOnMount?: boolean;
}) {
  const [editing, setEditing] = useState(openOnMount);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (openOnMount) setEditing(true);
  }, [openOnMount]);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const display = value?.trim() || null;

  if (!editing) return null;

  return (
    <form
      className="mt-1.5 space-y-2"
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
          className={cn(
            "mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900",
            controlFocusClass
          )}
          autoFocus
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={disabled || saving} size="sm" className="min-h-9">
          {saving ? "Zapis…" : "Zapisz"}
        </Button>
        <button
          type="button"
          disabled={saving}
          className="min-h-9 rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
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
            className="min-h-9 rounded-md px-2 py-1.5 text-xs text-red-700 hover:bg-red-50"
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

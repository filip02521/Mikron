"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SubiektClientNameField } from "@/components/subiekt/SubiektClientNameField";
import {
  MAX_CLIENT_NAME_LEN,
  type SalesClientAssignment,
} from "@/lib/orders/sales-client-label";

/** Formularz przypisania klienta — podpowiedzi z Subiekta jak w Nowa prośba. */
export function SalesClientNameEditor({
  value,
  clientKhId = null,
  disabled,
  onSave,
  openOnMount = false,
}: {
  value: string | null;
  clientKhId?: number | null;
  disabled?: boolean;
  onSave: (patch: SalesClientAssignment) => void | Promise<void>;
  openOnMount?: boolean;
}) {
  const [editing, setEditing] = useState(openOnMount);
  const [draftName, setDraftName] = useState(value ?? "");
  const [draftKhId, setDraftKhId] = useState<number | null>(clientKhId ?? null);
  const [saving, setSaving] = useState(false);

  const display = value?.trim() || null;

  if (!editing) return null;

  return (
    <form
      className="mt-1.5 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const nextName = draftName.trim() || null;
          await onSave({
            clientName: nextName,
            clientKhId: nextName ? draftKhId : null,
          });
          setEditing(false);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="space-y-1">
        <span className="block text-xs text-slate-500">Klient końcowy</span>
        <SubiektClientNameField
          value={draftName}
          clientKhId={draftKhId}
          maxLength={MAX_CLIENT_NAME_LEN}
          disabled={disabled || saving}
          placeholder="np. Kowalski / firma ABC"
          onChange={({ clientName, clientKhId: kh }) => {
            setDraftName(clientName);
            setDraftKhId(kh);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={disabled || saving} size="sm" className="min-h-9">
          {saving ? "Zapis…" : "Zapisz"}
        </Button>
        <button
          type="button"
          disabled={saving}
          className="min-h-9 rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
          onClick={() => {
            setDraftName(value ?? "");
            setDraftKhId(clientKhId ?? null);
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
                await onSave({ clientName: null, clientKhId: null });
                setDraftName("");
                setDraftKhId(null);
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

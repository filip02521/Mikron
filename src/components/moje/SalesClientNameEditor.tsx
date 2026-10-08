"use client";

import { useId, useRef, useState } from "react";
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
  const inputId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  /** Formularz znika — oddaj fokus przyciskowi „⋮” tej karty, żeby klawiatura nie wracała na początek strony. */
  const close = () => {
    formRef.current
      ?.closest<HTMLElement>("[id^='moje-card-']")
      ?.querySelector<HTMLElement>("[aria-haspopup='menu']")
      ?.focus({ preventScroll: true });
    setEditing(false);
  };

  const cancel = () => {
    setDraftName(value ?? "");
    setDraftKhId(clientKhId ?? null);
    close();
  };

  const display = value?.trim() || null;

  if (!editing) return null;

  return (
    <form
      ref={formRef}
      className="mt-1.5 space-y-2"
      onKeyDown={(e) => {
        // Escape z listy podpowiedzi zamyka najpierw listę (obsługuje pole); tu tylko gdy nic go nie przejęło.
        if (e.key === "Escape" && !e.defaultPrevented && !saving) {
          e.stopPropagation();
          cancel();
        }
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const nextName = draftName.trim() || null;
          await onSave({
            clientName: nextName,
            clientKhId: nextName ? draftKhId : null,
          });
          close();
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="space-y-1">
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-600">
          Klient końcowy
        </label>
        <SubiektClientNameField
          inputId={inputId}
          autoFocus={openOnMount}
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
        <Button type="button" variant="ghost" size="sm" disabled={saving} className="min-h-9" onClick={cancel}>
          Anuluj
        </Button>
        {display ? (
          <button
            type="button"
            disabled={saving}
            className="min-h-9 rounded-md px-2.5 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ clientName: null, clientKhId: null });
                setDraftName("");
                setDraftKhId(null);
                close();
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

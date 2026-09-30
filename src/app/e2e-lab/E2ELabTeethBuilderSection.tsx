"use client";

import { useState } from "react";
import { TeethOrderBuilderModal } from "@/components/teeth/TeethOrderBuilderModal";
import type { TeethLineDetail } from "@/lib/teeth/teeth-catalog";

/** Długa lista zębów — sprawdza, czy stopka z zapisem jest osiągalna na niskim ekranie. */
const LONG_DETAILS: TeethLineDetail[] = Array.from({ length: 14 }, (_, i) => ({
  position: i + 1,
  color: "A2",
  mould: null,
  jaw: null,
  kind: "anterior",
}));

export function E2ELabTeethBuilderSection() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-slate-900">Lista zębów</h2>
      <button
        type="button"
        className="rounded border px-3 py-1 text-sm"
        onClick={() => setOpen(true)}
      >
        Otwórz listę zębów
      </button>
      <p data-testid="teeth-builder-saved" className="text-sm text-slate-600">
        {saved ? "saved" : "idle"}
      </p>
      <TeethOrderBuilderModal
        open={open}
        onClose={() => setOpen(false)}
        productLine="ivoclar_phonares_ii"
        manufacturer="ivoclar"
        defaultKind="anterior"
        productLabel="Phonares II (E2E)"
        initialDetails={LONG_DETAILS}
        onSave={() => {
          setSaved(true);
          return true;
        }}
      />
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { polishPlural } from "@/lib/email/polish-plural";
import { actionServiceClientEquipment, type ClientEquipmentActionResult } from "@/app/actions/service-orders";
import type { ClientEquipmentItem } from "@/lib/subiekt/client-equipment-parse";
import { WarrantyPill } from "@/components/serwis/service-order-view";
import { warrantyMonthsFor, warrantyStatus, warrantyUntil } from "@/lib/orders/service-warranty";

/** Wybrany egzemplarz z faktury albo paragonu: model, numer seryjny i dokument zakupu (podstawa gwarancji). */
export type PickedEquipment = {
  twId: number;
  symbol: string | null;
  name: string;
  serial: string;
  purchaseDate: string | null;
  purchaseDoc: string | null;
};

const VISIBLE = 5;

function formatDate(ymd: string | null): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Sprzęt, który klient kupił u nas: pozycje jego faktur i paragonów z numerem seryjnym w uwagach. Klik w numer
 * wpisuje model i numer seryjny do przyjęcia. Gdy dokument nie ma numeru — sprzęt wybiera się niżej ręcznie.
 */
export function ClientEquipmentPicker({
  khId,
  selected,
  onPick,
  warrantyMonths,
}: {
  khId: number;
  selected: Pick<PickedEquipment, "twId" | "serial"> | null;
  onPick: (e: PickedEquipment) => void;
  /** Okresy gwarancji modeli różne od domyślnego (tw_Id → miesiące). */
  warrantyMonths: ReadonlyMap<number, number>;
}) {
  const today = new Date();
  const [result, setResult] = useState<ClientEquipmentActionResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    actionServiceClientEquipment(khId).then(
      (res) => alive && setResult(res),
      () => alive && setResult({ ok: false, message: "Nie udało się pobrać faktur i paragonów klienta z Subiekta." })
    );
    return () => {
      alive = false;
    };
  }, [khId, attempt]);

  if (!result) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <BrandLoader size="sm" tile={false} />
        <span className="text-[0.8125rem] text-slate-600">Szukam sprzętu klienta w jego fakturach i paragonach…</span>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <span className="min-w-0 flex-1 text-[0.8125rem] text-amber-900">
          {result.message} Sprzęt możesz wybrać niżej ręcznie.
        </span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setResult(null);
            setAttempt((a) => a + 1);
          }}
        >
          Spróbuj ponownie
        </Button>
      </div>
    );
  }

  if (result.items.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[0.8125rem] text-slate-600">
        Brak sprzętu z numerem seryjnym w fakturach i paragonach klienta (
        {polishPlural(result.invoicesScanned, "dokument", "dokumenty", "dokumentów")} z 10 lat). Wybierz model niżej.
      </p>
    );
  }

  const list: ClientEquipmentItem[] = showAll ? result.items : result.items.slice(0, VISIBLE);
  return (
    <section aria-labelledby={`eq-${khId}`} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`eq-${khId}`} className="text-xs font-semibold text-slate-600">
          Sprzęt klienta z faktur i paragonów ({result.items.length})
        </h3>
        <span className="text-xs text-slate-500">Kliknij numer seryjny</span>
      </div>
      <ul className="space-y-2">
        {list.map((it) => (
          <li key={`${it.invoiceId}-${it.twId}`} className="rounded-xl border border-slate-200 bg-card px-3 py-2.5">
            <div className="text-sm font-semibold text-slate-900">{it.name}</div>
            <div className="text-xs text-slate-500">
              <span className="font-mono">{it.symbol ?? "—"}</span> · {it.invoiceNumber}
              {it.invoiceDate ? ` · ${formatDate(it.invoiceDate)}` : ""}
            </div>
            <WarrantyPill
              className="mt-1.5"
              status={warrantyStatus(it.invoiceDate ? warrantyUntil(it.invoiceDate, warrantyMonthsFor(it.twId, warrantyMonths)) : null, today)}
            />
            <div role="group" aria-label={`Numery seryjne: ${it.name}`} className="mt-2 flex flex-wrap gap-1.5">
              {it.serials.map((sn) => {
                const active = selected?.twId === it.twId && selected.serial === sn;
                return (
                  <button
                    key={sn}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onPick({ twId: it.twId, symbol: it.symbol, name: it.name, serial: sn, purchaseDate: it.invoiceDate, purchaseDoc: it.invoiceNumber })
                    }
                    className={cn(
                      "inline-flex min-h-11 max-w-full items-center rounded-full border px-3 py-1 font-mono text-[0.8125rem] transition-colors duration-150",
                      active ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900" : "border-slate-200 bg-card text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span className="break-all">SN {sn}</span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {result.items.length > VISIBLE ? (
        <Button type="button" variant="secondary" className="w-full" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Pokaż mniej" : `Pokaż cały sprzęt (${result.items.length})`}
        </Button>
      ) : null}
      {result.truncated ? (
        <p className="text-xs text-slate-500">Przejrzano {polishPlural(result.invoicesScanned, "dokument", "dokumenty", "dokumentów")} — starszy sprzęt może nie być na liście.</p>
      ) : null}
    </section>
  );
}

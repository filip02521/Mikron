"use client";

import { useEffect, useState } from "react";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { polishPlural } from "@/lib/email/polish-plural";
import { actionServiceClientEquipment, type ClientEquipmentActionResult } from "@/app/actions/service-orders";
import type { ClientEquipmentItem } from "@/lib/subiekt/client-equipment-parse";

/** Wybrany egzemplarz z faktury: model + numer seryjny. */
export type PickedEquipment = { twId: number; symbol: string | null; name: string; serial: string };

const VISIBLE = 5;

function formatDate(ymd: string | null): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Sprzęt, który klient kupił u nas: pozycje jego faktur z numerem seryjnym w uwagach. Klik w numer
 * wpisuje model i numer seryjny do przyjęcia. Gdy faktura nie ma numeru — sprzęt wybiera się niżej ręcznie.
 */
export function ClientEquipmentPicker({
  khId,
  selected,
  onPick,
}: {
  khId: number;
  selected: PickedEquipment | null;
  onPick: (e: PickedEquipment) => void;
}) {
  const [result, setResult] = useState<ClientEquipmentActionResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    actionServiceClientEquipment(khId).then(
      (res) => alive && setResult(res),
      () => alive && setResult({ ok: false, message: "Nie udało się pobrać faktur klienta z Subiekta." })
    );
    return () => {
      alive = false;
    };
  }, [khId, attempt]);

  if (!result) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <BrandLoader size="sm" tile={false} />
        <span className="text-[0.8125rem] text-slate-600">Szukam sprzętu klienta w jego fakturach…</span>
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
          size="sm"
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
        Brak sprzętu z numerem seryjnym w fakturach klienta (
        {polishPlural(result.invoicesScanned, "faktura", "faktury", "faktur")} z 10 lat). Wybierz model niżej.
      </p>
    );
  }

  const list: ClientEquipmentItem[] = showAll ? result.items : result.items.slice(0, VISIBLE);
  return (
    <section aria-labelledby={`eq-${khId}`} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`eq-${khId}`} className="text-xs font-semibold text-slate-600">
          Sprzęt klienta z faktur ({result.items.length})
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
            <div role="group" aria-label={`Numery seryjne: ${it.name}`} className="mt-2 flex flex-wrap gap-1.5">
              {it.serials.map((sn) => {
                const active = selected?.twId === it.twId && selected.serial === sn;
                return (
                  <button
                    key={sn}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onPick({ twId: it.twId, symbol: it.symbol, name: it.name, serial: sn })}
                    className={cn(
                      "inline-flex min-h-8 max-w-full items-center rounded-full border px-3 py-1 font-mono text-[0.8125rem] transition-colors duration-150",
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
        <Button type="button" size="sm" variant="secondary" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Pokaż mniej" : `Pokaż cały sprzęt (${result.items.length})`}
        </Button>
      ) : null}
      {result.truncated ? (
        <p className="text-xs text-slate-500">Przejrzano {polishPlural(result.invoicesScanned, "fakturę", "faktury", "faktur")} — starszy sprzęt może nie być na liście.</p>
      ) : null}
    </section>
  );
}

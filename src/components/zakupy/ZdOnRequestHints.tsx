"use client";

import { useState, useTransition } from "react";
import { actionScanZdOnRequestHints, type ZdOnRequestHint } from "@/app/actions/zd-estimate";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { polishPluralWord } from "@/lib/email/polish-plural";

type ScanLine = { tw_Id: number; tw_Symbol: string | null; tw_Nazwa: string | null };

type ScanResult = { candidates: ZdOnRequestHint[]; stockLike: ZdOnRequestHint[]; checked: number; skipped: number };

const towary = (n: number) => `${n} ${polishPluralWord(n, "towar", "towary", "towarów")}`;

/**
 * Podpowiedzi dla bieżącej listy Kreatora: towary, które po fakturze zakupu w kilka dni bierze w całości jeden
 * klient (wyglądają na „na prośbę”, a nie są oznaczone) i oznaczone, które kupuje wielu klientów.
 * Liczone na żądanie — każdy towar to zapytanie o sprzedaż w Subiekcie.
 */
export function ZdOnRequestHints({
  lines,
  supplierName,
  markedTwIds,
  onMark,
  onClear,
  disabled,
}: {
  lines: readonly ScanLine[];
  supplierName: string | null;
  markedTwIds: ReadonlySet<number>;
  /** Oznacz pozycję listy „tylko na prośbę” (ta sama akcja co menu ⋮ w tabeli). */
  onMark: (twId: number) => void;
  onClear: (twId: number) => void;
  disabled: boolean;
}) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byTw = new Map(lines.map((l) => [l.tw_Id, l]));

  const scan = () => {
    setError(null);
    start(async () => {
      const r = await actionScanZdOnRequestHints({ twIds: lines.map((l) => l.tw_Id) });
      if (!r.ok) return setError(r.message);
      setResult(r);
    });
  };

  // Po oznaczeniu / zdjęciu z listy pozycja znika z podpowiedzi bez ponownego sprawdzania.
  const candidates = result?.candidates.filter((h) => !markedTwIds.has(h.twId)) ?? [];
  const stockLike = result?.stockLike.filter((h) => markedTwIds.has(h.twId)) ?? [];

  const label = (twId: number) => {
    const l = byTw.get(twId);
    return (
      <>
        {l?.tw_Symbol ? <span className="font-mono text-xs text-slate-500">{l.tw_Symbol}</span> : null}
        <span className="block text-sm font-medium text-slate-900">{l?.tw_Nazwa ?? `tw ${twId}`}</span>
      </>
    );
  };

  return (
    <section aria-labelledby="zd-on-request-hints" className="rounded-lg border border-slate-200 bg-card px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id="zd-on-request-hints" className="text-sm font-semibold text-slate-900">
            Podpowiedzi dla listy{supplierName ? ` ${supplierName}` : ""}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            Szukam towarów, które po wpisie faktury zakupu w ciągu kilku dni bierze w całości jeden klient - wyglądają na
            „na prośbę”, choć nie są oznaczone. Sprawdzam też oznaczone, które kupuje wielu klientów.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 max-sm:min-h-10"
          onClick={scan}
          disabled={pending || disabled || lines.length === 0}
        >
          {result ? "Sprawdź ponownie" : `Sprawdź listę (${towary(lines.length)})`}
        </Button>
      </div>

      {lines.length === 0 ? <p className="mt-2 text-xs text-slate-500">Najpierw policz listę dostawcy w Kreatorze.</p> : null}

      {pending ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-600" role="status">
          <BrandLoader size="sm" tile={false} /> Sprawdzam sprzedaż i dostawy w Subiekcie - zwykle kilkanaście sekund.
        </p>
      ) : error ? (
        <p className="mt-3 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : result ? (
        <div className="mt-3 space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-slate-700">
              Wyglądają na „na prośbę”, nieoznaczone ({candidates.length})
            </h4>
            {candidates.length ? (
              <ul className="mt-1.5 divide-y divide-slate-100 rounded-md border border-slate-200">
                {candidates.map((h) => (
                  <li key={h.twId} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      {label(h.twId)}
                      <p className="mt-0.5 text-xs text-slate-600">{h.summary}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 max-sm:min-h-10"
                      onClick={() => onMark(h.twId)}
                      disabled={disabled}
                    >
                      Oznacz na prośbę
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Brak - na tej liście nic nie wygląda na nieoznaczony towar na prośbę.</p>
            )}
          </div>

          {stockLike.length ? (
            <div>
              <h4 className="text-xs font-semibold text-slate-700">
                Oznaczone „na prośbę”, a sprzedają się jak magazynowe ({stockLike.length})
              </h4>
              <ul className="mt-1.5 divide-y divide-slate-100 rounded-md border border-slate-200">
                {stockLike.map((h) => (
                  <li key={h.twId} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      {label(h.twId)}
                      <p className="mt-0.5 text-xs text-slate-600">
                        Kupuje go {h.customers} klientów w ostatnich 18 mies. - dostaw nie bierze w całości jeden klient.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 max-sm:min-h-10"
                      onClick={() => onClear(h.twId)}
                      disabled={disabled}
                    >
                      Zdejmij „na prośbę”
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-slate-500">
            Sprawdzone: {towary(result.checked)} z dostawą albo oznaczeniem (ostatnie 18 mies.).
            {result.skipped ? ` Pominięte ${result.skipped} - limit jednego sprawdzenia; zawęź listę.` : ""} To podpowiedzi -
            decyzja należy do Ciebie.
          </p>
        </div>
      ) : null}
    </section>
  );
}

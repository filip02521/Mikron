"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { ZdBacktestPanel, ZD_BACKTEST_VERDICT_BADGE, ZD_BACKTEST_VERDICT_LABEL } from "@/components/zakupy/ZdBacktestPanel";
import {
  ZD_AUTO_LEVEL_OPTIONS,
  ZdSupplierOrderPolicyDialog,
} from "@/components/zakupy/ZdSupplierOrderPolicyDialog";
import type { ZdAutomatSupplierRow } from "@/lib/data/zd-automat-suppliers";
import { zdBacktestAgeDays, ZD_AUTOMAT_BACKTEST_STALE_DAYS } from "@/lib/orders/zd-automat-status";
import { formatWarsawDateTime } from "@/lib/time/warsaw";

/**
 * Dostawca w automacie ZD: propozycje powstają w rytmie strategii, a cykl z karty dalej działa — Częstotliwość
 * daje przypomnienia w Terminach zamówień, Zapas to okno sprzedaży, z którego automat liczy tempo.
 */
export const ZD_AUTOMAT_CARD_CYCLE_MEANING =
  "Ilości w ZD liczy automat (sekcja wyżej). Częstotliwość wyznacza tylko przypomnienia w Terminach zamówień, a Zapas - okno sprzedaży, z którego automat liczy tempo.";

export const zdInAutomat = (row: Pick<ZdAutomatSupplierRow, "policy">) => row.policy.strategy !== "classic";

/** „27.10” — dzień automatycznego cofnięcia stopnia (Warszawa). */
export function formatRollbackDay(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit" });
}
export const zdBacktestRunning = (row: Pick<ZdAutomatSupplierRow, "backtest">) =>
  row.backtest?.status === "queued" || row.backtest?.status === "running";

/** Werdykt ostatniego backtestu: odznaka i parametry z datą; stary (> 90 dni) — z prośbą o ponowne policzenie. */
export function ZdBacktestState({ row, nowMs: nowProp }: { row: Pick<ZdAutomatSupplierRow, "backtest">; nowMs?: number }) {
  const [nowMs] = useState(() => nowProp ?? Date.now());
  const b = row.backtest;
  if (!b) return <span className="text-sm text-slate-500">nie liczony</span>;
  if (zdBacktestRunning(row)) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-slate-600" role="status">
        <BrandLoader size="sm" tile={false} /> liczy się…
      </span>
    );
  }
  if (b.status === "error") return <Badge variant="danger">błąd przebiegu</Badge>;
  const age = zdBacktestAgeDays(b.at, nowMs);
  return (
    <span className="flex flex-col items-start gap-0.5" title={b.headline ?? undefined}>
      {b.verdict ? <Badge variant={ZD_BACKTEST_VERDICT_BADGE[b.verdict]}>{ZD_BACKTEST_VERDICT_LABEL[b.verdict]}</Badge> : null}
      <span className="text-xs text-slate-500 md:whitespace-nowrap">
        co {b.params.cycleDays} d, cel {b.params.targetDays} d · {formatWarsawDateTime(b.at)}
      </span>
      {age > ZD_AUTOMAT_BACKTEST_STALE_DAYS ? (
        <span className="text-xs font-medium text-amber-800">sprzed {age} dni - policz ponownie</span>
      ) : null}
    </span>
  );
}

function levelLabel(level: number): string {
  const label = ZD_AUTO_LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? String(level);
  return `stopień ${label}`;
}

/**
 * Sekcja „Automat ZD” w karcie dostawcy — jedno miejsce na ustawienia dostawcy: stan automatu, ostatni backtest
 * i te same okna co w Kreatorze i na pulpicie Automatu (nad panelem karty, warstwa `top`).
 */
export function ZdAutomatCardSection({
  row,
  canManage,
  onChanged,
}: {
  row: ZdAutomatSupplierRow;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<"policy" | "backtest" | null>(null);
  const on = zdInAutomat(row);
  const p = row.policy;
  return (
    <section
      aria-labelledby={`zd-automat-card-${row.id}`}
      className="rounded-lg border border-slate-200 bg-white p-4 sm:col-span-2"
    >
      <h3 id={`zd-automat-card-${row.id}`} className="text-xs font-semibold text-slate-600">
        Automat ZD
      </h3>
      <p className="mt-1 text-sm font-medium text-slate-900">
        {on
          ? [
              "W automacie",
              p.cycleDays ? (p.cycleDays === 1 ? "codziennie" : `co ${p.cycleDays} dni`) : null,
              p.targetDays ? `cel ${p.targetDays} dni zapasu` : null,
              levelLabel(p.autoLevel),
            ]
              .filter(Boolean)
              .join(" · ")
          : "Poza automatem - ZD liczysz w Kreatorze jak dotąd"}
      </p>
      {on && row.levelRollback ? (
        <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs leading-snug text-amber-900">
          Stopień obniżony automatycznie {formatRollbackDay(row.levelRollback.at)}: {row.levelRollback.reason}. Podniesiesz go
          w ustawieniach, gdy braki spadną.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-start gap-x-2 gap-y-1 text-sm text-slate-600">
        <span>Ostatni backtest:</span>
        <ZdBacktestState row={row} />
      </div>
      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setOpen("policy")}>
            {on ? "Zmień ustawienia" : "Włącz automat"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setOpen("backtest")}>
            Backtest
          </Button>
        </div>
      ) : null}
      {open === "policy" ? (
        <ZdSupplierOrderPolicyDialog
          supplierId={row.id}
          supplierName={row.name}
          policy={row.policy}
          tier="top"
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            onChanged();
          }}
        />
      ) : null}
      {open === "backtest" ? (
        <ZdBacktestPanel
          supplierId={row.id}
          supplierName={row.name}
          policy={row.policy}
          canManage={canManage}
          tier="top"
          onClose={() => setOpen(null)}
          onChanged={onChanged}
        />
      ) : null}
    </section>
  );
}

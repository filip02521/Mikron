"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { actionApplyZdBacktestSettings, actionGetZdBacktestRun, actionStartZdBacktest } from "@/app/actions/zd-backtest";
import { actionSaveZdSupplierOrderPolicy } from "@/app/actions/zd-estimate";
import { Alert } from "@/components/ui/Alert";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { ModalShell, type ModalTier } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { IconCheck, IconChevronDown } from "@/components/icons/StrokeIcons";
import type { ZdBacktestProgress, ZdBacktestResult, ZdBacktestRun } from "@/lib/data/zd-backtest-run";
import type { ZdSupplierOrderPolicyRow } from "@/lib/data/zd-supplier-order-policy";
import type { ZdBacktestVerdictKind } from "@/lib/orders/zd-backtest";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import { ZD_BACKTEST_SEARCH_VERSION, ZD_BACKTEST_VERDICT_LABEL, zdBacktestApplyBlock, zdBacktestCycleText } from "@/lib/orders/zd-automat-status";

const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });
const pct = (v: number | null | undefined) => (v == null ? "—" : `${nf1.format(v)}%`);
const zl = (v: number) => (Math.abs(v) >= 1_000_000 ? `${nf2.format(v / 1_000_000)} mln zł` : Math.abs(v) >= 10_000 ? `${nf0.format(v / 1000)} tys. zł` : `${nf0.format(v)} zł`);
const dm = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`;

export { ZD_BACKTEST_VERDICT_LABEL };
export const ZD_BACKTEST_VERDICT_BADGE: Record<ZdBacktestVerdictKind, "success" | "warning" | "danger" | "default"> = {
  works: "success",
  tradeoff: "default",
  fails: "danger",
  insufficient: "default",
};

/** Etapy na ekranie; krótki krok „simulate” (czas dostawy) liczy się do szukania. */
const PHASES: { key: ZdBacktestProgress["phase"]; title: string; text: string }[] = [
  { key: "products", title: "Towary", text: "Czytam towary zakresu dostawcy" },
  { key: "sales", title: "Sprzedaż", text: "Pobieram sprzedaż z Subiekta" },
  { key: "stock", title: "Stany", text: "Pobieram dzienne stany z remanentu" },
  { key: "search", title: "Szukanie", text: "Szukam najlepszych ustawień" },
];
const phaseIndex = (phase: ZdBacktestProgress["phase"] | undefined) =>
  Math.max(0, PHASES.findIndex((p) => p.key === (phase === "simulate" ? "search" : phase)));

/** „ZD co 7 dni, cel 25 dni”. */
const settingsText = (p: { cycleDays: number; targetDays: number }) => `ZD ${zdBacktestCycleText(p.cycleDays)}, cel ${p.targetDays} dni`;

// Kreskowany prowadnik między etykietą a wartością (z 21st.dev ReUI stepper-18): w wierszu items-baseline
// pusty flex-item ma linię bazową na dole, więc kreska siada na linii tekstu.
function Leader() {
  return <span aria-hidden className="min-w-3 flex-1 border-b border-dashed border-slate-300" />;
}

function KeyValue({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="flex items-baseline gap-1.5 text-sm">
      <dt className="text-slate-600">{label}</dt>
      <Leader />
      <dd className={cn("whitespace-nowrap font-medium tabular-nums", tone === "warning" ? "text-amber-800" : "text-slate-900")}>{value}</dd>
    </div>
  );
}

/** Etapy przebiegu jako stepper: zrobione (zielony haczyk), bieżący (pulsuje), czekające. */
function PhaseStepper({ progress }: { progress: Partial<ZdBacktestProgress> | undefined }) {
  const current = phaseIndex(progress?.phase);
  return (
    <ol className="grid w-full grid-cols-4" aria-label="Etapy backtestu">
      {PHASES.map((p, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        const value =
          state === "done"
            ? "gotowe"
            : state === "pending"
              ? "czeka"
              : progress?.total && progress.phase !== "simulate"
                ? `${nf0.format(progress.done ?? 0)}/${nf0.format(progress.total)}`
                : "trwa";
        return (
          <li key={p.key} className="flex min-w-0 flex-col gap-2" aria-current={state === "active" ? "step" : undefined}>
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  state === "done" && "bg-emerald-600 text-white",
                  state === "active" && "ring-2 ring-inset ring-indigo-600",
                  state === "pending" && "ring-1 ring-inset ring-slate-300"
                )}
                aria-hidden
              >
                {state === "done" ? (
                  <IconCheck size={14} strokeWidth={2.5} />
                ) : state === "active" ? (
                  <span className="size-2.5 rounded-full bg-indigo-600 motion-safe:animate-pulse" />
                ) : null}
              </span>
              {i < PHASES.length - 1 ? (
                <span className={cn("h-0 flex-1 border-t-2 border-dotted", i < current ? "border-emerald-500" : "border-slate-300")} aria-hidden />
              ) : null}
            </div>
            {/* Telefon: etykieta nad wartością; od sm w jednym wierszu z prowadnikiem. */}
            <div className="flex min-w-0 flex-col gap-0.5 pe-2 sm:flex-row sm:items-baseline sm:gap-1 sm:pe-3">
              <span className={cn("truncate text-xs font-medium sm:text-sm", state === "pending" ? "text-slate-500" : "text-slate-900")}>{p.title}</span>
              <span className="hidden min-w-3 flex-1 border-b border-dashed border-slate-300 sm:block" aria-hidden />
              <span className="whitespace-nowrap text-xs tabular-nums text-slate-500">{value}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type CompareRow = {
  key: string;
  label: string;
  settings: string;
  zeroShare: number | null;
  avgStock: number;
  orders: number | null;
  medianOrder: number | null;
  /** Koszt roku: utracona marża + utrzymanie zapasu + obsługa ZD. */
  cost: number | null;
  lostMargin: number | null;
};

const COMPARE_GRID = "sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1fr)_7.5rem_5.5rem]";

/** Porównanie wariantów paskami: długość względem największej wartości w kolumnie, zmiana względem „naprawdę”. */
function CompareBars({ rows, reality }: { rows: CompareRow[]; reality: CompareRow }) {
  const maxZero = Math.max(...rows.map((r) => r.zeroShare ?? 0), 0.1);
  const maxStock = Math.max(...rows.map((r) => r.avgStock), 1);
  const delta = (v: number | null, base: number | null, unit: "pp" | "%") => {
    if (v == null || base == null) return null;
    const d = unit === "pp" ? v - base : base ? ((v - base) / base) * 100 : 0;
    if (Math.abs(d) < 0.05) return { text: "bez zmian", better: null };
    return { text: `${d > 0 ? "+" : "−"}${nf1.format(Math.abs(d))}${unit === "pp" ? " pp" : "%"}`, better: d < 0 };
  };
  const metric = (label: string, value: string, raw: number, max: number, strong: boolean, d: ReturnType<typeof delta>) => (
    <div className="min-w-0">
      <p className="text-[0.6875rem] font-medium text-slate-500 sm:hidden">{label}</p>
      <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
        <span className="font-semibold text-slate-900">{value}</span>
        {d ? (
          <span className={cn("text-xs", d.better == null ? "text-slate-500" : d.better ? "text-emerald-700" : "text-red-700")}>{d.text}</span>
        ) : null}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div className={cn("h-full rounded-full", strong ? "bg-indigo-600" : "bg-slate-400")} style={{ width: `${Math.max(2, (raw / max) * 100)}%` }} />
      </div>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className={cn("hidden gap-4 bg-slate-50 px-4 py-2 text-[0.8125rem] font-medium text-slate-500 sm:grid", COMPARE_GRID)}>
        <span>Wariant</span>
        <span>Towary z zerowym stanem</span>
        <span>Średni zapas</span>
        <span className="text-right" title="Utracona marża na brakach + 20% średniego zapasu rocznie + koszt każdego ZD">Koszt roku</span>
        <span className="text-right">ZD w roku</span>
      </div>
      <ul>
        {rows.map((r) => {
          const strong = r.key === "automat";
          const isReality = r.key === reality.key;
          return (
            <li
              key={r.key}
              className={cn(
                "grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 first:border-t-0 sm:items-center sm:first:border-t",
                COMPARE_GRID,
                strong && "bg-indigo-50/40"
              )}
            >
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <p className="text-sm font-medium text-slate-900">{r.label}</p>
                <p className="text-xs text-slate-500">{r.settings}</p>
              </div>
              {metric("Zerowy stan", pct(r.zeroShare), r.zeroShare ?? 0, maxZero, strong, isReality ? null : delta(r.zeroShare, reality.zeroShare, "pp"))}
              {metric("Średni zapas", zl(r.avgStock), r.avgStock, maxStock, strong, isReality ? null : delta(r.avgStock, reality.avgStock, "%"))}
              <div className="text-sm tabular-nums text-slate-600 sm:text-right">
                {r.cost == null ? (
                  <span className="hidden text-slate-500 sm:inline">—</span>
                ) : (
                  <>
                    <span className="sm:hidden">Koszt roku: </span>
                    <span className={cn("font-medium", strong ? "text-indigo-900" : "text-slate-900")}>{zl(r.cost)}</span>
                    {r.lostMargin ? <span className="block text-xs text-slate-500">braki {zl(r.lostMargin)}</span> : null}
                  </>
                )}
              </div>
              <div className="text-sm tabular-nums text-slate-600 sm:text-right">
                {r.orders == null ? (
                  <span className="hidden text-slate-500 sm:inline">—</span>
                ) : (
                  <>
                    <span className="sm:hidden">ZD w roku: </span>
                    <span className="font-medium text-slate-900">{nf0.format(r.orders)}</span>
                    {r.medianOrder != null ? <span className="block text-xs text-slate-500 max-sm:inline"> po ok. {zl(r.medianOrder)}</span> : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Jedna liczba odpowiedzi: wartość automatu i punkt odniesienia; kolor zmiany tylko przy różnicy. */
function AnswerMetric({ label, value, base, baseLabel, better }: { label: string; value: string; base: string; baseLabel: string; better: boolean | null }) {
  return (
    <div className="min-w-0 py-3 sm:px-4 sm:first:ps-0 sm:last:pe-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5">
        <span className={cn("text-lg font-semibold tabular-nums", better == null ? "text-slate-900" : better ? "text-emerald-800" : "text-amber-800")}>{value}</span>
        <span className="block text-xs text-slate-600">
          {baseLabel} {base}
        </span>
      </dd>
    </div>
  );
}

/** Szczegóły (porównanie wariantów, dane, metoda) — dla sprawdzających; odpowiedź stoi nad nimi. */
function ResultDetails({ result, compareRows }: { result: ZdBacktestResult; compareRows: CompareRow[] }) {
  const automat = result.variants.find((v) => v.key === "automat");
  return (
    <details className="group rounded-lg border border-slate-200">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
        Jak to policzono: porównanie i dane
        <IconChevronDown size={16} className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="space-y-4 border-t border-slate-200 px-4 py-4">
        <CompareBars rows={compareRows} reality={compareRows[0]!} />
        <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
          <KeyValue label="Towary aktywne" value={`${nf0.format(result.quality.activeSkus)} z ${nf0.format(result.quality.skus)}`} />
          <KeyValue label="Zmierzone dostawy" value={nf0.format(result.quality.leadSamples)} />
          <KeyValue label="Pominięte wykluczone" value={nf0.format(result.quality.excluded)} />
          <KeyValue label="Pominięte na prośbę" value={nf0.format(result.quality.onRequest)} />
          <KeyValue label="Cena dla aktywnych" value={pct(result.quality.pricedActiveShare)} tone={result.quality.pricedActiveShare < 90 ? "warning" : undefined} />
          {result.quality.hiddenOutflowShare != null ? (
            <KeyValue label="Rozchód bez sprzedaży" value={pct(result.quality.hiddenOutflowShare)} tone={result.quality.hiddenOutflowShare >= 10 ? "warning" : undefined} />
          ) : null}
          {result.model ? <KeyValue label="Okno sprzedaży" value={`${result.model.windowDays} dni (jak Kreator)`} /> : null}
          {result.model ? <KeyValue label="Podążanie za sprzedażą" value={result.model.trackPreset ?? "wyłączone"} /> : null}
          {result.model?.orderCost != null ? <KeyValue label="Koszt jednego ZD (w koszcie roku)" value={zl(result.model.orderCost)} /> : null}
          {result.model && "minOrderValue" in result.model ? (
            <KeyValue
              label="Minimum / darmowa dostawa"
              value={`${result.model.minOrderValue != null ? zl(result.model.minOrderValue) : "brak"} / ${result.model.freeShippingThreshold != null ? zl(result.model.freeShippingThreshold) : "brak"}`}
            />
          ) : null}
          {result.quality.imputedShare != null ? (
            <KeyValue label="Popyt dopisany za braki" value={pct(result.quality.imputedShare)} tone={result.quality.imputedShare >= 15 ? "warning" : undefined} />
          ) : null}
          {result.quality.prosbaShare != null ? <KeyValue label="Sprzedaż pod prośby (poza zapasem)" value={pct(result.quality.prosbaShare)} /> : null}
          {result.quality.zkShare != null ? <KeyValue label="Sprzedaż z zamówień klientów (ZK)" value={pct(result.quality.zkShare)} /> : null}
          {automat?.metrics.zk ? (
            <KeyValue
              label="ZK wydane po terminie (automat)"
              value={
                automat.metrics.zk.lateQty
                  ? `${nf0.format(automat.metrics.zk.lateQty)} z ${nf0.format(automat.metrics.zk.qty)} szt., śr. ${nf1.format(automat.metrics.zk.avgDelayDays ?? 0)} dni`
                  : `0 z ${nf0.format(automat.metrics.zk.qty)} szt.`
              }
            />
          ) : null}
          {result.quality.minStockSkus ? <KeyValue label="Towary z minimum stanów" value={nf0.format(result.quality.minStockSkus)} /> : null}
          {result.quality.marginActiveShare != null ? (
            <KeyValue label="Marża dla aktywnych" value={pct(result.quality.marginActiveShare)} tone={result.quality.marginActiveShare < 80 ? "warning" : undefined} />
          ) : null}
          {result.quality.pairs ? <KeyValue label="Pary paczka↔sztuka" value={nf0.format(result.quality.pairs)} /> : null}
          {result.quality.explodedBoms ? <KeyValue label="Komplety na składniki" value={nf0.format(result.quality.explodedBoms)} /> : null}
        </dl>
        {result.notes.length ? (
          <ul className="space-y-1 text-sm text-slate-600">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs leading-relaxed text-slate-500">
          Każde ustawienie to pełny rok decyzji liczonych jak nocny przebieg: okno dni zapasu dostawcy, korekta dni braku, prośby poza zapasem,
          rezerwacje z ZK, podążanie za sprzedażą, minimum stanów, opakowania, minimum zamówienia i darmowa dostawa, czas dostawy znany w dniu
          decyzji, stany dzienne. Wygrywa najniższy koszt roku (utracona marża na brakach + 20% średniego zapasu + koszt każdego ZD) wśród
          ustawień, które mają braki nie większe niż naprawdę także przy opóźnionych dostawach i trzymają w kwartałach (najlepiej we
          wszystkich, co najmniej w trzech). Gdy takich nie ma — wśród tych z brakami nie większymi niż naprawdę, a dopiero potem
          najtańsze w ogóle (pod warunkiem, że marża jest znana dla co najmniej 80% towarów). Remis kosztu do 1% rozstrzyga mniej braków.
          Cykl tylko z listy (codziennie, co 2, 3, 4, 5, 7, 10, 14, 21, 28 dni), cel co 1 dzień. Cel to minimum — przy długiej dostawie
          silnik podnosi go sam (cykl + dostawa + 25%).
        </p>
      </div>
    </details>
  );
}

export function ZdBacktestPanel({
  supplierId,
  supplierName,
  policy,
  canManage,
  onClose,
  onChanged,
  onApplied,
  tier,
}: {
  supplierId: string;
  supplierName: string;
  policy: ZdSupplierOrderPolicyRow;
  canManage: boolean;
  onClose: () => void;
  /** Po włączeniu automatu albo zakończeniu backtestu — lista odświeża się w tle. */
  onChanged: () => void;
  /** Po zapisie ustawień z backtestu (albo wyłączeniu automatu) — nowe ustawienia dostawcy. */
  onApplied?: (policy: ZdSupplierOrderPolicyRow) => void;
  /** `top` — nad panelem karty dostawcy (z-[70]). */
  tier?: ModalTier;
}) {
  const [current, setCurrent] = useState(policy);
  const inAutomat = current.strategy !== "classic";
  const [run, setRun] = useState<ZdBacktestRun | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const wasRunning = useRef(false);

  const load = useCallback(async () => {
    const r = await actionGetZdBacktestRun({ supplierId });
    if (!r?.ok) return setError(r?.message ?? "Nie udało się odczytać backtestu.");
    setRun(r.run);
    const running = r.run?.status === "queued" || r.run?.status === "running";
    if (wasRunning.current && !running) onChanged();
    wasRunning.current = running;
  }, [supplierId, onChanged]);

  useEffect(() => {
    let cancelled = false;
    void actionGetZdBacktestRun({ supplierId }).then((r) => {
      if (cancelled) return;
      if (!r?.ok) return setError(r?.message ?? "Nie udało się odczytać backtestu.");
      setRun(r.run);
      wasRunning.current = r.run?.status === "queued" || r.run?.status === "running";
    });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  const running = run?.status === "queued" || run?.status === "running";
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(id);
  }, [running, load]);

  const start = async () => {
    setError(null);
    setSaved(null);
    setStarting(true);
    const r = await actionStartZdBacktest({ supplierId });
    setStarting(false);
    if (!r.ok) return setError(r.message);
    wasRunning.current = true;
    await load();
  };

  const apply = async () => {
    if (!run) return;
    setError(null);
    setSaving(true);
    const r = await actionApplyZdBacktestSettings({ supplierId, runId: run.id });
    setSaving(false);
    if (!r.ok) {
      setError(r.message);
      // Np. nowszy przebieg od otwarcia okna — pokaż to, co jest teraz.
      return void load();
    }
    setCurrent(r.policy);
    setSaved(r.message);
    onApplied?.(r.policy);
    onChanged();
  };

  const turnOff = async () => {
    setError(null);
    setSaving(true);
    const r = await actionSaveZdSupplierOrderPolicy({
      supplierId,
      strategy: "classic",
      targetDays: null,
      cycleDays: null,
      autoLevel: 0,
      cutoffTime: current.cutoffTime,
    });
    setSaving(false);
    if (!r.ok) return setError(r.message);
    setCurrent(r.policy);
    setSaved("Automat wyłączony - ZD liczysz w Kreatorze jak dotąd.");
    onApplied?.(r.policy);
    onChanged();
  };

  const result = run?.status === "done" ? run.result : null;
  const searched = result != null && result.version >= ZD_BACKTEST_SEARCH_VERSION;
  const best = searched ? result.params : null;
  const block = run
    ? zdBacktestApplyBlock(
        { status: run.status, verdict: result?.verdict.kind ?? null, at: run.createdAt, params: result?.params ?? null, version: result?.version ?? null },
        nowMs
      )
    : zdBacktestApplyBlock(null, nowMs);
  const sameAsPolicy = !!best && inAutomat && current.cycleDays === best.cycleDays && current.targetDays === best.targetDays;
  const canApply = canManage && !running && !block && !!best && !sameAsPolicy;
  const kreator = result?.variants.find((v) => v.key === "kreator");
  const automat = result?.variants.find((v) => v.key === "automat");
  const pessimistic = result?.variants.find((v) => v.key === "pessimistic");
  const progress = run?.progress;
  const compareRows: CompareRow[] = result
    ? [
        {
          key: "reality",
          label: "Naprawdę",
          settings: "stany z remanentu",
          zeroShare: result.reality.zeroShare,
          avgStock: result.reality.avgStock,
          orders: null,
          medianOrder: null,
          // „Naprawdę” obsłużyło z definicji całą zapisaną sprzedaż — koszt nieporównywalny z symulacją.
          cost: null,
          lostMargin: null,
        },
        ...[kreator, automat, pessimistic].flatMap((v) =>
          v
            ? [
                {
                  key: v.key,
                  label: v.label,
                  settings: v.settings,
                  zeroShare: v.metrics.zeroShare,
                  avgStock: v.metrics.avgStock,
                  orders: v.metrics.orders,
                  medianOrder: v.metrics.medianOrder,
                  cost: v.metrics.cost ?? null,
                  lostMargin: v.metrics.lostMargin ?? null,
                },
              ]
            : []
        ),
      ]
    : [];

  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
      <Button variant="secondary" onClick={onClose}>
        Zamknij
      </Button>
      {canManage && inAutomat && searched && result?.verdict.kind === "fails" && !running ? (
        <Button variant="secondary" onClick={() => void turnOff()} disabled={saving}>
          {saving ? <Spinner /> : null}
          Wyłącz automat
        </Button>
      ) : null}
      {!canManage || running ? null : canApply ? (
        <>
          <Button variant="ghost" onClick={() => void start()} disabled={starting || saving}>
            {starting ? <Spinner /> : null}
            Policz ponownie
          </Button>
          <Button onClick={() => void apply()} disabled={saving || starting}>
            {saving ? <Spinner /> : null}
            {inAutomat ? "Przestaw automat" : "Włącz automat"}: {settingsText(best!)}
          </Button>
        </>
      ) : block ? (
        <Button onClick={() => void start()} disabled={starting || saving || run === undefined}>
          {starting ? <Spinner /> : null}
          {searched ? "Policz ponownie" : "Znajdź najlepsze ustawienia"}
        </Button>
      ) : (
        <Button variant="ghost" onClick={() => void start()} disabled={starting || saving}>
          {starting ? <Spinner /> : null}
          Policz ponownie
        </Button>
      )}
    </div>
  );

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Backtest — ${supplierName}`}
      tier={tier}
      description="Backtest sam znajduje, co ile dni zamawiać i na ile dni zapasu: sprawdza każde ustawienie na roku prawdziwej sprzedaży i stanów z Subiekta, tym samym silnikiem co automat. Nic nie zapisuje się w Subiekcie."
      size="xl"
      bodyClassName="space-y-5 px-5 py-5 sm:px-6"
      footer={footer}
    >
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <span className={cn("size-1.5 shrink-0 rounded-full", inAutomat ? "bg-emerald-600" : "bg-slate-300")} aria-hidden />
        {inAutomat
          ? `Teraz w automacie: ${current.cycleDays && current.targetDays ? settingsText({ cycleDays: current.cycleDays, targetDays: current.targetDays }) : "bez ustawień"}`
          : "Teraz poza automatem - ZD liczysz w Kreatorze"}
      </p>

      {error ? (
        <Alert tone="error" title="Nie udało się">
          {error}
        </Alert>
      ) : null}
      {saved ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800" role="status">
          {saved}
        </p>
      ) : null}

      {run === undefined ? (
        <div className="flex items-center gap-3 py-6" role="status">
          <BrandLoader size="sm" />
          <span className="text-sm text-slate-600">Wczytuję ostatni backtest…</span>
        </div>
      ) : running ? (
        <div className="flex flex-col items-center gap-5 rounded-lg border border-slate-200 px-4 py-8 text-center sm:px-8" role="status">
          <BrandLoader size="lg" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-900">
              {PHASES[phaseIndex(progress?.phase)]!.text}
              {progress?.total && progress.phase !== "simulate" ? ` — ${nf0.format(progress.done ?? 0)} z ${nf0.format(progress.total)}` : "…"}
            </p>
            <p className="mx-auto max-w-md text-sm text-slate-600">
              Zwykle od minuty do kilku minut (duże zakresy). Możesz zamknąć okno — wynik się zapisze i pokaże na liście.
            </p>
          </div>
          <div className="w-full max-w-2xl text-left">
            <PhaseStepper progress={progress} />
          </div>
        </div>
      ) : run?.status === "error" ? (
        <Alert tone="error" title="Backtest się nie udał">
          {`Przebieg z ${formatWarsawDateTime(run.createdAt)}: ${run.error ?? "nieznany błąd"}. Policz ponownie.`}
        </Alert>
      ) : !result ? (
        <div className="rounded-lg bg-slate-50 px-4 py-6 text-sm leading-relaxed text-slate-600">
          Ten dostawca nie ma jeszcze backtestu. <span className="font-medium text-slate-900">Znajdź najlepsze ustawienia</span> sprawdzi zamawianie od
          codziennie do co 4 tygodnie i cel od 10 do 90 dni (dalej, gdy trzeba), a potem dopracuje cel co 1 dzień. Automat włączysz jednym kliknięciem z tym, co znajdzie.
        </div>
      ) : !searched ? (
        <Alert tone="info" title="Ten wynik nie dobierał ustawień">
          {`Backtest z ${formatWarsawDateTime(run!.createdAt)} liczył ustawienia wybrane ręcznie (co ${result.params?.cycleDays ?? "?"} dni, cel ${result.params?.targetDays ?? "?"} dni). Teraz backtest sam szuka najlepszych - policz ponownie.`}
        </Alert>
      ) : (
        <>
          <section aria-labelledby="bt-answer" className="rounded-lg border border-slate-200 px-4 py-4 sm:px-5">
            <p className="text-xs font-medium text-slate-500">
              {result.verdict.kind === "works" ? "Najlepsze ustawienia" : result.verdict.kind === "fails" ? "Najlepsze, co da się ustawić" : "Wynik"}
            </p>
            <h3 id="bt-answer" className="mt-0.5 text-xl font-semibold leading-snug text-balance text-slate-900">
              {best && result.verdict.kind !== "insufficient" ? settingsText(best) : result.verdict.headline}
            </h3>
            {result.verdict.kind === "insufficient" ? (
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-700">
                {result.verdict.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : automat && kreator ? (
              <>
                <dl className="mt-2 grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <AnswerMetric
                    label="Towary z zerowym stanem"
                    value={pct(automat.metrics.zeroShare)}
                    baseLabel="naprawdę"
                    base={pct(result.reality.zeroShare)}
                    better={automat.metrics.zeroShare == null || result.reality.zeroShare == null ? null : automat.metrics.zeroShare <= result.reality.zeroShare}
                  />
                  <AnswerMetric
                    label="Średni zapas"
                    value={zl(automat.metrics.avgStock)}
                    baseLabel="naprawdę"
                    base={zl(result.reality.avgStock)}
                    better={automat.metrics.avgStock <= result.reality.avgStock}
                  />
                  <AnswerMetric
                    label="Koszt roku"
                    value={zl(automat.metrics.cost)}
                    baseLabel="Kreator dziś"
                    base={zl(kreator.metrics.cost)}
                    better={automat.metrics.cost <= kreator.metrics.cost}
                  />
                </dl>
                {pessimistic?.metrics.zeroShare != null && result.reality.zeroShare != null && pessimistic.metrics.zeroShare > result.reality.zeroShare + 1 ? (
                  <p className="mt-1 text-sm text-slate-700">
                    Gdy dostawca się spóźnia (towar dopiero z ostatnią dostawą), braki rosną do {pct(pessimistic.metrics.zeroShare)}.
                  </p>
                ) : null}
                {result.verdict.kind === "fails" ? (
                  <p className="mt-2 text-sm font-medium text-amber-900">
                    Nawet najlepsze ustawienia mają więcej braków niż naprawdę i nie są tańsze od Kreatora - zostań przy Kreatorze.
                  </p>
                ) : null}
              </>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">
              {result.searched
                ? `Sprawdzono ${nf0.format(result.searched.points)} ${polishPluralWord(result.searched.points, "ustawienie", "ustawienia", "ustawień")}: ZD co ${result.searched.cycles[0]}–${result.searched.cycles[1]} dni, cel ${result.searched.targets[0]}–${result.searched.targets[1]} dni · `
                : ""}
              okres {dm(result.period.from)}–{dm(result.period.to)} · policzone {formatWarsawDateTime(run!.finishedAt ?? run!.createdAt)}
            </p>
          </section>

          {block && best && result.verdict.kind === "works" ? (
            <Alert tone="warning" title="Najpierw policz ponownie">
              {sameAsPolicy ? `${block} Automat ma te ustawienia, ale nie wiadomo, czy dalej są najlepsze.` : block}
            </Alert>
          ) : sameAsPolicy ? (
            <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800" role="status">
              <IconCheck size={16} aria-hidden />
              Automat ma już te ustawienia.
            </p>
          ) : null}

          <ResultDetails result={result} compareRows={compareRows} />
        </>
      )}
    </ModalShell>
  );
}

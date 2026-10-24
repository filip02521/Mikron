"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { actionGetZdBacktestRun, actionStartZdBacktest } from "@/app/actions/zd-backtest";
import { actionSaveZdSupplierOrderPolicy } from "@/app/actions/zd-estimate";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { ModalShell, type ModalTier } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { IconCheck } from "@/components/icons/StrokeIcons";
import type { ZdBacktestProgress, ZdBacktestResult, ZdBacktestRun } from "@/lib/data/zd-backtest-run";
import type { ZdSupplierOrderPolicyRow } from "@/lib/data/zd-supplier-order-policy";
import type { ZdBacktestGridPoint, ZdBacktestRecommendationTier, ZdBacktestVerdictKind } from "@/lib/orders/zd-backtest";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import { ZD_BACKTEST_VERDICT_LABEL } from "@/lib/orders/zd-automat-status";

const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });
const pct = (v: number | null | undefined) => (v == null ? "—" : `${nf1.format(v)}%`);
const zl = (v: number) => (Math.abs(v) >= 1_000_000 ? `${nf2.format(v / 1_000_000)} mln zł` : Math.abs(v) >= 10_000 ? `${nf0.format(v / 1000)} tys. zł` : `${nf0.format(v)} zł`);
const dm = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`;

export { ZD_BACKTEST_VERDICT_LABEL };
export const ZD_BACKTEST_VERDICT_BADGE: Record<ZdBacktestVerdictKind, "success" | "warning" | "danger" | "default"> = {
  works: "success",
  tradeoff: "warning",
  fails: "danger",
  insufficient: "default",
};
const VERDICT_SURFACE: Record<ZdBacktestVerdictKind, string> = {
  works: "bg-emerald-50 text-emerald-900",
  tradeoff: "bg-amber-50 text-amber-900",
  fails: "bg-red-50 text-red-800",
  insufficient: "bg-slate-50 text-slate-700",
};
const VERDICT_DOT: Record<ZdBacktestVerdictKind, string> = {
  works: "bg-emerald-600",
  tradeoff: "bg-amber-500",
  fails: "bg-red-600",
  insufficient: "bg-slate-400",
};

const PHASES: { key: ZdBacktestProgress["phase"]; title: string; text: string }[] = [
  { key: "products", title: "Towary", text: "Czytam towary zakresu dostawcy" },
  { key: "sales", title: "Sprzedaż", text: "Pobieram sprzedaż z Subiekta" },
  { key: "stock", title: "Stany", text: "Pobieram tygodniowe stany z remanentu" },
  { key: "simulate", title: "Symulacja", text: "Symuluję rok zamówień" },
];

const CYCLE_OPTIONS = [1, 2, 3, 5, 7, 14, 21];
const cycleLabel = (c: number) => (c === 1 ? "codziennie" : `co ${c} dni`);

const REC_TITLE: Record<ZdBacktestRecommendationTier, string> = {
  works: "Najlepsze ustawienie",
  delay_sensitive: "Najlepsze przy zwykłych dostawach",
  more_stock: "Mniej braków za cenę zapasu",
  lowest_cost: "Najniższy koszt",
};
const REC_NOTE: Record<Exclude<ZdBacktestRecommendationTier, "works">, string> = {
  delay_sensitive: "Żadne ustawienie nie przechodzi testu opóźnionych dostaw — to ma braki i zapas nie gorsze niż dziś.",
  more_stock: "Żadne ustawienie nie ma braków jak dziś bez większego zapasu — to najtańsze z mniejszymi brakami.",
  lowest_cost: "Żadne ustawienie nie ma braków nie większych niż dziś — to najtańsze w roku.",
};

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
  const current = Math.max(0, PHASES.findIndex((p) => p.key === progress?.phase));
  return (
    <ol className="grid w-full grid-cols-4" aria-label="Etapy backtestu">
      {PHASES.map((p, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        const value =
          state === "done"
            ? "gotowe"
            : state === "pending"
              ? "czeka"
              : progress?.total && p.key !== "simulate"
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
  /** Koszt roku: utracona marża + utrzymanie zapasu (v2). */
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
      <p className="text-[11px] font-medium text-slate-500 sm:hidden">{label}</p>
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
        <span className="text-right" title="Utracona marża na brakach + 20% średniego zapasu rocznie">Koszt roku</span>
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
                  <span className="hidden text-slate-400 sm:inline">—</span>
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
                  <span className="hidden text-slate-400 sm:inline">—</span>
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

function GridMatrix({ result, onPick }: { result: ZdBacktestResult; onPick: (p: ZdBacktestGridPoint) => void }) {
  const cycles = [...new Set(result.grid.map((g) => g.cycleDays))];
  const targets = [...new Set(result.grid.map((g) => g.targetDays))];
  const at = (c: number, t: number) => result.grid.find((g) => g.cycleDays === c && g.targetDays === t);
  const rec = result.recommended;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[560px] border-collapse text-sm tabular-nums">
        <caption className="sr-only">Siatka ustawień: braki i średni zapas dla każdego cyklu i celu w dniach</caption>
        <thead>
          <tr className="bg-slate-50 text-left text-[0.8125rem] font-medium text-slate-500">
            <th className="px-3 py-2 font-medium">ZD co</th>
            {targets.map((t) => (
              <th key={t} className="px-2 py-2 text-right font-medium">
                cel {t} d
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cycles.map((c) => (
            <tr key={c} className="border-t border-slate-100">
              <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-700">
                {c === 1 ? "codziennie" : `${c} dni`}
              </th>
              {targets.map((t) => {
                const g = at(c, t);
                if (!g) return <td key={t} />;
                const isRec = rec?.cycleDays === c && rec.targetDays === t;
                const isParams = result.params.cycleDays === c && result.params.targetDays === t;
                return (
                  <td key={t} className="p-1">
                    <button
                      type="button"
                      onClick={() => onPick(g)}
                      aria-label={`Co ${c} dni, cel ${t} dni: braki ${pct(g.zeroShare)}, zapas ${zl(g.avgStock)}${g.cost != null ? `, koszt roku ${zl(g.cost)}` : ""}${g.works ? ", działa" : ""}`}
                      title={g.cost != null ? `Koszt roku ${zl(g.cost)}${g.stableQuarters != null ? ` · trzyma w ${g.stableQuarters}/4 kwartałów` : ""}` : undefined}
                      className={cn(
                        "flex w-full cursor-pointer flex-col items-end rounded-md px-2 py-1.5 text-right transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600",
                        g.works ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-100" : "text-slate-600 hover:bg-slate-50",
                        isRec && "ring-2 ring-inset ring-indigo-600",
                        isParams && !isRec && "ring-1 ring-inset ring-slate-300"
                      )}
                    >
                      <span className="font-semibold">{pct(g.zeroShare)}</span>
                      <span className="text-xs opacity-80">{zl(g.avgStock)}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ZdBacktestPanel({
  supplierId,
  supplierName,
  policy,
  canManage,
  onClose,
  onChanged,
  tier,
}: {
  supplierId: string;
  supplierName: string;
  policy: ZdSupplierOrderPolicyRow;
  canManage: boolean;
  onClose: () => void;
  /** Po włączeniu automatu albo zakończeniu backtestu — lista odświeża się w tle. */
  onChanged: () => void;
  /** `top` — nad panelem karty dostawcy (z-[60]). */
  tier?: ModalTier;
}) {
  const inAutomat = policy.strategy !== "classic";
  const [targetDays, setTargetDays] = useState(String(policy.targetDays ?? 25));
  const [cycleDays, setCycleDays] = useState(String(policy.cycleDays ?? 7));
  const [run, setRun] = useState<ZdBacktestRun | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const wasRunning = useRef(false);

  const load = useCallback(async () => {
    const r = await actionGetZdBacktestRun({ supplierId });
    if (!r.ok) return setError(r.message);
    setRun(r.run);
    const running = r.run?.status === "queued" || r.run?.status === "running";
    if (wasRunning.current && !running) onChanged();
    wasRunning.current = running;
  }, [supplierId, onChanged]);

  useEffect(() => {
    let cancelled = false;
    void actionGetZdBacktestRun({ supplierId }).then((r) => {
      if (cancelled) return;
      if (!r.ok) return setError(r.message);
      setRun(r.run);
      // Pola pokazują ustawienia widocznego wyniku — inaczej „Policz ponownie” liczyłoby coś innego niż na ekranie.
      if (r.run) {
        setTargetDays(String(r.run.params.targetDays));
        setCycleDays(String(r.run.params.cycleDays));
      }
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

  const start = async (params?: { targetDays: number; cycleDays: number }) => {
    const t = params?.targetDays ?? Number(targetDays);
    const c = params?.cycleDays ?? Number(cycleDays);
    if (params) {
      setTargetDays(String(t));
      setCycleDays(String(c));
    }
    setError(null);
    setSaved(null);
    setStarting(true);
    const r = await actionStartZdBacktest({ supplierId, targetDays: t, cycleDays: c });
    setStarting(false);
    if (!r.ok) return setError(r.message);
    wasRunning.current = true;
    await load();
  };

  const enable = async (t: number, c: number) => {
    setError(null);
    setSaving(true);
    const r = await actionSaveZdSupplierOrderPolicy({
      supplierId,
      strategy: "max30_90",
      targetDays: t,
      cycleDays: c,
      autoLevel: Math.max(1, policy.autoLevel) as ZdSupplierOrderPolicyRow["autoLevel"],
      cutoffTime: policy.cutoffTime,
    });
    setSaving(false);
    if (!r.ok) return setError(r.message);
    setSaved(r.warning ?? `Automat włączony: co ${c} dni, cel ${t} dni. Pierwsza propozycja powstanie w nocnym przebiegu.`);
    onChanged();
  };

  const result = run?.status === "done" ? run.result : null;
  const rec = result?.recommended ?? null;
  const pick = rec && rec.works ? rec : null;
  const sameAsPolicy = (t: number, c: number) => inAutomat && policy.targetDays === t && policy.cycleDays === c;
  const automat = result?.variants.find((v) => v.key === "automat");
  const kreator = result?.variants.find((v) => v.key === "kreator");
  const pessimistic = result?.variants.find((v) => v.key === "pessimistic");
  const progress = run?.progress;
  const compareRows: CompareRow[] = result
    ? [
        {
          key: "reality",
          label: "Naprawdę",
          settings: "tygodniowe remanenty",
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

  // Pola zmienione względem wyniku na ekranie — najpierw policz, nie włączaj starych ustawień.
  const fieldsChanged = !!result && (Number(targetDays) !== result.params.targetDays || Number(cycleDays) !== result.params.cycleDays);
  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
      <Button variant="secondary" onClick={onClose}>
        Zamknij
      </Button>
      {canManage && fieldsChanged && !running ? (
        <Button onClick={() => void start()} disabled={starting}>
          {starting ? <Spinner /> : null}
          Policz: co {cycleDays} dni, cel {targetDays} dni
        </Button>
      ) : canManage && result && result.verdict.kind === "works" && !sameAsPolicy(result.params.targetDays, result.params.cycleDays) ? (
        <Button onClick={() => void enable(result.params.targetDays, result.params.cycleDays)} disabled={saving}>
          {saving ? <Spinner /> : null}
          Włącz automat: co {result.params.cycleDays} dni, cel {result.params.targetDays} dni
        </Button>
      ) : canManage && pick && !pick.sameAsParams && !sameAsPolicy(pick.targetDays, pick.cycleDays) ? (
        <Button onClick={() => void enable(pick.targetDays, pick.cycleDays)} disabled={saving}>
          {saving ? <Spinner /> : null}
          Włącz z rekomendacją: co {pick.cycleDays} dni, cel {pick.targetDays} dni
        </Button>
      ) : canManage && !running ? (
        <Button onClick={() => void start()} disabled={starting}>
          {starting ? <Spinner /> : null}
          {result ? "Policz ponownie" : "Uruchom backtest"}
        </Button>
      ) : null}
    </div>
  );

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Backtest — ${supplierName}`}
      tier={tier}
      description="Rok prawdziwej sprzedaży i stanów z Subiekta, liczony tym samym silnikiem co automat. Nic nie zapisuje się w Subiekcie."
      size="xl"
      bodyClassName="space-y-5 px-5 py-5 sm:px-6"
      footer={footer}
    >
      <section className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3.5" aria-label="Ustawienia backtestu">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(2,minmax(0,11rem))_minmax(0,1fr)] sm:items-end">
          <Field label="ZD co ile dni">
            <Select value={cycleDays} onChange={(e) => setCycleDays(e.target.value)} disabled={running}>
              {[...new Set([...CYCLE_OPTIONS, Number(cycleDays)])].sort((a, b) => a - b).map((c) => (
                <option key={c} value={String(c)}>
                  {cycleLabel(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cel w dniach">
            <Input inputMode="numeric" value={targetDays} onChange={(e) => setTargetDays(e.target.value)} disabled={running} />
          </Field>
          <p className="col-span-2 flex items-center gap-2 text-sm text-slate-600 sm:col-span-1 sm:h-10 sm:justify-end">
            <span className={cn("size-1.5 shrink-0 rounded-full", inAutomat ? "bg-emerald-600" : "bg-slate-300")} aria-hidden />
            {inAutomat
              ? `Teraz w automacie: co ${policy.cycleDays ?? "?"} dni, cel ${policy.targetDays ?? "?"} dni, stopień ${policy.autoLevel}`
              : "Teraz poza automatem — zamawiasz z Kreatora"}
          </p>
        </div>
        <p className="mt-2 text-xs text-slate-500">Cel to minimum — przy długiej dostawie silnik podnosi go sam (cykl + dostawa + zapas na opóźnienie).</p>
      </section>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
          {error}
        </p>
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
              {(PHASES.find((p) => p.key === progress?.phase) ?? PHASES[0]).text}
              {progress?.total && progress.phase !== "simulate" ? ` — ${nf0.format(progress.done ?? 0)} z ${nf0.format(progress.total)}` : "…"}
            </p>
            <p className="mx-auto max-w-md text-sm text-slate-600">
              Zwykle od pół minuty do kilku minut (duże zakresy). Możesz zamknąć okno — wynik się zapisze i pokaże na liście.
            </p>
          </div>
          <div className="w-full max-w-2xl text-left">
            <PhaseStepper progress={progress} />
          </div>
        </div>
      ) : run?.status === "error" ? (
        <p className="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
          Backtest z {formatWarsawDateTime(run.createdAt)} się nie udał: {run.error ?? "nieznany błąd"}. Uruchom ponownie.
        </p>
      ) : !result ? (
        <div className="rounded-lg bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Ten dostawca nie ma jeszcze backtestu. Wybierz cykl i cel, a potem <span className="font-medium text-slate-900">Uruchom backtest</span>. Wynik
          porówna automat z tym, jak było naprawdę, i z dzisiejszym Kreatorem, a siatka pokaże, które ustawienia działają.
        </div>
      ) : (
        <>
          <section className={cn("rounded-lg px-4 py-4 sm:px-5", VERDICT_SURFACE[result.verdict.kind])} aria-labelledby="bt-verdict">
            <p id="bt-verdict" className="flex items-start gap-2.5 text-lg font-semibold leading-snug text-balance">
              <span className={cn("mt-2 size-2.5 shrink-0 rounded-full", VERDICT_DOT[result.verdict.kind])} aria-hidden />
              {result.verdict.headline}
            </p>
            <div className="mt-1 space-y-1 pl-5 text-sm leading-relaxed">
              {result.verdict.reasons.map((r) => (
                <p key={r}>{r}</p>
              ))}
              <p className="opacity-80">
                Co {result.params.cycleDays} dni, cel {result.params.targetDays} dni · okres {dm(result.period.from)}–{dm(result.period.to)} · policzone{" "}
                {formatWarsawDateTime(run!.finishedAt ?? run!.createdAt)}
              </p>
            </div>
          </section>

          {rec && !rec.sameAsParams ? (
            <section className="flex flex-col gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between" aria-label="Rekomendacja">
              <div className="text-sm text-indigo-900">
                <p className="font-semibold">
                  {REC_TITLE[rec.tier ?? (rec.works ? "works" : "lowest_cost")]}: co {rec.cycleDays} dni, cel {rec.targetDays} dni
                </p>
                <p className="text-indigo-800">
                  Braki {pct(rec.zeroShare)} (naprawdę {pct(result.reality.zeroShare)}), zapas {zl(rec.avgStock)} (naprawdę {zl(result.reality.avgStock)}),{" "}
                  {nf0.format(rec.orders)} ZD w roku.
                  {rec.cost != null ? ` Koszt roku ${zl(rec.cost)}${kreator?.metrics.cost != null ? ` (Kreator dziś ${zl(kreator.metrics.cost)})` : ""}.` : ""}
                  {rec.stableQuarters != null ? ` Trzyma w ${rec.stableQuarters} z 4 kwartałów.` : ""}
                  {rec.tier && rec.tier !== "works" ? ` ${REC_NOTE[rec.tier]}` : ""}
                </p>
              </div>
              {canManage ? (
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => void start({ targetDays: rec.targetDays, cycleDays: rec.cycleDays })} disabled={starting}>
                  Pokaż szczegóły tego ustawienia
                </Button>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="bt-compare" className="space-y-2">
            <h3 id="bt-compare" className="text-sm font-semibold text-slate-900">
              Porównanie
            </h3>
            <CompareBars rows={compareRows} reality={compareRows[0]} />
          </section>

          <section aria-labelledby="bt-grid" className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="bt-grid" className="text-sm font-semibold text-slate-900">
                Siatka ustawień
              </h3>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" aria-hidden /> działa
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm ring-2 ring-indigo-600" aria-hidden /> rekomendacja
                </span>
                <span>braki · średni zapas; kliknij, żeby policzyć szczegóły</span>
              </p>
            </div>
            <GridMatrix result={result} onPick={(g) => (canManage ? void start({ targetDays: g.targetDays, cycleDays: g.cycleDays }) : undefined)} />
          </section>

          <section aria-labelledby="bt-quality" className="space-y-2">
            <h3 id="bt-quality" className="text-sm font-semibold text-slate-900">
              Dane
            </h3>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 rounded-lg border border-slate-200 px-4 py-3 sm:grid-cols-2">
              <KeyValue label="Towary aktywne" value={`${nf0.format(result.quality.activeSkus)} z ${nf0.format(result.quality.skus)}`} />
              <KeyValue label="Zmierzone dostawy" value={nf0.format(result.quality.leadSamples)} />
              <KeyValue label="Pominięte wykluczone" value={nf0.format(result.quality.excluded)} />
              <KeyValue label="Pominięte na prośbę" value={nf0.format(result.quality.onRequest)} />
              <KeyValue
                label="Cena dla aktywnych"
                value={pct(result.quality.pricedActiveShare)}
                tone={result.quality.pricedActiveShare < 90 ? "warning" : undefined}
              />
              {result.quality.hiddenOutflowShare != null ? (
                <KeyValue
                  label="Rozchód bez sprzedaży"
                  value={pct(result.quality.hiddenOutflowShare)}
                  tone={result.quality.hiddenOutflowShare >= 10 ? "warning" : undefined}
                />
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
              {result.model?.dailyStock ? <KeyValue label="Stany" value="dzienne (remanent na każdy dzień)" /> : null}
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
              Werdykt „działa”: braki nie większe niż naprawdę, zapas najwyżej o 10% większy, a przy opóźnionych dostawach braki najwyżej o 1 pp większe.
              {result.version === 2
                ? " Każda decyzja liczona jak nocny przebieg: okno dni zapasu dostawcy, korekta dni braku, prośby poza zapasem, rezerwacje z ZK (klient czeka na dostawę, nie przepada), podążanie za sprzedażą, minimum stanów, opakowania, minimum zamówienia i darmowa dostawa (odłożenie, dopełnienie), czas dostawy znany w dniu decyzji, stany dzienne. Nowy towar dostaje pierwszą dostawę jak naprawdę. Koszt roku = utracona marża na sprzedaży z półki + 20% średniego zapasu + koszt każdego ZD; rekomendacja to najniższy koszt wśród ustawień (od codziennie do co 3 tygodnie), które działają — najlepiej we wszystkich kwartałach. Częściej albo rzadziej z większym zapasem — wygrywa to, co taniej wychodzi w roku."
                : " Wynik policzony starszą wersją backtestu — policz ponownie, żeby zobaczyć koszt i ustawienia liczone jak nocny przebieg."}
            </p>
          </section>
        </>
      )}
    </ModalShell>
  );
}

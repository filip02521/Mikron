"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import {
  actionClearZdSkuClassOverride,
  actionSetZdSkuClassOverride,
  actionStartZdAutomatRecompute,
} from "@/app/actions/zd-automat";
import type { ZdAutomatKpiSupplier } from "@/lib/data/zd-kpi-weekly";
import type { ZdSkuClassSummary } from "@/lib/data/zd-sku-class-sync";
import type { ZdAutomatSupplierRow } from "@/lib/data/zd-automat-suppliers";
import { zdInAutomat } from "@/components/zakupy/ZdAutomatCardSection";
import {
  ZdAutomatSuppliers,
  zdAutomatRowOf,
  type ZdAutomatSupplierFilter,
  type ZdAutomatSupplierView,
} from "@/components/zakupy/ZdAutomatSuppliers";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { cn } from "@/lib/cn";
import {
  buildZdAutomatCheckStatus,
  buildZdAutomatStatus,
  zdAutomatCheckReasons,
  zdAutomatOosAlert,
  type ZdAutomatCheckInput,
} from "@/lib/orders/zd-automat-status";

const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const zl = (v: number) => `${nf0.format(v)}\u00a0zł`;
/** „1 towar”, „3 towary”, „5 towarów” — liczba w formacie pl-PL. */
const towary = (n: number) => `${nf0.format(n)} ${polishPluralWord(n, "towar", "towary", "towarów")}`;
const dayMonth = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}`;

const ABC = ["A", "B", "C"] as const;
const XYZ = ["X", "Y", "Z", "N"] as const;
const XYZ_HINT: Record<(typeof XYZ)[number], string> = {
  X: "równa (CV < 0,5)",
  Y: "zmienna (0,5–1,0)",
  Z: "nieregularna",
  N: "nowość < 13 tyg.",
};

function ClassMatrix({ classes }: { classes: ZdSkuClassSummary }) {
  const total = Object.values(classes.counts).reduce((a, b) => a + b, 0);
  const profitTotal = ABC.reduce((a, k) => a + classes.profitByAbc[k], 0);
  return (
    <TableScroll>
      <DataTable className="kpi-table min-w-[640px]">
        <thead>
          <tr>
            <th>Klasa</th>
            {XYZ.map((x) => (
              <th key={x} className="text-right">
                {x} <span className="block text-xs font-normal">{XYZ_HINT[x]}</span>
              </th>
            ))}
            <th className="text-right">Razem</th>
            <th className="text-right">Zysk 12 mies.</th>
          </tr>
        </thead>
        <tbody>
          {ABC.map((a) => {
            const row = XYZ.reduce((s, x) => s + (classes.counts[`${a}${x}`] ?? 0), 0);
            const share = profitTotal > 0 ? (classes.profitByAbc[a] / profitTotal) * 100 : null;
            return (
              <tr key={a}>
                <td className="font-semibold text-slate-900">{a}</td>
                {XYZ.map((x) => (
                  <td key={x} className="text-right">
                    {classes.counts[`${a}${x}`] ? nf0.format(classes.counts[`${a}${x}`]!) : <span className="text-slate-400">—</span>}
                  </td>
                ))}
                <td className="text-right font-semibold text-slate-900">{nf0.format(row)}</td>
                <td className="text-right">
                  {zl(classes.profitByAbc[a])}
                  {share != null ? <span className="block text-xs text-slate-500">{nf1.format(share)}%</span> : null}
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="font-semibold text-slate-900">Razem</td>
            {XYZ.map((x) => (
              <td key={x} className="text-right">
                {nf0.format(ABC.reduce((s, a) => s + (classes.counts[`${a}${x}`] ?? 0), 0))}
              </td>
            ))}
            <td className="text-right font-semibold text-slate-900">{nf0.format(total)}</td>
            <td className="text-right">{zl(profitTotal)}</td>
          </tr>
        </tbody>
      </DataTable>
    </TableScroll>
  );
}

function OverrideForm({ onDone }: { onDone: (message: string) => void }) {
  const [product, setProduct] = useState("");
  const [abc, setAbc] = useState("");
  const [xyz, setXyz] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 px-6 pb-6 sm:grid-cols-[minmax(0,1.2fr)_auto_auto] sm:px-7"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await actionSetZdSkuClassOverride({ product, abc, xyz, note });
          if (!res.ok) return setError(res.message);
          setProduct("");
          setAbc("");
          setXyz("");
          setNote("");
          onDone(res.message ?? "Zapisano nadpisanie.");
        });
      }}
    >
      <Field label="Towar" hint="Symbol z Subiekta albo tw_Id">
        <Input value={product} onChange={(e) => setProduct(e.target.value)} autoComplete="off" required />
      </Field>
      <Field label="ABC">
        <Select value={abc} onChange={(e) => setAbc(e.target.value)} className="sm:min-w-[6rem]">
          <option value="">bez zmiany</option>
          {ABC.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
      </Field>
      <Field label="XYZ">
        <Select value={xyz} onChange={(e) => setXyz(e.target.value)} className="sm:min-w-[6rem]">
          <option value="">bez zmiany</option>
          {XYZ.map((x) => (
            <option key={x} value={x}>{x} — {XYZ_HINT[x]}</option>
          ))}
        </Select>
      </Field>
      <Field label="Powód" className="sm:col-span-2" error={error ?? undefined}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} required />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending} className="min-h-11 w-full sm:min-h-10">
          {pending ? <Spinner /> : null}
          Zapisz nadpisanie
        </Button>
      </div>
    </form>
  );
}

type View = "suppliers" | "classes";

/** Wejście reguł „do sprawdzenia” z wiersza pulpitu (ten sam zestaw dla wiersza i zdania stanu). */
function checkInput(v: ZdAutomatSupplierRow & { weeks: ZdAutomatSupplierView["weeks"] }): ZdAutomatCheckInput {
  return {
    name: v.name,
    inAutomat: zdInAutomat(v),
    active: v.isActive,
    hasScope: v.hasScope,
    policy: { cycleDays: v.policy.cycleDays, targetDays: v.policy.targetDays },
    backtest: v.backtest,
    oosAlert: zdAutomatOosAlert(zdAutomatRowOf(v)),
  };
}

/** Dostawcy z zakresem w Kreatorze + ich KPI tygodnia i powody „do sprawdzenia” — jeden wiersz na dostawcę. */
function buildSupplierViews(suppliers: ZdAutomatSupplierRow[], kpi: ZdAutomatKpiSupplier[], nowMs: number): ZdAutomatSupplierView[] {
  const weeksById = new Map(kpi.map((k) => [k.supplierId, k.weeks]));
  const views = suppliers.map((s) => {
    const view = { ...s, weeks: weeksById.get(s.id) ?? [], checkReasons: [] as string[] };
    view.checkReasons = zdAutomatCheckReasons(checkInput(view), nowMs);
    return view;
  });
  const stock = (v: ZdAutomatSupplierView) => v.weeks[0]?.rotation.stockValue ?? -1;
  // Do sprawdzenia na górze, potem automat, potem wartość zapasu.
  return views.sort(
    (a, b) =>
      Number(b.checkReasons.length > 0) - Number(a.checkReasons.length > 0) ||
      Number(zdInAutomat(b)) - Number(zdInAutomat(a)) ||
      stock(b) - stock(a) ||
      a.name.localeCompare(b.name, "pl")
  );
}

function StatusPanel({
  tone,
  headline,
  detail,
  action,
}: {
  tone: "success" | "warning" | "neutral";
  headline: string;
  detail: string;
  action?: React.ReactNode;
}) {
  const dot = tone === "warning" ? "bg-amber-500" : tone === "success" ? "bg-emerald-600" : "bg-slate-400";
  return (
    <Card padding={false}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5" role="status">
        <div className="min-w-0">
          <p className="flex items-start gap-2.5 text-lg font-semibold leading-snug tracking-[-0.015em] text-balance text-slate-900">
            <span className={cn("mt-2 size-2.5 shrink-0 rounded-full", dot)} aria-hidden />
            {headline}
          </p>
          <p className="mt-1 max-w-3xl pl-5 text-sm leading-relaxed text-slate-600">{detail}</p>
        </div>
        {action ? <div className="shrink-0 sm:pl-0">{action}</div> : null}
      </div>
    </Card>
  );
}

export function ZdAutomatPanel({
  kpi,
  classes,
  suppliers,
  canRecompute,
  cardsHref,
}: {
  kpi: { suppliers: ZdAutomatKpiSupplier[]; computedAt: string | null; running: boolean };
  classes: ZdSkuClassSummary;
  suppliers: ZdAutomatSupplierRow[];
  canRecompute: boolean;
  /** Karty dostawców tej roli — przejście z wiersza do karty (`?karta=<id>`). */
  cardsHref: string;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const running = started || kpi.running || classes.running;

  // Wiek backtestu liczony od chwili otwarcia strony (stały między renderami).
  const [nowMs] = useState(() => Date.now());
  const views = buildSupplierViews(suppliers, kpi.suppliers, nowMs);
  const automatCount = views.filter(zdInAutomat).length;
  const [view, setView] = useState<View>("suppliers");
  const [filter, setFilter] = useState<ZdAutomatSupplierFilter>(automatCount ? "automat" : "pl");
  const [q, setQ] = useState("");

  const latest = kpi.suppliers.find((r) => r.weeks[0])?.weeks[0];
  const totalSkus = Object.values(classes.counts).reduce((a, b) => a + b, 0);
  const check = buildZdAutomatCheckStatus(
    views.map(checkInput),
    nowMs
  );
  const status = check ?? buildZdAutomatStatus(views.map(zdAutomatRowOf), Boolean(latest));
  const kpiWeekLabel = latest
    ? `KPI za tydzień ${dayMonth(latest.weekStart)}–${dayMonth(latest.weekEnd)}${kpi.computedAt ? ` · policzone ${formatWarsawDateTime(kpi.computedAt)}` : ""}`
    : "KPI jeszcze nie policzone (cron w poniedziałek 7:00)";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Automat ZD"
        description="Jak automat zamawia u polskich dostawców: rytm i backtest każdego dostawcy, braki klasy A i to, ile poprawiasz w propozycjach. Ustawienia dostawcy zmieniasz tutaj albo w jego karcie."
        actions={
          canRecompute ? (
            <Button
              variant="secondary"
              disabled={pending || running}
              onClick={() =>
                start(async () => {
                  const res = await actionStartZdAutomatRecompute();
                  if (res.ok) setStarted(true);
                  else setNotice({ tone: "error", text: res.message });
                })
              }
            >
              {pending ? <Spinner /> : null}
              Przelicz klasy i KPI
            </Button>
          ) : null
        }
      />

      {running ? (
        <div role="status" className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <BrandLoader size="sm" />
          <span>
            Przeliczam klasy {towary(totalSkus || 5000)} i KPI dostawców — zwykle 3–5 minut. Odśwież stronę po
            zakończeniu.
          </span>
          <Button variant="ghost" size="sm" className="ml-auto shrink-0" onClick={() => router.refresh()}>
            Odśwież
          </Button>
        </div>
      ) : null}

      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <StatusPanel
        tone={status.tone}
        headline={status.headline}
        detail={status.detail}
        action={
          check && !(view === "suppliers" && filter === "check" && !q) ? (
            <Button
              className="min-h-11 w-full sm:min-h-10 sm:w-auto"
              onClick={() => {
                setView("suppliers");
                setFilter("check");
                setQ("");
              }}
            >
              Pokaż {check.count} do sprawdzenia
            </Button>
          ) : null
        }
      />

      <SegmentedControl
        value={view}
        onChange={setView}
        ariaLabel="Widok automatu"
        options={[
          { value: "suppliers", label: "Dostawcy" },
          { value: "classes", label: "Klasy towarów" },
        ]}
      />

      {view === "suppliers" ? (
        <ZdAutomatSuppliers
          rows={views}
          canManage
          cardsHref={cardsHref}
          kpiWeekLabel={kpiWeekLabel}
          filter={filter}
          onFilterChange={setFilter}
          q={q}
          onQChange={setQ}
          nowMs={nowMs}
        />
      ) : (
        <>
          <Card padding={false}>
            <CardHeader
              inset
              title="Rozkład klas"
              description={
                classes.computedAt
                  ? `${towary(totalSkus)} · ABC wg zysku 12 mies. w obrębie dostawcy, XYZ ze sprzedaży 52 tygodni · policzone ${formatWarsawDateTime(classes.computedAt)}. Klasy służą do pomiaru i kolejności przeglądu — nie zmieniają ilości.`
                  : "Klasy jeszcze nie policzone (cron 1. dnia miesiąca w nocy)."
              }
            />
            {totalSkus ? <ClassMatrix classes={classes} /> : null}
          </Card>

          <Card padding={false}>
            <CardHeader
              inset
              title="Nadpisania klas"
              description={
                classes.overrides.length
                  ? `${towary(classes.overrides.length)} z ręczną klasą — przeliczenie ${classes.overrides.length === 1 ? "jej" : "ich"} nie zmienia.`
                  : "Ręczna klasa z powodem, np. towar strategiczny mimo niskiego zysku. Przeliczenie jej nie zmienia."
              }
            />
            <OverrideForm
              onDone={(text) => {
                setNotice({ tone: "success", text });
                router.refresh();
              }}
            />
            {classes.overrides.length ? (
              <TableScroll>
                <DataTable className="min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Towar</th>
                      <th>Dostawca</th>
                      <th>Klasa</th>
                      <th>Powód</th>
                      <th>
                        <span className="sr-only">Akcja</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.overrides.map((o) => (
                      <tr key={o.twId}>
                        <td>
                          <span className="font-mono text-xs text-slate-700">{o.symbol ?? o.twId}</span>
                          <span className="block text-slate-900">{o.name}</span>
                        </td>
                        <td>{o.supplierName ?? "wspólny zakres"}</td>
                        <td className="whitespace-nowrap">
                          <span className="font-semibold text-slate-900">
                            {o.overrideAbc ?? o.abc}
                            {o.overrideXyz ?? o.xyz}
                          </span>
                          <span className="block text-xs text-slate-500">
                            policzona {o.abc}
                            {o.xyz}
                          </span>
                        </td>
                        <td>{o.note}</td>
                        <td className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const res = await actionClearZdSkuClassOverride(o.twId);
                              if (!res.ok) setNotice({ tone: "error", text: res.message });
                              router.refresh();
                            }}
                          >
                            Usuń
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableScroll>
            ) : null}
          </Card>
        </>
      )}
    </div>
  );
}

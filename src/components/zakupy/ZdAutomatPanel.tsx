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
import { Spinner } from "@/components/ui/Spinner";
import {
  actionClearZdSkuClassOverride,
  actionSetZdSkuClassOverride,
  actionStartZdAutomatRecompute,
} from "@/app/actions/zd-automat";
import type { ZdAutomatKpiSupplier, ZdKpiWeeklyMetrics } from "@/lib/data/zd-kpi-weekly";
import type { ZdSkuClassSummary } from "@/lib/data/zd-sku-class-sync";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import { polishPluralWord } from "@/lib/email/polish-plural";

const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const zl = (v: number) => `${nf0.format(v)}\u00a0zł`;
const pct = (v: number | null) => (v == null ? null : `${nf1.format(v)}%`);
/** „1 towar”, „3 towary”, „5 towarów” — liczba w formacie pl-PL. */
const count = (n: number, one: string, few: string, many: string) => `${nf0.format(n)} ${polishPluralWord(n, one, few, many)}`;
const towary = (n: number) => count(n, "towar", "towary", "towarów");
const dostawcy = (n: number) => count(n, "dostawca", "dostawcy", "dostawców");
const dayMonth = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}`;

type Kpi = {
  key: string;
  label: string;
  /** Wartość do pokazania; null = brak danych w tym tygodniu. */
  value: (m: ZdKpiWeeklyMetrics) => string | null;
  /** Dopisek pod wartością bieżącego tygodnia. */
  note?: (m: ZdKpiWeeklyMetrics) => string | null;
  empty: string;
};

const KPIS: Kpi[] = [
  {
    key: "oos",
    label: "Braki A",
    value: (m) => pct(m.oosA.pct),
    note: (m) => (m.oosA.skuDays ? `${m.oosA.zeroDays} z ${m.oosA.skuDays} dni-towarów` : null),
    empty: "brak historii stanów",
  },
  {
    key: "rotation",
    label: "Rotacja",
    value: (m) => (m.rotation.days == null ? null : `${nf0.format(m.rotation.days)} dni`),
    note: (m) => `zapas ${zl(m.rotation.stockValue)}`,
    empty: "bez sprzedaży",
  },
  {
    key: "dead",
    label: "Martwy zapas",
    value: (m) => zl(m.deadStock.value),
    note: (m) => (m.deadStock.skus ? towary(m.deadStock.skus) : null),
    empty: "—",
  },
  {
    key: "correction",
    label: "Korekta człowieka",
    value: (m) => pct(m.humanCorrection.pct),
    note: (m) => (m.humanCorrection.proposals ? `${nf0.format(m.humanCorrection.proposals)} ZD z propozycji` : null),
    empty: "brak ZD z propozycji",
  },
  {
    key: "deferred",
    label: "Odłożone",
    value: (m) => pct(m.minima.deferredPct),
    note: (m) => (m.minima.proposals ? `${m.minima.deferred} z ${count(m.minima.proposals, "propozycji", "propozycji", "propozycji")}` : null),
    empty: "brak propozycji",
  },
  {
    key: "minimum",
    label: "ZD ≥ minimum",
    value: (m) => pct(m.minima.aboveMinPct),
    note: (m) => (m.minima.accepted ? `${m.minima.acceptedAboveMin} z ${m.minima.accepted} ZD` : null),
    empty: "brak minimum lub ZD",
  },
];

function KpiCell({ kpi, weeks }: { kpi: Kpi; weeks: ZdKpiWeeklyMetrics[] }) {
  const [now, ...prev] = weeks;
  if (!now) return <td className="text-slate-400">—</td>;
  const value = kpi.value(now);
  const note = kpi.note?.(now);
  const trendValues = prev.map((m) => kpi.value(m)).reverse();
  const trend = trendValues.some((v) => v != null) ? trendValues.map((v) => v ?? "—") : [];
  return (
    <td className="align-top">
      {value == null ? (
        <span className="text-slate-400" title={kpi.empty}>
          —<span className="sr-only"> {kpi.empty}</span>
        </span>
      ) : (
        <span className="whitespace-nowrap font-semibold text-slate-900">{value}</span>
      )}
      {note ? <span className="block text-xs text-slate-500">{note}</span> : null}
      {trend.length ? (
        <span className="block text-xs text-slate-500" title="Poprzednie tygodnie, od najstarszego">
          wcześniej: {trend.join(" · ")}
        </span>
      ) : null}
    </td>
  );
}

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
      <DataTable className="min-w-[640px]">
        <thead>
          <tr>
            <th>Klasa</th>
            {XYZ.map((x) => (
              <th key={x} className="text-right">
                {x} <span className="font-normal">{XYZ_HINT[x]}</span>
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

export function ZdAutomatPanel({
  kpi,
  classes,
  canRecompute,
}: {
  kpi: { suppliers: ZdAutomatKpiSupplier[]; computedAt: string | null; running: boolean };
  classes: ZdSkuClassSummary;
  canRecompute: boolean;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const running = started || kpi.running || classes.running;

  const rows = [...kpi.suppliers].sort(
    (a, b) => (b.weeks[0]?.rotation.stockValue ?? -1) - (a.weeks[0]?.rotation.stockValue ?? -1)
  );
  const latest = rows.find((r) => r.weeks[0])?.weeks[0];
  const totalSkus = Object.values(classes.counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Automat ZD"
        description="KPI tygodniowe dostawców w automacie propozycji i klasy towarów ze zmapowanych zakresów. Klasy nie zmieniają ilości w propozycjach — służą do pomiaru i kolejności przeglądu."
        actions={
          canRecompute ? (
            <Button
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

      <Card padding={false}>
        <CardHeader
          inset
          title="KPI tygodniowe"
          description={
            latest
              ? `${dostawcy(rows.length)} · tydzień ${dayMonth(latest.weekStart)}–${dayMonth(latest.weekEnd)}${
                  kpi.computedAt ? ` · policzone ${formatWarsawDateTime(kpi.computedAt)}` : ""
                }`
              : `${dostawcy(rows.length)} w automacie · KPI jeszcze nie policzone (cron w poniedziałek 7:00)`
          }
        />
        {rows.length ? (
          <TableScroll>
            <DataTable className="min-w-[960px]">
              <thead>
                <tr>
                  <th>Dostawca</th>
                  <th className="text-right">Towary (A)</th>
                  {KPIS.map((k) => (
                    <th key={k.key}>{k.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.supplierId}>
                    <td className="min-w-[11rem] align-top font-medium text-slate-900">{r.name}</td>
                    <td className="align-top text-right">
                      {r.weeks[0] ? `${nf0.format(r.weeks[0].skus)} (${nf0.format(r.weeks[0].skusA)})` : "—"}
                    </td>
                    {KPIS.map((k) => (
                      <KpiCell key={k.key} kpi={k} weeks={r.weeks} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableScroll>
        ) : (
          <p className="px-6 pb-6 text-sm text-slate-600 sm:px-7">
            Brak dostawców w automacie: ustaw strategię propozycji albo kraj Polska w karcie dostawcy.
          </p>
        )}
        <p className="px-6 pb-6 text-xs leading-relaxed text-slate-500 sm:px-7">
          „—” = brak danych w tym tygodniu (najedź, żeby zobaczyć powód). Braki A — % dni-towarów klasy A z dostępnym ≤ 0
          (historia stanów z nocnego przebiegu „Braki i zamówienia”). Rotacja — wartość zapasu (stan ×
          cena kartotekowa, bez niej cena z ostatniego ZD) / dzienny koszt sprzedaży z 90 dni. Martwy zapas — wartość
          towarów na stanie bez sprzedaży 180 dni. Korekta człowieka — % wartości propozycji zmienionej przy tworzeniu ZD. Odłożone i ZD ≥ minimum — z propozycji
          automatu w tym tygodniu.
          Zapas i martwy zapas to zdjęcie z dnia przeliczenia.
        </p>
      </Card>

      <Card padding={false}>
        <CardHeader
          inset
          title="Rozkład klas"
          description={
            classes.computedAt
              ? `${towary(totalSkus)} · ABC wg zysku 12 mies. w obrębie dostawcy, XYZ ze sprzedaży 52 tygodni · policzone ${formatWarsawDateTime(classes.computedAt)}`
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
                  <th />
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
    </div>
  );
}

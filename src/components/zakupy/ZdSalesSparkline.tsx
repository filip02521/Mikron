"use client";

import { useState } from "react";
import { HoverCard } from "@/components/ui/HoverCard";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  formatZdSalesProfileHeadline,
  formatZdSalesProfileNotes,
  type ZdSalesProfileLineMeta,
} from "@/lib/orders/zd-sales-profile";
import { cn } from "@/lib/cn";

/** Wysokości słupków 0..h (pusty miesiąc = kreska przy osi, żeby było widać „0”). */
function barHeights(windows: readonly number[], h: number): number[] {
  const max = Math.max(1, ...windows);
  return windows.map((v) => (v > 0 ? Math.max(1.5, (v / max) * h) : 0));
}

function seriesLabel(windows: readonly number[]): string {
  return windows.map((v) => formatQty(v)).join(", ");
}

/** Nasze ZD na osi wykresu: dni temu (okna liczone od dziś, dokładność do okna 30 dni). */
export type ZdSalesChartOrderMark = {
  daysAgo: number;
  qty: number;
  label: string;
};

const MONTHS_PL = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const DAY_MS = 86_400_000;
const CHART_BAR_PX = 56;

/** Wartość nad słupkiem: wąska kolumna, więc tysiące skrótem („2,2k”). */
function compactQty(v: number): string {
  if (v >= 1000) return `${(v / 1000).toLocaleString("pl-PL", { maximumFractionDigits: 1 })}k`;
  return formatQty(Math.round(v));
}

/**
 * Duży wykres (dymek i karta): 12 okien po 30 dni, wartość nad każdym słupkiem, miesiąc pod nim,
 * bieżące okno w akcencie, przerywana = typowy miesiąc, kropki = nasze ZD.
 * HTML zamiast SVG: tekst ma stały rozmiar niezależnie od szerokości wykresu.
 */
function ZdSalesProfileChart({
  profile,
  orders,
}: {
  profile: ZdSalesProfileLineMeta;
  orders?: readonly ZdSalesChartOrderMark[];
}) {
  const [nowMs] = useState(() => Date.now());
  const w = profile.windows;
  const last = w.length - 1;
  const max = Math.max(1, ...w);
  // Okno i kończy się (last − i) × 30 dni temu; podpis = miesiąc środka okna.
  const months = w.map((_, i) => MONTHS_PL[new Date(nowMs - ((last - i) * 30 + 15) * DAY_MS).getMonth()]!);
  // Kilka ZD w jednym oknie = jedna kropka z opisem wszystkich.
  const byWindow = new Map<number, string[]>();
  for (const o of orders ?? []) {
    const i = last - Math.floor(Math.max(0, o.daysAgo) / 30);
    if (i >= 0) byWindow.set(i, [...(byWindow.get(i) ?? []), o.label]);
  }
  const typicalPx = profile.typicalMonthly > 0 ? (Math.min(profile.typicalMonthly, max) / max) * CHART_BAR_PX : null;
  const cols = { gridTemplateColumns: `repeat(${w.length}, minmax(0, 1fr))` };
  return (
    <span
      role="img"
      aria-label={`Sprzedaż w 12 oknach po 30 dni, od najstarszego: ${w.map((v, i) => `${months[i]} ${formatQty(v)}`).join(", ")} szt`}
      className="mt-2 block"
    >
      <span className="relative grid items-end gap-1" style={cols} aria-hidden>
        {typicalPx != null ? (
          <span
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-500"
            style={{ bottom: typicalPx }}
          />
        ) : null}
        {w.map((v, i) => (
          <span key={i} className="flex flex-col items-center justify-end">
            <span
              className={cn(
                // Nad przerywaną linią typowego miesiąca: tło dymka/karty, żeby linia nie przecinała liczby.
                "relative z-[1] mb-0.5 rounded-sm bg-card px-0.5 text-[0.625rem] leading-none tabular-nums",
                i === last ? "font-semibold text-slate-900" : v > 0 ? "text-slate-600" : "text-slate-400"
              )}
            >
              {compactQty(v)}
            </span>
            <span
              className={cn("block w-full rounded-t-sm", i === last ? "bg-indigo-600" : "bg-slate-300")}
              style={{ height: v > 0 ? Math.max(2, (v / max) * CHART_BAR_PX) : 1 }}
            />
          </span>
        ))}
      </span>
      {byWindow.size > 0 ? (
        <span className="grid h-3 items-center gap-1 border-t border-slate-300" style={cols} aria-hidden>
          {w.map((_, i) => {
            const labels = byWindow.get(i);
            return (
              <span key={i} className="flex justify-center" title={labels?.join("\n")}>
                {labels ? <span className="size-1.5 rounded-full bg-indigo-600" /> : null}
              </span>
            );
          })}
        </span>
      ) : null}
      <span
        className={cn("grid gap-1 pt-0.5 text-center text-[0.625rem] leading-none", byWindow.size > 0 ? "" : "border-t border-slate-300")}
        style={cols}
        aria-hidden
      >
        {months.map((m, i) => (
          <span key={i} className={i === last ? "font-semibold text-slate-900" : "text-slate-500"}>
            {i === last ? "teraz" : m}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Treść dymka profilu: zdanie, dopiski i wykres 12 miesięcy (miniwykres i znacznik „skok”). */
export function ZdSalesProfileCardContent({
  profile,
  orders,
}: {
  profile: ZdSalesProfileLineMeta;
  orders?: readonly ZdSalesChartOrderMark[];
}) {
  const notes = formatZdSalesProfileNotes(profile);
  return (
    <>
      <span className="block font-semibold text-slate-900">
        {formatZdSalesProfileHeadline(profile)}
      </span>
      {notes ? (
        <span className="mt-0.5 block text-slate-600">{notes}</span>
      ) : null}
      <ZdSalesProfileChart profile={profile} orders={orders} />
      <span className="mt-1 block text-[0.6875rem] text-slate-500">
        12 okien po 30 dni · przerywana linia = typowy miesiąc
        {profile.typicalMonthly > 0
          ? ` (~${formatQty(profile.typicalMonthly)} szt)`
          : ""}
        {orders && orders.length > 0 ? " · kropka = nasze ZD" : ""}
      </span>
    </>
  );
}

/**
 * Miniwykres 12 × 30 dni w kolumnie „Sprzed.” — skok, rzadka i regularna sprzedaż widać na całej liście.
 * Hover / Tab / dotyk: dymek z większym wykresem i zdaniem profilu.
 */
export function ZdSalesSparkline({
  profile,
  className,
}: {
  profile: ZdSalesProfileLineMeta;
  className?: string;
}) {
  const w = profile.windows;
  if (w.length === 0) return null;
  const H = 12;
  const barW = 3;
  const gap = 1.5;
  const width = w.length * (barW + gap) - gap;
  const heights = barHeights(w, H);
  const last = w.length - 1;
  return (
    <HoverCard
      ariaLabel={`Sprzedaż w 12 miesiącach: ${seriesLabel(w)} szt. Pokaż wykres`}
      width={300}
      estimatedHeight={150}
      triggerClassName={cn(
        "zd-est-sparkline mx-auto mt-1 flex rounded-sm p-0.5 hover:bg-slate-100",
        className,
      )}
      content={<ZdSalesProfileCardContent profile={profile} />}
    >
      <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} aria-hidden>
        {w.map((_, i) => {
          const h = heights[i]!;
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={h > 0 ? H - h : H - 1}
              width={barW}
              height={h > 0 ? h : 1}
              rx={h > 2 ? 1 : 0}
              className={
                i === last && h > 0 ? "fill-indigo-600" : "fill-slate-300"
              }
            />
          );
        })}
      </svg>
    </HoverCard>
  );
}

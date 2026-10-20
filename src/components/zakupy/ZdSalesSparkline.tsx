"use client";

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

/** Duży wykres w dymku: 12 okien, bieżące w akcencie, przerywana = typowy miesiąc, kropki = nasze ZD. */
function ZdSalesProfileChart({
  profile,
  orders,
}: {
  profile: ZdSalesProfileLineMeta;
  orders?: readonly ZdSalesChartOrderMark[];
}) {
  const w = profile.windows;
  const H = 64;
  const barW = 14;
  const gap = 6;
  const left = 4;
  const width = left + w.length * (barW + gap);
  const max = Math.max(1, ...w);
  const heights = barHeights(w, H);
  const typicalY = H - (Math.min(profile.typicalMonthly, max) / max) * H;
  const last = w.length - 1;
  // ponytail: okna Kreatora kończą się w dniu profilu (do kilku dni temu), kropki liczone od dziś.
  const marks = (orders ?? [])
    .map((o) => ({ ...o, i: last - Math.floor(Math.max(0, o.daysAgo) / 30) }))
    .filter((o) => o.i >= 0);
  const axisPad = marks.length > 0 ? 8 : 0;
  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${H + 2 + axisPad}`}
        width="100%"
        role="img"
        aria-label={`Sprzedaż w 12 oknach po 30 dni, od najstarszego: ${seriesLabel(w)} szt`}
        className="mt-2 block"
      >
        <line
          x1={0}
          y1={H}
          x2={width}
          y2={H}
          className="stroke-slate-300"
          strokeWidth={1}
        />
        {w.map((v, i) => {
          const h = heights[i]!;
          const x = left + i * (barW + gap);
          return h > 0 ? (
            <rect
              key={i}
              x={x}
              y={H - h}
              width={barW}
              height={h}
              rx={2}
              className={i === last ? "fill-indigo-600" : "fill-slate-300"}
            />
          ) : (
            <rect
              key={i}
              x={x}
              y={H - 1}
              width={barW}
              height={1}
              className="fill-slate-300"
            />
          );
        })}
        {profile.typicalMonthly > 0 ? (
          <line
            x1={0}
            y1={typicalY}
            x2={width}
            y2={typicalY}
            className="stroke-slate-500"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ) : null}
        {marks.map((m, k) => (
          <circle
            key={k}
            cx={left + m.i * (barW + gap) + barW / 2}
            cy={H + 5}
            r={3}
            className="fill-indigo-600 stroke-white"
            strokeWidth={1}
          >
            <title>{m.label}</title>
          </circle>
        ))}
      </svg>
      {/* Podpisy w HTML: SVG skaluje się do szerokości, tekst w nim rósłby razem z wykresem. */}
      <span className="mt-0.5 flex justify-between text-[11px]">
        <span className="text-slate-500">rok temu</span>
        <span className="tabular-nums text-slate-700">
          teraz {formatQty(w[last] ?? 0)} szt
        </span>
      </span>
    </>
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
      <span className="mt-1 block text-[11px] text-slate-500">
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

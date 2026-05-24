"use client";

import Link from "next/link";
import type { QueueInboxSummary } from "@/lib/orders/queue-inbox";
import { cn } from "@/lib/cn";

function MetricTile({
  value,
  label,
  hint,
  href,
  tone = "default",
}: {
  value: number;
  label: string;
  hint?: string;
  href?: string;
  tone?: "default" | "amber" | "sky" | "emerald";
}) {
  const inner = (
    <>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums tracking-tight",
          tone === "amber" ? "text-amber-900" : tone === "sky" ? "text-sky-900" : "text-slate-900"
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-0.5 text-xs font-medium",
          tone === "amber"
            ? "text-amber-800"
            : tone === "sky"
              ? "text-sky-800"
              : tone === "emerald"
                ? "text-emerald-800"
                : "text-slate-700"
        )}
      >
        {label}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-0.5 text-[11px] leading-snug",
            tone === "amber"
              ? "text-amber-700/90"
              : tone === "sky"
                ? "text-sky-700/90"
                : tone === "emerald"
                  ? "text-emerald-700/90"
                  : "text-slate-500"
          )}
        >
          {hint}
        </p>
      ) : null}
    </>
  );

  const className = cn(
    "rounded-xl border px-3 py-2.5 text-left transition",
    tone === "amber"
      ? "border-amber-200 bg-amber-50/60 hover:border-amber-300"
      : tone === "sky"
        ? "border-sky-200 bg-sky-50/50 hover:border-sky-300"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function QueuePanelToolbar({
  summary,
  informacjaCount,
  pickupReadyCount,
}: {
  summary: QueueInboxSummary;
  informacjaCount: number;
  pickupReadyCount: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-sm font-semibold text-slate-900">Przegląd magazynu</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Zamówienia u dostawcy — towar często jeszcze nie dotarł. Po przyjęciu wpisz ilość na dole
        listy; handlowiec dostanie e-mail. Rezygnacje rozliczasz w panelu dziennym.
      </p>
      <div
        className={cn(
          "mt-3 grid grid-cols-2 gap-2",
          informacjaCount > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3"
        )}
      >
        <MetricTile
          value={summary.activeCount}
          label="Do przyjęcia"
          hint="w kolejce dostaw"
          href={summary.activeCount > 0 ? "#dostawy-handlowcy" : undefined}
        />
        <MetricTile
          value={pickupReadyCount}
          label="Gotowe do odbioru"
          hint="u handlowców na zielono w Moje zamówienia"
          tone="emerald"
        />
        <MetricTile
          value={summary.partialCount}
          label="Częściowo"
          hint="część przyjęta, reszta czeka"
          tone={summary.partialCount > 0 ? "amber" : "default"}
        />
        {informacjaCount > 0 ? (
          <MetricTile
            value={informacjaCount}
            label="Informacje"
            hint="e-mail po dotarciu"
            tone="sky"
            href="#informacja"
          />
        ) : null}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        „Gotowe do odbioru” — całość przyjęta na magazyn, handlowiec widzi zieloną pozycję do
        potwierdzenia odbioru (nie ma ich już na liście przyjęcia poniżej). Brak dostawcy lub opisu
        uzupełniasz w{" "}
        <Link href="/podsumowanie" className="font-medium text-indigo-700 hover:underline">
          panelu dziennym
        </Link>{" "}
        (Weryfikacja).
      </p>
    </div>
  );
}

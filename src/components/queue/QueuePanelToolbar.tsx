"use client";

import Link from "next/link";
import type { QueueInboxSummary } from "@/lib/orders/queue-inbox";
import { cn } from "@/lib/cn";
import { brandLinkClass, panelSectionInsetClass, panelTypography, surfaceCardClass } from "@/lib/ui/ontime-theme";

function MetricTile({
  value,
  label,
  hint,
  href,
  onNavigate,
  tone = "default",
}: {
  value: number;
  label: string;
  hint?: string;
  href?: string;
  onNavigate?: () => void;
  tone?: "default" | "amber" | "sky" | "emerald";
}) {
  const inner = (
    <>
      <p
        className={cn(
          panelTypography.statValue,
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
    "rounded-md border px-3 py-2.5 text-left transition shadow-[var(--shadow-card)]",
    tone === "amber"
      ? "border-amber-200/90 bg-amber-50/60 hover:border-amber-300"
      : tone === "sky"
        ? "border-sky-200/90 bg-sky-50/50 hover:border-sky-300"
        : tone === "emerald"
          ? "border-emerald-200/90 bg-emerald-50/60 hover:border-emerald-300"
          : cn(surfaceCardClass, "hover:border-slate-300 hover:bg-slate-50/80")
  );

  if (href) {
    return (
      <a
        href={href}
        className={className}
        onClick={(e) => {
          if (onNavigate) {
            e.preventDefault();
            onNavigate();
          }
        }}
      >
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
  inventoryCount = 0,
  journalCount = 0,
  onOpenInventory,
  onOpenJournal,
  showProcurementLinks = true,
}: {
  summary: QueueInboxSummary;
  informacjaCount: number;
  pickupReadyCount: number;
  inventoryCount?: number;
  journalCount?: number;
  onOpenInventory?: () => void;
  onOpenJournal?: () => void;
  showProcurementLinks?: boolean;
}) {
  return (
    <div className={cn("border-b border-slate-100", panelSectionInsetClass)}>
      <p className={panelTypography.sectionTitle}>Przegląd magazynu</p>
      <p className={cn("mt-0.5", panelTypography.sectionDesc)}>
        Jedna lista przyjęcia: zamówienia (wpisz ilość) i informacje (powiadom handlowca). Towar
        często jeszcze nie dotarł — weryfikujesz wszystko u jednego dostawcy. Rezygnacje w panelu
        dziennym.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MetricTile
          value={journalCount}
          label="Dziennik dziś"
          hint="fizyczne dostawy na rampę"
          tone={journalCount > 0 ? "sky" : "default"}
          href={journalCount > 0 ? "#dziennik-dostaw" : undefined}
          onNavigate={onOpenJournal}
        />
        <MetricTile
          value={summary.activeCount}
          label="Do przyjęcia"
          hint={
            summary.informacjaCount > 0
              ? `${summary.zamowienieCount} zam. · ${summary.informacjaCount} info`
              : "zamówienia w kolejce"
          }
          href={summary.activeCount > 0 ? "#kolejka-przyjecie" : undefined}
        />
        <MetricTile
          value={inventoryCount}
          label="Na magazynie (inwentaryzacja)"
          hint={
            inventoryCount > 0
              ? "pełny odbiór, części i informacje — kliknij, aby zobaczyć listę"
              : pickupReadyCount > 0
                ? `${pickupReadyCount} gotowych do odbioru u handlowców (Moje zamówienia)`
                : "brak pozycji na regale"
          }
          tone="emerald"
          href={inventoryCount > 0 ? "#inwentaryzacja" : undefined}
          onNavigate={onOpenInventory}
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
            label="w tym informacje"
            hint="w tej samej liście przyjęcia"
            tone="sky"
            href="#kolejka-przyjecie"
          />
        ) : null}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        <strong>Dziennik dostaw</strong> — zapis kuriera, paczek i palet (zamiast Excela).{" "}
        <strong>Inwentaryzacja regału</strong> — co czeka na odbiór u handlowców.
        {showProcurementLinks ? (
          <>
            {" "}
            Brak dostawcy w prośbie uzupełnia dział zakupów w{" "}
            <Link href="/podsumowanie" className={brandLinkClass}>
              panelu dziennym
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}

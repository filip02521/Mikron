"use client";

import Link from "next/link";
import {
  IconClipboardList,
  IconPackageCheck,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import { QueueMetricTab } from "@/components/queue/QueueMetricTab";
import type { QueueInboxSummary } from "@/lib/orders/queue-inbox";
import { cn } from "@/lib/cn";
import { brandLinkClass, panelSectionInsetClass } from "@/lib/ui/ontime-theme";

export type QueueView = "receive" | "journal" | "inventory";

function buildReceiveHint(summary: QueueInboxSummary): string | undefined {
  if (summary.activeCount === 0) return "brak pozycji w kolejce";
  const parts: string[] = [];
  if (summary.zamowienieCount > 0) parts.push(`${summary.zamowienieCount} zam.`);
  if (summary.informacjaCount > 0) parts.push(`${summary.informacjaCount} info`);
  if (summary.partialCount > 0) parts.push(`${summary.partialCount} częściowo`);
  return parts.join(" · ");
}

export function QueuePanelToolbar({
  view,
  onViewChange,
  summary,
  pickupReadyCount,
  inventoryCount = 0,
  journalCount = 0,
  showDailyPanelLink = false,
  showTeethLink = false,
}: {
  view: QueueView;
  onViewChange: (view: QueueView) => void;
  summary: QueueInboxSummary;
  pickupReadyCount: number;
  inventoryCount?: number;
  journalCount?: number;
  showDailyPanelLink?: boolean;
  showTeethLink?: boolean;
}) {
  const receiveHint = buildReceiveHint(summary);
  const inventoryHint =
    inventoryCount > 0
      ? "pełny odbiór, części i informacje"
      : pickupReadyCount > 0
        ? `${pickupReadyCount} gotowych u handlowców`
        : "brak pozycji na regale";

  return (
    <div className={cn("border-b border-emerald-100/60 bg-emerald-50/20", panelSectionInsetClass)}>
      <div
        role="tablist"
        aria-label="Widok magazynu"
        className="grid grid-cols-3 gap-1.5 sm:gap-2"
      >
        <QueueMetricTab
          id="queue-tab-receive"
          ariaControls="queue-panel-receive"
          active={view === "receive"}
          count={summary.activeCount}
          label="Przyjęcie"
          hint={receiveHint}
          icon={<IconTruck size={14} />}
          tileClassName="bg-slate-100 text-slate-800"
          title="Kolejka przyjęcia towaru u dostawcy"
          onClick={() => onViewChange("receive")}
        />
        <QueueMetricTab
          id="queue-tab-journal"
          ariaControls="queue-panel-journal"
          active={view === "journal"}
          count={journalCount}
          label="Dziennik"
          hint={journalCount > 0 ? "przyjęte dostawy dziś" : "brak wpisów dziś"}
          icon={<IconClipboardList size={14} />}
          tileClassName="bg-sky-100 text-sky-800"
          title="Kurier, paczki, palety"
          onClick={() => onViewChange("journal")}
        />
        <QueueMetricTab
          id="queue-tab-inventory"
          ariaControls="queue-panel-inventory"
          active={view === "inventory"}
          count={inventoryCount}
          label="Regał"
          hint={inventoryHint}
          icon={<IconPackageCheck size={14} />}
          tileClassName="bg-emerald-100 text-emerald-800"
          title="Inwentaryzacja — co czeka na odbiór"
          onClick={() => onViewChange("inventory")}
        />
      </div>
      {showDailyPanelLink || showTeethLink ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg bg-slate-50/60 px-3 py-1.5 text-[10px] text-slate-500">
          {showDailyPanelLink ? (
            <>
              <span>Brak dostawcy uzupełnia zakupy w</span>
              <Link href="/podsumowanie" className={cn(brandLinkClass, "font-medium")}>
                panelu dziennym
              </Link>
            </>
          ) : null}
          {showDailyPanelLink && showTeethLink ? (
            <span aria-hidden className="text-slate-300">·</span>
          ) : null}
          {showTeethLink ? (
            <>
              <span>Zęby przyjmujesz w</span>
              <Link href="/zeby/przyjecie" className={cn(brandLinkClass, "font-medium")}>
                panelu zębów
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

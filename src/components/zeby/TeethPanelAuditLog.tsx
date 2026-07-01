"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPlDate } from "@/lib/display-labels";
import { actionFetchTeethOrderHistoryAudit } from "@/app/actions/teeth-orders";
import type { TeethOrderHistoryRow } from "@/lib/data/teeth-order-history";
import { teethOrderHistorySummary } from "@/lib/teeth/teeth-history-audit-copy";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { TeethPanelSection } from "@/components/zeby/TeethPanelSection";
import { IconClipboardPen } from "@/components/icons/StrokeIcons";

const AUDIT_SECTION_TILE = "bg-sky-100 text-sky-800";

export function TeethPanelAuditLog({
  supplierId,
  className,
}: {
  supplierId?: string | null;
  className?: string;
}) {
  const [rows, setRows] = useState<TeethOrderHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await actionFetchTeethOrderHistoryAudit({
        limit: 30,
        supplierId: supplierId ?? undefined,
      });
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd dziennika operacji");
      setRows([]);
    }
  }, [supplierId]);

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload]);

  return (
    <TeethPanelSection
      className={className}
      title="Dziennik operacji"
      hint="Kto i kiedy oznaczał zamówienia, zmieniał daty dostawy lub harmonogram zębów."
      icon={<IconClipboardPen size={18} strokeWidth={1.75} />}
      iconTileClassName={AUDIT_SECTION_TILE}
    >
      {error ? (
        <p className={cn(panelTypography.caption, "text-amber-800")}>
          Nie udało się wczytać dziennika: {error}
        </p>
      ) : !rows ? (
        <div className="space-y-2 motion-safe:animate-pulse" aria-busy="true">
          <div className="h-4 w-full max-w-md rounded bg-slate-100" />
          <div className="h-4 w-full max-w-sm rounded bg-slate-100" />
          <div className="h-4 w-full max-w-lg rounded bg-slate-100" />
        </div>
      ) : rows.length === 0 ? (
        <p className={cn(panelTypography.caption, "text-slate-600")}>
          Dziennik jest pusty — wpisy pojawią się po oznaczeniu zamówień lub zmianie harmonogramu.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="py-2.5 text-sm first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-medium text-slate-800">
                  {teethOrderHistorySummary(row.action, row.order_ids.length, row.meta)}
                </span>
                <time
                  className="shrink-0 text-xs text-slate-500 tabular-nums"
                  dateTime={row.action_at}
                >
                  {formatPlDate(row.action_at.slice(0, 10))}
                </time>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {[row.supplier?.name, row.actor_email ?? (row.actor_id ? "operator" : null)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </TeethPanelSection>
  );
}

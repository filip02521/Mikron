"use client";

import { useState } from "react";
import { UpcomingDeliverySupplierCard } from "@/components/deliveries/UpcomingDeliverySupplierCard";
import { Card } from "@/components/ui/Card";
import { IconChevronRight } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { OVERDUE_RECENT_DAYS, type OverdueDelivery } from "@/lib/data/upcoming-deliveries-shared";
import { sectionTitleClass } from "@/lib/ui/ontime-theme";

function lateLabel(o: OverdueDelivery): string {
  const days = `${o.daysLate} ${polishPluralWord(o.daysLate, "dzień", "dni", "dni")}`;
  return `${days} po terminie · termin ${formatPlDate(o.deadlineKey)}`;
}

function OverdueGroup({
  title,
  hint,
  items,
  defaultOpen,
}: {
  title: string;
  hint: string;
  items: OverdueDelivery[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left sm:px-4"
      >
        <IconChevronRight size={16} className={cn("shrink-0 text-slate-500 transition-transform", open && "rotate-90")} />
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <span className="text-sm tabular-nums text-slate-500">{items.length}</span>
        <span className="ml-1 hidden min-w-0 truncate text-[0.8125rem] text-slate-500 sm:inline">· {hint}</span>
      </button>
      {open ? (
        <div className="space-y-2 px-3 pb-3 sm:px-4 sm:pb-4">
          {items.map((o) => (
            <UpcomingDeliverySupplierCard
              key={`overdue-${o.supplier.supplierId}`}
              supplier={o.supplier}
              lateLabel={lateLabel(o)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Zaległe ZD oddzielnie od „Dziś”: świeże zaległości mogą przyjść w każdej chwili (otwarte),
 * starsze zwykle wymagają wyjaśnienia z zakupami — zamknięcia ZD albo pytania do dostawcy (zwinięte).
 */
export function DeliveryOverdueSection({ items }: { items: OverdueDelivery[] }) {
  if (items.length === 0) return null;
  const recent = items.filter((o) => o.daysLate <= OVERDUE_RECENT_DAYS);
  const stale = items.filter((o) => o.daysLate > OVERDUE_RECENT_DAYS);

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="border-b border-slate-100 px-3 pb-3 pt-4 sm:px-4">
        <h2 className={sectionTitleClass}>
          Po terminie <span className="font-sans text-base font-normal tabular-nums text-slate-500">{items.length}</span>
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          ZD, których termin minął, a towar jeszcze nie przyszedł. Najświeższe na górze.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        <OverdueGroup
          title={`Do ${OVERDUE_RECENT_DAYS} dni`}
          hint="może przyjść w każdej chwili"
          items={recent}
          defaultOpen
        />
        <OverdueGroup
          title={`Ponad ${OVERDUE_RECENT_DAYS} dni`}
          hint="do wyjaśnienia z zakupami: zamknąć ZD albo zapytać dostawcę"
          items={stale}
          defaultOpen={recent.length === 0}
        />
      </div>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import { formatDateString } from "@/lib/orders/dates";
import { locationLabel } from "@/lib/display-labels";
import {
  enrichUrgentItem,
  splitUrgentItems,
} from "@/lib/orders/procurement-daily-ui";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { ScheduleSupplierActionBar } from "@/components/summary/ScheduleSupplierActionBar";
import { vacationNoteLabel } from "@/lib/display-labels";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import type { SupplierSummaryMeta } from "@/lib/orders/summary-workspace";
import { cn } from "@/lib/cn";
import {
  checkboxBrandClass,
  panelNameLinkClass,
  rowPendingRingClass,
} from "@/lib/ui/ontime-theme";
import {
  urgentCardClassName,
  urgentGroupDividerClassName,
  urgentGroupHeadingClassName,
  urgentStatusBadgeVariant,
} from "@/components/summary/urgent-card-styles";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
  type DailyPanelSubsectionTone,
} from "@/components/summary/DailyPanelSubsectionBar";

export type UrgentQueuePart = "full" | "overdue" | "today";

const QUEUE_SECTION_ID: Record<Exclude<UrgentQueuePart, "full">, string> = {
  overdue: "kolejka-zalegle",
  today: "kolejka-harmonogram-dzis",
};

function SectionHelp() {
  return (
    <HelpPopover label="Pomoc" title="Zaległe i na dziś" shortLabel="Pomoc">
      <p className="mb-2">
        <strong className="font-medium text-slate-800">Zaległe</strong> — minął planowany termin.
        <strong className="font-medium text-slate-800"> Na dziś</strong> — zamówienie na bieżący
        dzień.
      </p>
      <p>
        Po złożeniu u dostawcy kliknij <strong className="font-medium text-slate-800">Zamówione</strong>.
        Przesuń i menu Więcej otwierają dodatkowe opcje.
      </p>
    </HelpPopover>
  );
}

function UrgentCard({
  item,
  supplierMeta,
  checked,
  rowPending,
  onToggle,
  onOpenSupplier,
  onVacation,
  onEdit,
  run,
}: {
  item: SummaryStandardItem;
  supplierMeta?: SupplierSummaryMeta | null;
  checked: boolean;
  rowPending: boolean;
  onToggle: () => void;
  onOpenSupplier: (id: string) => void;
  onVacation: (id: string) => void;
  onEdit: (id: string) => void;
  run: DailyPanelRunFn;
}) {
  const ui = enrichUrgentItem(item);
  const dateLabel = formatDateString(item.nextDate, "dd.MM");
  const isOverdue = ui.statusTitle === "Zaległe";

  return (
    <article
      className={cn(urgentCardClassName(isOverdue), rowPending && rowPendingRingClass)}
      aria-busy={rowPending}
    >
      <div className="flex flex-col gap-2 px-3 py-2">
        <div className="flex min-w-0 items-start gap-2">
          <input
            type="checkbox"
            className={cn("mt-0.5 h-4 w-4 shrink-0", checkboxBrandClass)}
            checked={checked}
            disabled={rowPending}
            onChange={onToggle}
            aria-label={`Zaznacz ${item.supplierName}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <button
                type="button"
                className={cn("text-sm font-semibold leading-tight", panelNameLinkClass)}
                onClick={() => onOpenSupplier(item.supplierId)}
              >
                {item.supplierName}
              </button>
              <Badge variant={urgentStatusBadgeVariant(isOverdue)} className="text-[10px]">
                {ui.statusTitle}
                {isOverdue ? ` · ${dateLabel}` : null}
              </Badge>
              {item.vacationNote ? (
                <Badge variant="warning" className="text-[10px]">
                  {vacationNoteLabel(item.vacationNote)}
                </Badge>
              ) : null}
              <span className="text-xs text-slate-500">{locationLabel(item.location)}</span>
            </div>
            {ui.statusDetail ? (
              <p
                className={cn(
                  "mt-0.5 line-clamp-2 text-xs leading-snug",
                  item.vacationNote ? "text-amber-900/90" : "text-slate-500"
                )}
              >
                {ui.statusDetail}
              </p>
            ) : null}
            {supplierMeta ? (
              <SupplierContactActions
                notes={supplierMeta.notes}
                mails={supplierMeta.mails}
                extraInfo={supplierMeta.extra_info}
                className="mt-1"
              />
            ) : null}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100/80 pt-2">
          <ScheduleSupplierActionBar
            supplierId={item.supplierId}
            supplierName={item.supplierName}
            location={item.location}
            pending={rowPending}
            run={run}
            onOpenSupplier={() => onOpenSupplier(item.supplierId)}
            onVacation={() => onVacation(item.supplierId)}
            onEdit={() => onEdit(item.supplierId)}
          />
        </div>
      </div>
    </article>
  );
}

function UrgentGroup({
  title,
  items,
  variant,
  showTopDivider = false,
  hideHeading = false,
  supplierMeta,
  selected,
  isScopePending,
  onToggle,
  onOpenSupplier,
  onVacation,
  onEdit,
  run,
}: {
  title: string;
  items: SummaryStandardItem[];
  variant: "overdue" | "today";
  showTopDivider?: boolean;
  hideHeading?: boolean;
  supplierMeta: Record<string, SupplierSummaryMeta>;
  selected: Record<string, boolean>;
  isScopePending: (supplierId: string) => boolean;
  onToggle: (supplierId: string) => void;
  onOpenSupplier: (id: string) => void;
  onVacation: (id: string) => void;
  onEdit: (id: string) => void;
  run: DailyPanelRunFn;
}) {
  if (!items.length) return null;

  const isOverdue = variant === "overdue";

  return (
    <section
      className={cn("space-y-2", showTopDivider && "border-t border-slate-200/90 pt-4")}
    >
      {!hideHeading ? (
        <div className="flex items-center gap-3">
          <h3 className={urgentGroupHeadingClassName(isOverdue)}>
            {title} ({items.length})
          </h3>
          <div className={urgentGroupDividerClassName(isOverdue)} aria-hidden />
        </div>
      ) : null}
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.supplierId}>
            <UrgentCard
              item={item}
              supplierMeta={supplierMeta[item.supplierId]}
              checked={!!selected[item.supplierId]}
              rowPending={isScopePending(item.supplierId)}
              onToggle={() => onToggle(item.supplierId)}
              onOpenSupplier={onOpenSupplier}
              onVacation={onVacation}
              onEdit={onEdit}
              run={run}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UrgentOrdersSection({
  items,
  supplierMeta,
  queuePart = "full",
  run,
  onOpenSupplier,
  onVacation,
  onEdit,
  selected,
  onToggle,
  onSelectAllInScope,
  selectedCount,
  onBulkOrdered,
  isScopePending,
  isBulkPending,
  embedded = false,
  showBulkToolbar = false,
  queueStep,
  sectionId,
}: {
  items: SummaryStandardItem[];
  supplierMeta: Record<string, SupplierSummaryMeta>;
  queuePart?: UrgentQueuePart;
  run: DailyPanelRunFn;
  onOpenSupplier: (id: string) => void;
  onVacation: (id: string) => void;
  onEdit: (id: string) => void;
  selected: Record<string, boolean>;
  onToggle: (supplierId: string) => void;
  onSelectAllInScope: (checked: boolean, supplierIds: string[]) => void;
  selectedCount: number;
  onBulkOrdered: () => void;
  isScopePending: (supplierId: string) => boolean;
  isBulkPending: boolean;
  embedded?: boolean;
  showBulkToolbar?: boolean;
  queueStep?: number;
  sectionId?: string;
}) {
  const { overdue, todayList } = useMemo(() => splitUrgentItems(items), [items]);
  const showOverdue = queuePart === "full" || queuePart === "overdue";
  const showToday = queuePart === "full" || queuePart === "today";
  const overdueItems = showOverdue ? overdue : [];
  const todayItems = showToday ? todayList : [];
  const scopeItems =
    queuePart === "overdue" ? overdueItems : queuePart === "today" ? todayItems : items;
  const scopeIds = useMemo(() => scopeItems.map((i) => i.supplierId), [scopeItems]);
  const allSelected = scopeIds.length > 0 && scopeIds.every((id) => selected[id]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const handleBulkClick = () => {
    if (selectedCount > 1) {
      setBulkConfirmOpen(true);
      return;
    }
    onBulkOrdered();
  };

  const visibleCount = overdueItems.length + todayItems.length;
  const hideInnerHeading = queuePart !== "full";
  const subsectionTone: DailyPanelSubsectionTone =
    queuePart === "overdue" ? "overdue" : queuePart === "today" ? "today" : "default";
  const scopeCount = scopeItems.length;

  if (visibleCount === 0) return null;

  const titles: Record<UrgentQueuePart, string> = {
    full: "Harmonogram — zaległe i na dziś",
    overdue: "Zaległe",
    today: "Na dziś — harmonogram",
  };

  const descriptions: Record<UrgentQueuePart, string> = {
    full: [
      overdue.length && todayList.length
        ? `${overdue.length} zaległych · ${todayList.length} na dziś`
        : overdue.length
          ? `${overdue.length} zaległych`
          : `${todayList.length} na dziś`,
    ].filter(Boolean).join(""),
    overdue: `${overdue.length} po terminie — pierwszy krok kolejki dnia`,
    today: `${todayList.length} na bieżący dzień`,
  };

  const headerAction =
    showBulkToolbar && scopeIds.length > 0 ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SectionHelp />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className={cn("h-4 w-4", checkboxBrandClass)}
            checked={allSelected}
            onChange={(e) => onSelectAllInScope(e.target.checked, scopeIds)}
          />
          Wszystkie
        </label>
        <Button
          size="sm"
          disabled={isBulkPending || selectedCount === 0}
          onClick={handleBulkClick}
        >
          Zamówione ({selectedCount})
        </Button>
      </div>
    ) : queuePart === "full" ? (
      <SectionHelp />
    ) : null;

  const inner = (
    <>
      <ConfirmDialog
        open={bulkConfirmOpen}
        title="Oznaczyć wielu dostawców?"
        message={`Oznaczysz ${selectedCount} dostawców jako zamówionych. Po potwierdzeniu masz 5 sekund na cofnięcie całej operacji.`}
        confirmLabel={`Zamówione (${selectedCount})`}
        pending={isBulkPending}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={() => {
          setBulkConfirmOpen(false);
          onBulkOrdered();
        }}
      />
      {embedded ? (
        <DailyPanelSubsectionBar
          title={titles[queuePart]}
          description={descriptions[queuePart]}
          action={headerAction}
          tone={subsectionTone}
          step={queueStep}
          count={scopeCount}
        />
      ) : (
        <CardHeader
          inset
          title={titles[queuePart]}
          description={descriptions[queuePart]}
          action={headerAction}
        />
      )}
      <div className="space-y-3 p-2.5 sm:p-3">
        {showOverdue ? (
          <UrgentGroup
            title="Zaległe"
            variant="overdue"
            items={overdueItems}
            hideHeading={hideInnerHeading}
            supplierMeta={supplierMeta}
            selected={selected}
            isScopePending={isScopePending}
            onToggle={onToggle}
            onOpenSupplier={onOpenSupplier}
            onVacation={onVacation}
            onEdit={onEdit}
            run={run}
          />
        ) : null}
        {showToday ? (
          <UrgentGroup
            title="Na dziś"
            variant="today"
            showTopDivider={queuePart === "full" && overdueItems.length > 0}
            hideHeading={hideInnerHeading}
            items={todayItems}
            supplierMeta={supplierMeta}
            selected={selected}
            isScopePending={isScopePending}
            onToggle={onToggle}
            onOpenSupplier={onOpenSupplier}
            onVacation={onVacation}
            onEdit={onEdit}
            run={run}
          />
        ) : null}
      </div>
    </>
  );

  if (!embedded) {
    return <Card padding={false}>{inner}</Card>;
  }

  const anchorId =
    sectionId ??
    (queuePart === "overdue" || queuePart === "today"
      ? QUEUE_SECTION_ID[queuePart]
      : undefined);

  return (
    <section
      id={anchorId}
      className={cn("scroll-mt-24", dailyPanelQueueShellClass(subsectionTone))}
    >
      {inner}
    </section>
  );
}

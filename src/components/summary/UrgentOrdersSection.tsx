"use client";

import { useMemo, useState } from "react";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import { formatDateString } from "@/lib/orders/dates";
import { locationLabel, vacationNoteLabel } from "@/lib/display-labels";
import {
  enrichUrgentItem,
  splitUrgentItems,
} from "@/lib/orders/procurement-daily-ui";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { ScheduleSupplierActionBar } from "@/components/summary/ScheduleSupplierActionBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import type { SupplierSummaryMeta } from "@/lib/orders/summary-workspace";
import { cn } from "@/lib/cn";
import {
  checkboxBrandClass,
  panelTypography,
  rowPendingRingClass,
} from "@/lib/ui/ontime-theme";
import { panelRowClearFocusOnLeave, panelRowGroupClass } from "@/lib/ui/panel-row-actions-reveal";
import {
  urgentCardBodyClass,
  urgentCardClassName,
  urgentCardFooterClass,
  urgentCardTone,
  urgentGroupDividerClassName,
  urgentGroupHeadingClassName,
  urgentSupplierNameLinkClass,
} from "@/components/summary/urgent-card-styles";
import { UrgentScheduleDateMeta } from "@/components/summary/UrgentScheduleDateMeta";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
  type DailyPanelSubsectionTone,
} from "@/components/summary/DailyPanelSubsectionBar";
import { HelpMenuGlyph, PanelQueueStatDot } from "@/components/ui/UiGlyphs";
import { DAILY_PANEL_QUEUE_SECTION, dailyPanelQueueSectionScrollClass } from "@/lib/orders/daily-panel-section-anchors";
import { dailyPanelListBodyClass } from "@/components/summary/daily-panel-list-styles";
import { ProcurementRequestActionsFooter } from "@/components/summary/ProcurementRequestActionsFooter";
import {
  ProcurementRequestCardHeader,
  ProcurementRequestContextBlock,
} from "@/components/summary/ProcurementRequestCardZones";

export type UrgentQueuePart = "full" | "overdue" | "today";

const QUEUE_SECTION_ID: Record<Exclude<UrgentQueuePart, "full">, string> = {
  overdue: DAILY_PANEL_QUEUE_SECTION.overdue,
  today: DAILY_PANEL_QUEUE_SECTION.today,
};

function SectionHelp() {
  return (
    <HelpPopover label="Pomoc — zaległe i na dziś" title="Zaległe i na dziś" shortLabel="Pomoc">
      <HelpBlock title="Co oznaczają sekcje">
        <ul className="list-disc space-y-1.5 pl-4">
          <li className="inline-flex flex-wrap items-center gap-1.5">
            <PanelQueueStatDot tone="overdue" />
            <span>
              <strong className="font-medium text-slate-800">Zaległe</strong> — minął planowany
              termin zamówienia.
            </span>
          </li>
          <li className="inline-flex flex-wrap items-center gap-1.5">
            <PanelQueueStatDot tone="today" />
            <span>
              <strong className="font-medium text-slate-800">Na dziś</strong> — harmonogram na
              bieżący dzień.
            </span>
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Akcje">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            Po złożeniu zamówienia u dostawcy kliknij{" "}
            <strong className="font-medium text-slate-800">Zamówione</strong>.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Przesuń</strong> — zmiana daty u
            dostawcy.
          </li>
          <li>
            Menu <HelpMenuGlyph className="align-[-2px]" /> — urlop i edycja karty dostawcy.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Komputer i mobile">
        <p>
          Na komputerze pasek akcji (Zamówione / Przesuń) wysuwa się po chwili na karcie — jak w
          prośbach. Na tablecie i telefonie jest widoczny cały czas.
        </p>
      </HelpBlock>
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
  todayDateKey,
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
  todayDateKey?: string;
}) {
  const ui = enrichUrgentItem(item, todayDateKey);
  const dateLabel = formatDateString(item.nextDate, "dd.MM");
  const isOverdue = ui.statusTitle === "Zaległe";
  const tone = urgentCardTone(isOverdue);
  const vacationLabel = item.vacationNote ? vacationNoteLabel(item.vacationNote) : null;
  const rawDetail =
    ui.statusDetail &&
    (!vacationLabel || ui.statusDetail !== vacationLabel)
      ? ui.statusDetail
      : null;
  // Data / „Dziś” jest w trailing (UrgentScheduleDateMeta) — bez powtórki w opisie.
  const detailText =
    rawDetail &&
    !(isOverdue && rawDetail === `Termin planowy: ${dateLabel}`)
      ? rawDetail
      : null;

  const chips = vacationLabel ? (
    <Badge variant="warning" className="w-fit text-[10px]">
      {vacationLabel}
    </Badge>
  ) : null;

  const meta = (
    <span
      className={cn(
        panelTypography.rowMeta,
        "inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
      )}
    >
      <span>{locationLabel(item.location)}</span>
      {supplierMeta ? (
        <>
          <span aria-hidden className="text-slate-300">
            ·
          </span>
          <SupplierContactActions
            notes={supplierMeta.notes}
            mails={supplierMeta.mails}
            extraInfo={supplierMeta.extra_info}
            display="rowMeta"
          />
        </>
      ) : null}
    </span>
  );

  return (
    <article
      className={cn(
        panelRowGroupClass(urgentCardClassName(tone)),
        rowPending && rowPendingRingClass
      )}
      aria-busy={rowPending}
      onMouseLeave={panelRowClearFocusOnLeave}
    >
      <div className={urgentCardBodyClass}>
        <div className="flex min-w-0 gap-2">
          <input
            type="checkbox"
            className={cn("mt-0.5 h-5 w-5 shrink-0 sm:h-4 sm:w-4", checkboxBrandClass)}
            checked={checked}
            disabled={rowPending}
            onChange={onToggle}
            aria-label={`Zaznacz ${item.supplierName}`}
          />
          <div className="min-w-0 flex-1">
            <ProcurementRequestCardHeader
              title={
                <button
                  type="button"
                  className={cn(
                    panelTypography.rowTitle,
                    urgentSupplierNameLinkClass(tone),
                    "min-w-0 max-w-full truncate"
                  )}
                  onClick={() => onOpenSupplier(item.supplierId)}
                >
                  {item.supplierName}
                </button>
              }
              trailing={
                <UrgentScheduleDateMeta tone={tone} dateLabel={dateLabel} />
              }
            />
            <ProcurementRequestContextBlock chips={chips} meta={meta} />
            {detailText ? (
              <p
                className={cn(
                  "mt-0.5 line-clamp-2",
                  panelTypography.caption,
                  isOverdue || vacationLabel ? "text-amber-900/85" : "text-slate-500"
                )}
              >
                {detailText}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <ProcurementRequestActionsFooter
        forceVisible={rowPending}
        className={urgentCardFooterClass}
      >
        <ScheduleSupplierActionBar
          layout="footer"
          tone={tone}
          supplierId={item.supplierId}
          supplierName={item.supplierName}
          location={item.location}
          pending={rowPending}
          run={run}
          onOpenSupplier={() => onOpenSupplier(item.supplierId)}
          onVacation={() => onVacation(item.supplierId)}
          onEdit={() => onEdit(item.supplierId)}
        />
      </ProcurementRequestActionsFooter>
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
  todayDateKey,
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
  todayDateKey?: string;
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
              todayDateKey={todayDateKey}
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
  todayDateKey,
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
  todayDateKey?: string;
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
  const { overdue, todayList } = useMemo(
    () => splitUrgentItems(items, todayDateKey),
    [items, todayDateKey]
  );
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

  const descriptions: Record<UrgentQueuePart, string | undefined> = {
    full: [
      overdue.length && todayList.length
        ? `${overdue.length} zaległych · ${todayList.length} na dziś`
        : overdue.length
          ? `${overdue.length} zaległych`
          : `${todayList.length} na dziś`,
    ].filter(Boolean).join(""),
    overdue: undefined,
    today: undefined,
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
          className="h-7"
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
        message={`Oznaczysz ${selectedCount} dostawców jako zamówionych. Po potwierdzeniu masz 10 sekund na cofnięcie całej operacji.`}
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
          countUnit={{ one: "dostawca", few: "dostawców", many: "dostawców" }}
          compact
        />
      ) : (
        <CardHeader
          inset
          title={titles[queuePart]}
          description={descriptions[queuePart]}
          action={headerAction}
        />
      )}
      <div className={dailyPanelListBodyClass}>
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
            todayDateKey={todayDateKey}
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
            todayDateKey={todayDateKey}
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
      className={cn(dailyPanelQueueSectionScrollClass, dailyPanelQueueShellClass(subsectionTone))}
    >
      {inner}
    </section>
  );
}

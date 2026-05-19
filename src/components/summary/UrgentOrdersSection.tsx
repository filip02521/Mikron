"use client";

import { useMemo, useState } from "react";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import { formatDateString } from "@/lib/orders/dates";
import { locationLabel } from "@/lib/display-labels";
import {
  enrichUrgentItem,
  splitUrgentItems,
} from "@/lib/orders/procurement-daily-ui";
import { actionMarkOrdered, actionShiftOrder } from "@/app/actions/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { HoldToConfirmButton } from "@/components/ui/HoldToConfirmButton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { ShiftMenu } from "@/components/summary/ShiftMenu";
import { SupplierQuickActionsMenu } from "@/components/procurement/SupplierQuickActionsMenu";
import { vacationNoteLabel } from "@/lib/display-labels";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import type { SupplierSummaryMeta } from "@/lib/orders/summary-workspace";
import type { DailyUrgentProgress } from "@/lib/orders/daily-urgent-progress";
import { cn } from "@/lib/cn";

function SectionHelp() {
  return (
    <HelpPopover label="Pomoc" title="Zaległe i na dziś" shortLabel="Pomoc">
      <p className="mb-2">
        <strong className="font-medium text-slate-800">Zaległe</strong> — minął planowany termin.
        <strong className="font-medium text-slate-800"> Na dziś</strong> — zamówienie na bieżący
        dzień.
      </p>
      <p>
        Po złożeniu u dostawcy <strong className="font-medium text-slate-800">przytrzymaj Zamówione</strong> (~0,7 s).
      </p>
    </HelpPopover>
  );
}

function UrgentCard({
  item,
  supplierMeta,
  checked,
  pending,
  onToggle,
  onOpenSupplier,
  onVacation,
  onEdit,
  run,
}: {
  item: SummaryStandardItem;
  supplierMeta?: SupplierSummaryMeta | null;
  checked: boolean;
  pending: boolean;
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
      className={cn(
        "rounded-xl border border-slate-200 bg-white",
        isOverdue && "border-l-[3px] border-l-slate-500"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 rounded border-slate-300 text-slate-700"
          checked={checked}
          onChange={onToggle}
          aria-label={`Zaznacz ${item.supplierName}`}
        />
        <div className="min-w-0 flex-[1_1_12rem]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="cursor-pointer text-left text-sm font-semibold text-slate-900 hover:underline"
              onClick={() => onOpenSupplier(item.supplierId)}
            >
              {item.supplierName}
            </button>
            <Badge variant="default" className="text-[10px]">
              {ui.statusTitle}
              {isOverdue ? ` · ${dateLabel}` : null}
            </Badge>
            <span className="text-xs text-slate-500">{locationLabel(item.location)}</span>
            {item.vacationNote ? (
              <Badge variant="warning" className="text-[10px]">
                {vacationNoteLabel(item.vacationNote)}
              </Badge>
            ) : null}
          </div>
          {ui.statusDetail ? (
            <p
              className={cn(
                "mt-1 text-xs leading-relaxed",
                item.vacationNote
                  ? "rounded-lg border border-amber-200/80 bg-amber-50/60 px-2.5 py-1.5 text-amber-950"
                  : "text-slate-500"
              )}
            >
              {ui.statusDetail}
            </p>
          ) : null}
          {supplierMeta ? (
            <SupplierContactActions
              notes={supplierMeta.notes}
              mails={supplierMeta.mails}
              compact
              className="mt-2"
            />
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <ButtonGroup ariaLabel="Zamówione — przytrzymaj, aby potwierdzić">
            <HoldToConfirmButton
              label="Zamówione"
              variant="primary"
              disabled={pending}
              className="px-3 py-2"
              onConfirm={() =>
                run(
                  () => actionMarkOrdered(item.supplierId),
                  "Oznaczono jako zamówione",
                  "Oznaczanie jako zamówione…"
                )
              }
            />
          </ButtonGroup>
          <ShiftMenu
            disabled={pending}
            onShiftWeeks={(w) =>
              run(
                () => actionShiftOrder(item.supplierId, w, null),
                `Przesunięto o ${w} ${w === 1 ? "tydzień" : "tygodnie"}`,
                `Przesuwanie o ${w} ${w === 1 ? "tydzień" : "tygodnie"}…`
              )
            }
            onShiftDate={(iso) =>
              run(
                () => actionShiftOrder(item.supplierId, null, iso),
                "Ustawiono datę przesunięcia",
                "Zapisywanie nowej daty…"
              )
            }
          />
          <SupplierQuickActionsMenu
            supplierId={item.supplierId}
            supplierName={item.supplierName}
            location={item.location}
            pending={pending}
            run={run}
            onOpenDetails={() => onOpenSupplier(item.supplierId)}
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
  supplierMeta,
  selected,
  pending,
  onToggle,
  onOpenSupplier,
  onVacation,
  onEdit,
  run,
}: {
  title: string;
  items: SummaryStandardItem[];
  supplierMeta: Record<string, SupplierSummaryMeta>;
  selected: Record<string, boolean>;
  pending: boolean;
  onToggle: (supplierId: string) => void;
  onOpenSupplier: (id: string) => void;
  onVacation: (id: string) => void;
  onEdit: (id: string) => void;
  run: DailyPanelRunFn;
}) {
  if (!items.length) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title} ({items.length})
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.supplierId}>
            <UrgentCard
              item={item}
              supplierMeta={supplierMeta[item.supplierId]}
              checked={!!selected[item.supplierId]}
              pending={pending}
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
  urgentProgress,
  pending,
  run,
  onOpenSupplier,
  onVacation,
  onEdit,
  selected,
  onToggle,
  onSelectAll,
  selectedCount,
  onBulkOrdered,
}: {
  items: SummaryStandardItem[];
  supplierMeta: Record<string, SupplierSummaryMeta>;
  urgentProgress?: DailyUrgentProgress;
  pending: boolean;
  run: DailyPanelRunFn;
  onOpenSupplier: (id: string) => void;
  onVacation: (id: string) => void;
  onEdit: (id: string) => void;
  selected: Record<string, boolean>;
  onToggle: (supplierId: string) => void;
  onSelectAll: (checked: boolean) => void;
  selectedCount: number;
  onBulkOrdered: () => void;
}) {
  const { overdue, todayList } = useMemo(() => splitUrgentItems(items), [items]);
  const allIds = useMemo(() => items.map((i) => i.supplierId), [items]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected[id]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const handleBulkClick = () => {
    if (selectedCount > 1) {
      setBulkConfirmOpen(true);
      return;
    }
    onBulkOrdered();
  };

  const descriptionParts: string[] = [];
  if (overdue.length && todayList.length) {
    descriptionParts.push(`${overdue.length} zaległych · ${todayList.length} na dziś`);
  } else if (overdue.length) {
    descriptionParts.push(`${overdue.length} zaległych`);
  } else if (todayList.length) {
    descriptionParts.push(`${todayList.length} na dziś`);
  }
  if (urgentProgress?.hasWork) {
    descriptionParts.push(
      urgentProgress.complete
        ? "lista domknięta"
        : `zostało ${urgentProgress.remaining} z ${urgentProgress.total}`
    );
  }
  const description =
    descriptionParts.length > 0 ? descriptionParts.join(" · ") : "Brak pozycji";

  return (
    <Card padding={false}>
      <ConfirmDialog
        open={bulkConfirmOpen}
        title="Oznaczyć wielu dostawców?"
        message={`Oznaczysz ${selectedCount} dostawców jako zamówionych. Po potwierdzeniu masz 5 sekund na cofnięcie całej operacji.`}
        confirmLabel={`Zamówione (${selectedCount})`}
        pending={pending}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={() => {
          setBulkConfirmOpen(false);
          onBulkOrdered();
        }}
      />
      <CardHeader
        inset
        title="Harmonogram — zaległe i na dziś"
        description={description}
        action={
          items.length > 0 ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <SectionHelp />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                />
                Wszystkie
              </label>
              <Button
                size="sm"
                disabled={pending || selectedCount === 0}
                onClick={handleBulkClick}
              >
                Zamówione ({selectedCount})
              </Button>
            </div>
          ) : (
            <SectionHelp />
          )
        }
      />

      {!items.length ? (
        <EmptyState
          title="Brak zamówień na dziś"
          description="Sprawdź plan tygodnia poniżej."
        />
      ) : (
        <div className="space-y-4 p-3 sm:p-4">
          <UrgentGroup
            title="Zaległe"
            items={overdue}
            supplierMeta={supplierMeta}
            selected={selected}
            pending={pending}
            onToggle={onToggle}
            onOpenSupplier={onOpenSupplier}
            onVacation={onVacation}
            onEdit={onEdit}
            run={run}
          />
          <UrgentGroup
            title="Na dziś"
            items={todayList}
            supplierMeta={supplierMeta}
            selected={selected}
            pending={pending}
            onToggle={onToggle}
            onOpenSupplier={onOpenSupplier}
            onVacation={onVacation}
            onEdit={onEdit}
            run={run}
          />
        </div>
      )}
    </Card>
  );
}

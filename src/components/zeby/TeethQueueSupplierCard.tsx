"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { checkboxBrandClass } from "@/lib/ui/ontime-theme";
import { formatPlDate, vacationNoteLabel } from "@/lib/display-labels";
import { warsawTodayDateKey } from "@/lib/warehouse/delivery-receipts-shared";
import { plProsba } from "@/lib/ui/polish-plurals";
import { polishPluralWord } from "@/lib/email/polish-plural";
import {
  IconCalendar,
  IconChevronDown,
  IconCircleCheck,
  IconClipboardList,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import { TeethOrderFileUpload } from "@/components/zeby/TeethOrderFileUpload";
import { TeethQueueOrderRow } from "@/components/zeby/TeethQueueOrderRow";
import { TeethQueueOrderSummary } from "@/components/zeby/TeethQueueOrderSummary";
import type {
  TeethQueueGroup,
  TeethQueueItem,
  TeethSupplierDeliveryEta,
} from "@/lib/data/teeth-queue-shared";
import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";
import {
  groupTeethQueueByProductLine,
  teethOrderQueueState,
  teethOrderStateNeedsFix,
  teethOrderUnorderedPositions,
} from "@/lib/teeth/teeth-queue-view-model";
import {
  TeethProductLineChips,
  TeethProductLineSectionHeader,
  teethLineSectionDomId,
} from "@/components/zeby/TeethProductLineSectionHeader";

type StepTone = "done" | "todo" | "warn" | "idle";

function StepMarker({ tone, index }: { tone: StepTone; index: number }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
        tone === "done" && "bg-indigo-600 text-white",
        tone === "warn" && "bg-amber-400 text-amber-950",
        tone === "todo" && "bg-white text-indigo-700 ring-2 ring-indigo-500",
        tone === "idle" && "bg-white text-slate-400 ring-1 ring-slate-300",
      )}
      aria-hidden
    >
      {tone === "done" ? <IconCircleCheck size={14} strokeWidth={2.5} /> : index}
    </span>
  );
}

function Step({
  index,
  tone,
  title,
  children,
}: {
  index: number;
  tone: StepTone;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <StepMarker tone={tone} index={index} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-500">{title}</p>
        <div className="mt-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

function etaLabel(eta: TeethSupplierDeliveryEta | null | undefined): string | null {
  if (!eta) return null;
  return `dostawa zwykle ~${eta.avgBusinessDays} dni rob. (ok. ${formatPlDate(eta.expectedDate)})`;
}

export function TeethQueueSupplierCard({
  group,
  items,
  readinessCtx,
  positionSelection,
  pending,
  hasFile,
  fileName,
  onFileChanged,
  onTogglePositions,
  onToggleAll,
  selectedTeethCount,
  onMarkGroup,
  onMarkSchedule,
  onEditSaved,
}: {
  group: TeethQueueGroup;
  items: TeethQueueItem[];
  readinessCtx?: TeethPanelReadinessContext;
  positionSelection: Map<string, Set<number>>;
  pending: boolean;
  hasFile: boolean;
  fileName: string | null;
  onFileChanged: (hasFile: boolean) => void;
  onTogglePositions: (orderId: string, positions: number[], select: boolean) => void;
  onToggleAll: () => void;
  /** Zaznaczone (niezamówione) zęby u tego dostawcy — przycisk oznacza wtedy tylko je. */
  selectedTeethCount: number;
  onMarkGroup: () => void;
  onMarkSchedule: () => void;
  onEditSaved?: (message?: string) => void;
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);

  const rows = useMemo(
    () =>
      items.map((item) => ({ item, state: teethOrderQueueState(item, readinessCtx) })),
    [items, readinessCtx],
  );
  const stateById = useMemo(() => new Map(rows.map((r) => [r.item.id, r.state])), [rows]);
  const sections = useMemo(
    () => groupTeethQueueByProductLine(items, readinessCtx),
    [items, readinessCtx],
  );
  const sectionDomId = (key: string) => teethLineSectionDomId("kolejka", group.supplierId, key);
  const needsFixCount = rows.filter((r) => teethOrderStateNeedsFix(r.state)).length;
  const readyCount = rows.filter((r) => r.state === "ready").length;
  const openTeeth = items.reduce((sum, item) => sum + teethOrderUnorderedPositions(item).length, 0);

  const allSelected =
    openTeeth > 0 &&
    items.every((item) => {
      const open = teethOrderUnorderedPositions(item);
      const sel = positionSelection.get(item.id);
      return open.every((p) => sel?.has(p));
    });

  const schedule = group.dueSchedule ?? null;
  // Kolejka pokazuje tylko cykle przypadające dziś lub wcześniej — wcześniej = zaległy.
  const scheduleOverdue = Boolean(
    schedule?.computed_next_date && schedule.computed_next_date < warsawTodayDateKey(),
  );
  const scheduleOnly = items.length === 0 && Boolean(schedule);
  const locked = items.length > 0 && items.every((i) => i.status !== "Nowe" && i.status !== "Weryfikacja");
  const fileOwnerId = (items.find((i) => i.teeth_order_file_path?.trim()) ?? items[0])?.id ?? null;

  const partialSelection = selectedTeethCount > 0 && selectedTeethCount < openTeeth;
  const listTone: StepTone = needsFixCount > 0 ? "warn" : "done";
  const fileTone: StepTone = hasFile ? "done" : "todo";
  const markTone: StepTone = hasFile && readyCount > 0 ? "todo" : "idle";
  const eta = etaLabel(group.deliveryEta);

  return (
    <section
      aria-label={`Dostawca ${group.supplierName}`}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="space-y-4 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{group.supplierName}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {items.length > 0 ? (
                <>
                  {items.length} {plProsba(items.length)} · {openTeeth} {polishPluralWord(openTeeth, "ząb", "zęby", "zębów")} do zamówienia
                </>
              ) : (
                "Brak próśb handlowców"
              )}
              {eta ? <> · {eta}</> : null}
            </p>
            <TeethProductLineChips
              sections={sections.map((sec) => ({ ...sec, count: sec.items.length }))}
              sectionDomId={sectionDomId}
            />
          </div>
          {schedule?.computed_next_date ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
                scheduleOverdue
                  ? "bg-amber-50 text-amber-900 ring-amber-300"
                  : "bg-sky-50 text-sky-800 ring-sky-200",
              )}
              title="Stały cykl zamówień z harmonogramu dostawcy"
            >
              <IconCalendar size={13} />
              {scheduleOverdue
                ? `Cykl zaległy od ${formatPlDate(schedule.computed_next_date)}`
                : "Cykl: zamów dziś"}
              {schedule.vacation_note ? ` · ${vacationNoteLabel(schedule.vacation_note)}` : ""}
            </span>
          ) : null}
        </div>

        {!group.supplierId && items.length > 0 ? (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            <p className="font-semibold">Te prośby nie mają dostawcy</p>
            <p className="mt-0.5 text-xs text-amber-800">
              Kliknij „Uzupełnij” przy prośbie i wybierz dostawcę - prośba przeniesie się do
              jego karty, gdzie ją zamówisz.
            </p>
          </div>
        ) : scheduleOnly ? (
          <div className="flex flex-col gap-3 rounded-lg bg-sky-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-sky-900">
              {scheduleOverdue
                ? "Zamówienie z harmonogramu jest zaległe."
                : "Dziś przypada zamówienie z harmonogramu."}{" "}
              Złóż je u dostawcy i oznacz - termin przesunie się na kolejny cykl.
            </p>
            <Button size="sm" className="min-h-9 shrink-0" disabled={pending} onClick={onMarkSchedule}>
              <IconTruck size={15} />
              Oznacz cykl jako zamówiony
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 rounded-lg bg-indigo-50/70 p-3 ring-1 ring-inset ring-indigo-100 sm:grid-cols-3 sm:gap-3">
            <Step index={1} tone={listTone} title="Lista zębów">
              {needsFixCount > 0 ? (
                <p className="text-sm font-medium text-amber-800">
                  {needsFixCount} {plProsba(needsFixCount)} do uzupełnienia
                  <span className="block text-xs font-normal text-amber-700">
                    Zostaną pominięte przy oznaczaniu.
                  </span>
                </p>
              ) : (
                <p className="text-sm font-medium text-slate-800">Wszystkie kompletne</p>
              )}
            </Step>
            <Step index={2} tone={fileTone} title="Plik zamówienia">
              {fileOwnerId ? (
                <TeethOrderFileUpload
                  orderId={fileOwnerId}
                  existingFileName={fileName}
                  required={!hasFile}
                  locked={locked}
                  slotHint={hasFile ? null : "Excel, PDF lub XML - jeden na całego dostawcę"}
                  onUploaded={() => onFileChanged(true)}
                  onRemoved={() => onFileChanged(false)}
                />
              ) : null}
            </Step>
            <Step index={3} tone={markTone} title="Po złożeniu u dostawcy">
              <Button
                size="sm"
                variant={partialSelection ? "primary" : "secondary"}
                className="min-h-9 w-full sm:w-auto"
                disabled={pending || !hasFile || readyCount === 0}
                onClick={onMarkGroup}
                title={
                  !hasFile
                    ? "Najpierw wgraj plik zamówienia"
                    : readyCount === 0
                      ? "Żadna prośba nie ma kompletnej listy"
                      : partialSelection
                        ? "Oznacz tylko zaznaczone zęby - reszta zostanie w kolejce"
                        : "Oznacz wszystkie zęby z kompletnych próśb u tego dostawcy"
                }
              >
                <IconTruck size={15} />
                {partialSelection
                  ? `Oznacz zaznaczone (${selectedTeethCount})`
                  : `Oznacz wszystkie (${openTeeth})`}
              </Button>
              {!hasFile ? (
                <p className="mt-1 text-[11px] text-slate-500">Odblokuje się po wgraniu pliku.</p>
              ) : readyCount === 0 ? (
                <p className="mt-1 text-[11px] text-amber-700">Najpierw uzupełnij listy.</p>
              ) : partialSelection ? (
                <p className="mt-1 text-[11px] text-slate-600">
                  Tylko zaznaczone - {openTeeth - selectedTeethCount}{" "}
                  {polishPluralWord(openTeeth - selectedTeethCount, "ząb zostanie", "zęby zostaną", "zębów zostanie")} w
                  kolejce.
                </p>
              ) : selectedTeethCount === 0 ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Chcesz tylko część? Zaznacz zęby poniżej.
                </p>
              ) : null}
            </Step>
          </div>
        )}
      </header>

      {items.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/40 px-4 py-2 sm:px-5">
            {group.supplierId ? (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={openTeeth === 0}
                  onChange={onToggleAll}
                  className={checkboxBrandClass}
                />
                Zaznacz wszystkie
              </label>
            ) : (
              <span className="text-xs text-slate-500">Najpierw przypisz dostawcę</span>
            )}
            {group.supplierId ? (
            <button
              type="button"
              aria-expanded={summaryOpen}
              onClick={() => setSummaryOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
            >
              <IconClipboardList size={14} />
              Zestawienie do zamówienia
              <IconChevronDown
                size={14}
                className={cn("transition-transform", summaryOpen && "rotate-180")}
              />
            </button>
            ) : null}
          </div>

          {summaryOpen && group.supplierId ? (
            <TeethQueueOrderSummary
              supplierName={group.supplierName}
              items={items}
              readinessCtx={readinessCtx}
            />
          ) : null}

          <div className="divide-y divide-slate-200">
            {sections.map((section) => {
              const sectionOpen = section.items.flatMap((item) =>
                teethOrderUnorderedPositions(item).map((p) => [item.id, p] as const),
              );
              const sectionTeeth = sectionOpen.length;
              const sectionAllSelected =
                sectionTeeth > 0 &&
                sectionOpen.every(([id, p]) => positionSelection.get(id)?.has(p));
              const sectionSomeSelected =
                !sectionAllSelected &&
                sectionOpen.some(([id, p]) => positionSelection.get(id)?.has(p));
              const sectionNeedsFix = section.items.filter((item) => {
                const state = stateById.get(item.id);
                return state ? teethOrderStateNeedsFix(state) : false;
              }).length;
              return (
                <section
                  key={section.key}
                  id={sectionDomId(section.key)}
                  aria-label={`Linia ${section.label}`}
                  className="scroll-mt-24"
                >
                  <TeethProductLineSectionHeader
                    productLine={section.productLine}
                    label={section.label}
                    leading={
                      group.supplierId ? (
                        <input
                          type="checkbox"
                          checked={sectionAllSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = sectionSomeSelected;
                          }}
                          disabled={sectionTeeth === 0}
                          onChange={() => {
                            for (const item of section.items) {
                              const open = teethOrderUnorderedPositions(item);
                              if (open.length > 0) onTogglePositions(item.id, open, !sectionAllSelected);
                            }
                          }}
                          className={cn(checkboxBrandClass, "size-[18px]")}
                          aria-label={`Zaznacz całą linię ${section.label}`}
                        />
                      ) : null
                    }
                    meta={
                      <>
                        {section.items.length} {plProsba(section.items.length)}
                        {sectionTeeth > 0
                          ? ` · ${sectionTeeth} ${polishPluralWord(sectionTeeth, "ząb", "zęby", "zębów")}`
                          : null}
                      </>
                    }
                    trailing={
                      sectionNeedsFix > 0 ? (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                          {sectionNeedsFix} do uzupełnienia
                        </span>
                      ) : null
                    }
                  />
                  <ul className="divide-y divide-slate-100">
                    {section.items.map((item) => {
                      const state = stateById.get(item.id) ?? teethOrderQueueState(item, readinessCtx);
                      return (
                        <TeethQueueOrderRow
                          key={item.id}
                          item={item}
                          state={state}
                          selected={positionSelection.get(item.id)}
                          onToggleOrder={() => {
                            const open = teethOrderUnorderedPositions(item);
                            const sel = positionSelection.get(item.id);
                            const all = open.length > 0 && open.every((p) => sel?.has(p));
                            onTogglePositions(item.id, open, !all);
                          }}
                          onTogglePositions={(positions, select) =>
                            onTogglePositions(item.id, positions, select)
                          }
                          onEditSaved={onEditSaved}
                          selectable={Boolean(group.supplierId)}
                        />
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          {schedule && !scheduleOnly ? (
            <p className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 sm:px-5">
              <IconCalendar size={13} className="text-sky-600" />
              Oznaczenie próśb przesunie też cykl z harmonogramu na kolejny termin.
            </p>
          ) : null}
        </>
      ) : null}

    </section>
  );
}

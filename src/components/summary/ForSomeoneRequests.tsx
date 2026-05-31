"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import type { SummaryForSomeoneEnriched } from "@/lib/orders/summary-workspace";
import {
  enrichForSomeoneGroup,
  sortForSomeoneGroups,
} from "@/lib/orders/procurement-daily-ui";
import { locationLabel } from "@/lib/display-labels";
import { actionProcessIndividual } from "@/app/actions/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import { Kbd } from "@/components/ui/Kbd";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { DeliveryStats, StatsMode } from "@/types/database";
import { formatSupplierLeadTimeBrief } from "@/lib/orders/delivery-eta";
import { ProcurementRequestLine, ProcurementRequestLineInline } from "@/components/summary/ProcurementRequestLine";
import {
  EditIndividualRequestModal,
  type EditIndividualRequestInitial,
} from "@/components/orders/EditIndividualRequestModal";
import { editInitialFromForSomeoneGroup } from "@/lib/orders/individual-request-edit-ui";
import { IndividualRequestActionBar } from "@/components/summary/IndividualRequestActionBar";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
} from "@/components/summary/DailyPanelSubsectionBar";
import { cn } from "@/lib/cn";
import { PanelRowActionsInlineEnd } from "@/components/summary/PanelRowActionsInlineEnd";
import { panelRowClearFocusOnLeave, panelRowGroupClass } from "@/lib/ui/panel-row-actions-reveal";
import { panelNameLinkClass, rowPendingRingClass } from "@/lib/ui/ontime-theme";
import { INFORMACJA_FLOW_PROCUREMENT_GROUP_BANNER } from "@/lib/orders/informacja-flow-copy";
import { InformacjaFlowLegend } from "@/components/orders/InformacjaFlowLegend";

function groupKey(g: SummaryForSomeoneEnriched) {
  return `${g.supplierId}-${g.salesPersonId}`;
}

const FOR_SOMEONE_KEYBOARD_HINTS = [
  { keys: ["↑", "↓"], label: "grupy" },
  { keys: ["Enter"], label: "produkty" },
  { keys: ["Shift", "G"], label: "główne" },
  { keys: ["Shift", "U"], label: "uzupełniające" },
  { keys: ["E"], label: "edycja" },
  { keys: ["/"], label: "wyszukaj dostawcę (panel)" },
  { keys: ["Ctrl", "Z"], label: "cofnij" },
] as const;

function SectionHelp() {
  return (
    <HelpPopover label="Jak obsłużyć" title="Prośby handlowców" shortLabel="Pomoc">
      <p className="mb-2">
        Na komputerze najedź na wiersz prośby — pojawią się przyciski Główne / Uzupełniające.
        Produkty są widoczne cały czas (jeden inline, więcej — przycisk „Produkty”).
        Na tablecie i telefonie przyciski akcji są widoczne cały czas.
      </p>
      <p className="mb-2">
        <strong className="font-medium text-slate-800">Główne</strong> — zamówienie z planem
        dostawcy. <strong className="font-medium text-slate-800">Uzupełniające</strong> — osobne
        domówienie poza planem.
      </p>
      <p className="mb-2">
        Kliknij <strong className="font-medium text-slate-800">Główne</strong> lub{" "}
        <strong className="font-medium text-slate-800">Uzupełniające</strong> — albo skróty{" "}
        <Kbd>Shift</Kbd>+<Kbd>G</Kbd> / <Kbd>Shift</Kbd>+<Kbd>U</Kbd> na zaznaczonej grupie (
        <Kbd>↑</Kbd>/<Kbd>↓</Kbd>).
      </p>
      <KeyboardShortcutsHint items={[...FOR_SOMEONE_KEYBOARD_HINTS]} className="mb-2" />
      <p className="mb-2">
        Przy produkcie: <strong className="text-emerald-800">✓</strong> — produkt z bazy;{" "}
        <strong className="text-slate-600">✎</strong> — wpis ręczny.
      </p>
      <p>Rozwiń grupę z wieloma produktami, aby zobaczyć pełną listę. Przy dostawcy z historią widać skrócony szacunek czasu dostawy.</p>
    </HelpPopover>
  );
}

export function ForSomeoneRequests({
  groups,
  isScopePending,
  run,
  onOpenSupplier,
  statsBySupplierId = {},
  supplierStatsMode = {},
  suppliers = [],
  salesPeople = [],
  embedded = false,
  queueStep,
  sectionId = "kolejka-prosby",
}: {
  groups: SummaryForSomeoneEnriched[];
  isScopePending: (scope: string) => boolean;
  run: DailyPanelRunFn;
  onOpenSupplier: (id: string) => void;
  statsBySupplierId?: Record<string, DeliveryStats>;
  supplierStatsMode?: Record<string, StatsMode>;
  suppliers?: { id: string; name: string }[];
  salesPeople?: { id: string; name: string }[];
  embedded?: boolean;
  queueStep?: number;
  sectionId?: string;
}) {
  const sorted = useMemo(() => sortForSomeoneGroups(groups), [groups]);
  const keys = useMemo(() => sorted.map(groupKey), [sorted]);
  const multiLineKeys = useMemo(
    () => sorted.filter((g) => g.lines.length >= 2).map(groupKey),
    [sorted]
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const allExpanded =
    multiLineKeys.length > 0 && multiLineKeys.every((k) => expanded.has(k));

  const setAll = useCallback(
    (open: boolean) => {
      setExpanded(open ? new Set(multiLineKeys) : new Set());
    },
    [multiLineKeys]
  );

  const lineCount = groups.reduce((n, g) => n + g.lines.length, 0);
  const [cancelTarget, setCancelTarget] = useState<{
    orderIds: string[];
    headline: string;
    scopeKey: string;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    orderIds: string[];
    initial: EditIndividualRequestInitial;
    scopeKey: string;
  } | null>(null);
  const [focusedGroupIndex, setFocusedGroupIndex] = useState(-1);

  useEffect(() => {
    if (editTarget || cancelTarget || !sorted.length) return;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }

      if (e.key === "Escape") {
        setFocusedGroupIndex(-1);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedGroupIndex((i) => Math.min(sorted.length - 1, i < 0 ? 0 : i + 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedGroupIndex((i) => Math.max(0, i < 0 ? 0 : i - 1));
        return;
      }

      if (focusedGroupIndex < 0 || focusedGroupIndex >= sorted.length) return;
      const group = sorted[focusedGroupIndex]!;
      const key = groupKey(group);
      const ui = enrichForSomeoneGroup(group);

      if (e.key === "Enter") {
        if (group.lines.length < 2) return;
        e.preventDefault();
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        return;
      }

      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setEditTarget({
          orderIds: group.orderIds,
          initial: editInitialFromForSomeoneGroup(group),
          scopeKey: key,
        });
        return;
      }

      if ((e.key === "g" || e.key === "G") && e.shiftKey) {
        e.preventDefault();
        if (
          !window.confirm(
            `Oznaczyć „${ui.headline}” jako zamówienie główne?`
          )
        ) {
          return;
        }
        run(
          () => actionProcessIndividual(group.orderIds, "GLOWNE"),
          "Oznaczono jako zamówienie główne",
          "Oznaczanie jako główne…",
          { scope: key }
        );
        return;
      }

      if ((e.key === "u" || e.key === "U") && e.shiftKey) {
        e.preventDefault();
        if (
          !window.confirm(
            `Oznaczyć „${ui.headline}” jako uzupełniające?`
          )
        ) {
          return;
        }
        run(
          () => actionProcessIndividual(group.orderIds, "POBOCZNE"),
          "Oznaczono jako uzupełniające",
          "Oznaczanie jako uzupełniające…",
          { scope: key }
        );
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sorted, focusedGroupIndex, editTarget, cancelTarget, run]);

  const Wrapper = embedded ? "section" : Card;
  const wrapperProps = embedded
    ? {
        id: sectionId,
        className: cn("scroll-mt-24", dailyPanelQueueShellClass("prosby")),
      }
    : { padding: false as const };

  const subsectionHeader = (
    <DailyPanelSubsectionBar
      title="Prośby handlowców"
      tone="prosby"
      step={queueStep}
      count={groups.length}
      countUnit={{ one: "grupa", few: "grupy", many: "grup" }}
      compact
      action={
        <div className="flex items-center gap-1">
          {multiLineKeys.length > 1 ? (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setAll(!allExpanded)}>
              {allExpanded ? "Zwiń listy" : "Rozwiń listy"}
            </Button>
          ) : null}
          <SectionHelp />
        </div>
      }
    />
  );

  const legacyHeader = (
    <CardHeader
      inset
      title="Prośby handlowców"
      description={`Prośby w kolejce dnia · ${groups.length} ${groups.length === 1 ? "grupa" : "grup"} · ${lineCount} ${lineCount === 1 ? "produkt" : "produktów"}`}
      action={
        <div className="flex items-center gap-2">
          {multiLineKeys.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setAll(!allExpanded)}>
              {allExpanded ? "Zwiń listy" : "Rozwiń listy"}
            </Button>
          ) : null}
          <SectionHelp />
        </div>
      }
    />
  );

  return (
    <Wrapper {...wrapperProps}>
      <EditIndividualRequestModal
        open={editTarget !== null}
        mode="procurement"
        orderIds={editTarget?.orderIds ?? []}
        initial={editTarget?.initial ?? null}
        suppliers={suppliers}
        salesPeople={salesPeople}
        onClose={() => setEditTarget(null)}
        onSaved={(msg) =>
          run(
            async () => ({ success: true as const }),
            msg,
            "Odświeżanie panelu…",
            editTarget
              ? { scope: `${editTarget.scopeKey}:edit`, overlay: false }
              : { overlay: false }
          )
        }
      />
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Anulować prośbę?"
        message={
          cancelTarget
            ? `Czy na pewno anulować: ${cancelTarget.headline}? Możesz cofnąć w ciągu 5 sekund po potwierdzeniu.`
            : ""
        }
        confirmLabel="Anuluj prośbę"
        danger
        pending={cancelTarget ? isScopePending(cancelTarget.scopeKey) : false}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          if (!cancelTarget) return;
          const { orderIds, scopeKey } = cancelTarget;
          setCancelTarget(null);
          run(
            () => actionProcessIndividual(orderIds, "ANULOWANO"),
            "Anulowano prośbę",
            "Anulowanie prośby…",
            { scope: scopeKey }
          );
        }}
      />
      {embedded ? subsectionHeader : legacyHeader}

      {sorted.some((g) => g.lines.some((l) => l.informacjaViaPanel)) ? (
        <div className="border-b border-slate-100 px-2 py-1.5 sm:px-3">
          <InformacjaFlowLegend compact />
        </div>
      ) : null}

      <ul className="space-y-1 p-2 sm:p-2">
        {sorted.map((g, groupIndex) => {
          const key = groupKey(g);
          const groupPending = isScopePending(key);
          const isFocused = focusedGroupIndex === groupIndex;
          const ui = enrichForSomeoneGroup(g);
          const stats = statsBySupplierId[g.supplierId];
          const statsMode = supplierStatsMode[g.supplierId] ?? "LACZNIE";
          const leadTimeBrief = stats
            ? formatSupplierLeadTimeBrief(stats, statsMode)
            : null;
          const hasInfoViaPanel = g.lines.some((l) => l.informacjaViaPanel);
          const singleLine = g.lines.length === 1 ? g.lines[0]! : null;
          const hasMultiLine = g.lines.length >= 2;
          const isOpen = hasMultiLine && expanded.has(key);

          return (
            <li key={key}>
              <article
                className={cn(
                  panelRowGroupClass("rounded-md border border-slate-200 bg-white transition-shadow"),
                  groupPending && rowPendingRingClass,
                  isFocused && "ring-2 ring-indigo-400/70 ring-offset-1"
                )}
                aria-busy={groupPending}
                onMouseLeave={(e) => {
                  panelRowClearFocusOnLeave(e);
                  if (focusedGroupIndex === groupIndex) setFocusedGroupIndex(-1);
                }}
              >
                <div className="px-2 py-1.5">
                  <div className="flex items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-slate-900">{ui.headline}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <button
                          type="button"
                          className={panelNameLinkClass}
                          onClick={() => onOpenSupplier(g.supplierId)}
                        >
                          {g.supplierName}
                        </button>
                        {" · "}
                        {ui.subline}
                        {" · "}
                        {locationLabel(g.location)}
                      </p>
                      {leadTimeBrief ? (
                        <p className="mt-0.5 text-[10px] text-slate-400">{leadTimeBrief}</p>
                      ) : null}
                      {singleLine ? <ProcurementRequestLineInline line={singleLine} /> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        variant={hasInfoViaPanel ? "info" : "default"}
                        className="shrink-0 whitespace-normal text-right text-[10px] leading-snug"
                      >
                        {ui.statusTitle}
                      </Badge>
                      <PanelRowActionsInlineEnd forceVisible={groupPending}>
                        <IndividualRequestActionBar
                          orderIds={g.orderIds}
                          supplierId={g.supplierId}
                          hasInfoViaPanel={hasInfoViaPanel}
                          headline={ui.headline}
                          pending={groupPending}
                          scopeKey={key}
                          run={run}
                          onEdit={() =>
                            setEditTarget({
                              orderIds: g.orderIds,
                              initial: editInitialFromForSomeoneGroup(g),
                              scopeKey: key,
                            })
                          }
                          onCancel={() =>
                            setCancelTarget({
                              orderIds: g.orderIds,
                              headline: ui.headline,
                              scopeKey: key,
                            })
                          }
                        />
                      </PanelRowActionsInlineEnd>
                    </div>
                  </div>
                  {hasInfoViaPanel ? (
                    <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] leading-snug text-slate-700">
                      <p>{INFORMACJA_FLOW_PROCUREMENT_GROUP_BANNER}</p>
                    </div>
                  ) : null}
                  {hasMultiLine ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={groupPending}
                      className="mt-1.5 h-7 shrink-0 px-2.5"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (isOpen) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                    >
                      {isOpen ? "Zwiń" : `Produkty (${g.lines.length})`}
                    </Button>
                  ) : null}
                </div>
                {isOpen ? (
                  <div className="border-t border-slate-100">
                    <ul className="space-y-1 px-2.5 py-1.5">
                      {g.lines.map((line) => (
                        <ProcurementRequestLine key={line.id} line={line} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>
    </Wrapper>
  );
}

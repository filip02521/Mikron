"use client";

import { useMemo, useState, useCallback } from "react";
import type { SummaryForSomeoneEnriched } from "@/lib/orders/summary-workspace";
import {
  enrichForSomeoneGroup,
  sortForSomeoneGroups,
} from "@/lib/orders/procurement-daily-ui";
import { locationLabel } from "@/lib/display-labels";
import { actionProcessIndividual } from "@/app/actions/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { HoldToConfirmButton } from "@/components/ui/HoldToConfirmButton";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HelpPopover } from "@/components/ui/HelpPopover";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { DeliveryStats, StatsMode } from "@/types/database";
import { SupplierLeadTimeHint } from "@/components/orders/SupplierLeadTimeHint";
import { orderTypesForLeadTimeHints } from "@/lib/orders/delivery-eta";
import { ProcurementRequestLine } from "@/components/summary/ProcurementRequestLine";
import {
  EditIndividualRequestModal,
  type EditIndividualRequestInitial,
} from "@/components/orders/EditIndividualRequestModal";
import { editInitialFromForSomeoneGroup } from "@/lib/orders/individual-request-edit-ui";
import { RequestGroupOverflowMenu } from "@/components/summary/RequestGroupOverflowMenu";
import { DailyPanelSubsectionBar } from "@/components/summary/DailyPanelSubsectionBar";
import { cn } from "@/lib/cn";
import { panelNameLinkClass, rowPendingRingClass } from "@/lib/ui/ontime-theme";

function groupKey(g: SummaryForSomeoneEnriched) {
  return `${g.supplierId}-${g.salesPersonId}`;
}

function SectionHelp() {
  return (
    <HelpPopover label="Jak obsłużyć" title="Prośby handlowców" shortLabel="Pomoc">
      <p className="mb-2">
        <strong className="font-medium text-slate-800">Główne</strong> — zamówienie z planem
        dostawcy. <strong className="font-medium text-slate-800">Uzupełniające</strong> — osobne
        domówienie poza planem.
      </p>
      <p className="mb-2">
        <strong className="font-medium text-slate-800">Przytrzymaj</strong> wybrany przycisk ok.
        0,7 s — zabezpieczenie przed przypadkowym zamówieniem.
      </p>
      <p className="mb-2">
        Przy produkcie: <strong className="text-emerald-800">✓</strong> — wybrano z kartoteki
        Subiekt; <strong className="text-slate-600">✎</strong> — wpis ręczny (bez powiązania z
        Subiektem).
      </p>
      <p>Rozwiń kartę po listę produktów i szacunek czasu realizacji u dostawcy.</p>
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
}) {
  const sorted = useMemo(() => sortForSomeoneGroups(groups), [groups]);
  const keys = useMemo(() => sorted.map(groupKey), [sorted]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const allExpanded = keys.length > 0 && keys.every((k) => expanded.has(k));

  const setAll = useCallback(
    (open: boolean) => {
      setExpanded(open ? new Set(keys) : new Set());
    },
    [keys]
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

  const Wrapper = embedded ? "div" : Card;
  const wrapperProps = embedded
    ? { className: "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" }
    : { padding: false as const };

  const subsectionHeader = (
    <DailyPanelSubsectionBar
      title="Prośby handlowców"
      description={`Prośby w kolejce dnia · ${groups.length} ${groups.length === 1 ? "grupa" : "grup"} · ${lineCount} ${lineCount === 1 ? "produkt" : "produktów"}`}
      action={
        <div className="flex items-center gap-2">
          {keys.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setAll(!allExpanded)}>
              {allExpanded ? "Zwiń" : "Rozwiń"}
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
          {keys.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setAll(!allExpanded)}>
              {allExpanded ? "Zwiń" : "Rozwiń"}
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

      <ul className="space-y-2.5 p-3 sm:p-4">
        {sorted.map((g) => {
          const key = groupKey(g);
          const groupPending = isScopePending(key);
          const isOpen = expanded.has(key);
          const ui = enrichForSomeoneGroup(g);
          const stats = statsBySupplierId[g.supplierId];
          const statsMode = supplierStatsMode[g.supplierId] ?? "LACZNIE";
          const leadTimeOrderTypes = stats
            ? orderTypesForLeadTimeHints(stats, statsMode)
            : [];

          return (
            <li key={key}>
              <article
                className={cn(
                  "rounded-xl border border-slate-200 bg-white",
                  groupPending && rowPendingRingClass
                )}
                aria-busy={groupPending}
              >
                <div className="px-3.5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{ui.headline}</p>
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
                      {ui.statusDetail ? (
                        <p className="mt-1 text-xs text-slate-500">{ui.statusDetail}</p>
                      ) : null}
                    </div>
                    <Badge variant="default" className="shrink-0 text-[10px]">
                      {ui.statusTitle}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {g.lines.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={groupPending}
                        className="min-h-[2.125rem] shrink-0"
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
                    ) : (
                      <span className="min-w-0 flex-1 sm:flex-none" aria-hidden />
                    )}

                    <ButtonGroup
                      ariaLabel="Zamówienie i więcej opcji"
                      className="ml-auto shrink-0"
                    >
                      <HoldToConfirmButton
                        label="Główne"
                        variant="primary"
                        disabled={groupPending || !g.supplierId}
                        className="px-3 py-2"
                        onConfirm={() =>
                          run(
                            () => actionProcessIndividual(g.orderIds, "GLOWNE"),
                            "Oznaczono jako zamówienie główne",
                            "Oznaczanie jako główne…",
                            { scope: key }
                          )
                        }
                      />
                      <HoldToConfirmButton
                        label="Uzupełniające"
                        variant="outline"
                        disabled={groupPending || !g.supplierId}
                        className="border-l border-slate-200 px-3 py-2"
                        onConfirm={() =>
                          run(
                            () => actionProcessIndividual(g.orderIds, "POBOCZNE"),
                            "Oznaczono jako uzupełniające",
                            "Oznaczanie jako uzupełniające…",
                            { scope: key }
                          )
                        }
                      />
                      <RequestGroupOverflowMenu
                        headline={ui.headline}
                        disabled={groupPending}
                        iconOnly
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
                    </ButtonGroup>
                  </div>
                  <p className="mt-1.5 text-right text-[10px] text-slate-400">
                    Przytrzymaj Główne lub Uzupełniające ok. 0,7 s
                  </p>
                </div>
                {isOpen ? (
                  <div className="border-t border-slate-100">
                    {stats && leadTimeOrderTypes.length > 0 ? (
                      <div className="border-b border-slate-100 bg-slate-50/50 px-3.5 py-2">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Szacunek po zamówieniu (dni robocze)
                        </p>
                        <div
                          className={
                            leadTimeOrderTypes.length > 1
                              ? "grid gap-2 lg:grid-cols-2"
                              : undefined
                          }
                        >
                          {leadTimeOrderTypes.map((orderType) => (
                            <SupplierLeadTimeHint
                              key={orderType}
                              stats={stats}
                              statsMode={statsMode}
                              orderType={orderType}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <ul className="space-y-1.5 px-3.5 py-2">
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

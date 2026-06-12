"use client";

import { useMemo, useState } from "react";
import type { SalesCancelledNotice } from "@/lib/orders/sales-cancelled-notices";
import { locationLabel } from "@/lib/display-labels";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { actionAcknowledgeProcurementSalesCancel } from "@/app/actions/admin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { SalesCancelDispositionForm } from "@/components/summary/SalesCancelDispositionForm";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
} from "@/components/summary/DailyPanelSubsectionBar";
import {
  dailyPanelListBodyClass,
  dailyPanelCardRowInteractiveClass,
} from "@/components/summary/daily-panel-list-styles";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { cn } from "@/lib/cn";
import {
  panelNoticeTriggerBaseClass,
  panelNoticeTriggerDefaultClass,
  panelNoticeTriggerUrgentClass,
} from "@/lib/ui/ontime-theme";

function noticeCompactSubtitle(notice: SalesCancelledNotice): string {
  const parts: string[] = [];
  if (notice.clientName) parts.push(`klient: ${notice.clientName}`);
  parts.push(locationLabel(notice.location));
  parts.push(notice.cancelledLabel);
  parts.push(notice.needsDisposition ? "czeka na decyzję" : "do zapoznania");
  return parts.join(" · ");
}

function noticeActionLabel(notice: SalesCancelledNotice): string {
  return notice.needsDisposition ? "Co z towarem?" : "Szczegóły";
}

function noticeModalDescription(notice: SalesCancelledNotice): string {
  if (!notice.needsDisposition) {
    return "Handlowiec zrezygnował przed złożeniem u dostawcy. Zapoznaj się z pozycjami i ukryj powiadomienie.";
  }
  return "Handlowiec zrezygnował z części zamówienia. Dla każdej pozycji wybierz: na stan magazynu albo zwrot do dostawcy.";
}

function SalesCancelledNoticeModal({
  notice,
  open,
  onClose,
  isScopePending,
  run,
}: {
  notice: SalesCancelledNotice | null;
  open: boolean;
  onClose: () => void;
  isScopePending: (scope: string) => boolean;
  run: DailyPanelRunFn;
}) {
  if (!notice) return null;

  const scope = `cancel-${notice.orderIds[0] ?? notice.person}`;
  const pending = isScopePending(scope);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`${notice.person} · ${notice.supplierName}`}
      description={noticeModalDescription(notice)}
      size="md"
      bodyClassName="px-5 py-4 sm:px-6"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={notice.needsDisposition ? "warning" : "default"} className="text-[10px]">
            {notice.phase === "before_order" ? "Wycofane" : "Rezygnacja"}
          </Badge>
          {notice.clientName ? (
            <span className="text-xs text-slate-600">Klient: {notice.clientName}</span>
          ) : null}
          <span className="text-xs text-slate-500">
            {locationLabel(notice.location)} · {notice.cancelledLabel}
          </span>
        </div>

        {notice.needsDisposition ? (
          <SalesCancelDispositionForm
            personName={notice.person}
            phase={
              notice.phase === "on_stock" || notice.phase === "in_transit"
                ? notice.phase
                : "in_transit"
            }
            lines={notice.lines}
            disabled={pending}
            onDone={(message, isError) => {
              if (isError) {
                run(async () => {
                  throw new Error(message);
                }, message, "", { scope });
                return;
              }
              run(async () => ({ success: true }), message, "Zapisywanie…", { scope });
              onClose();
            }}
          />
        ) : (
          <>
            <ul className="space-y-1 text-sm text-slate-700">
              {notice.lines.map((line) => (
                <li
                  key={line.id}
                  className={cn(
                    dailyPanelCardRowInteractiveClass(),
                    "px-2.5 py-2 text-sm sm:px-3"
                  )}
                >
                  <span className="font-medium text-slate-900">{line.symbol}</span>
                  {" — "}
                  {line.products}
                  {line.quantity && line.quantity !== "—" ? (
                    <span className="text-slate-500"> · {line.quantity}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  async () => {
                    await actionAcknowledgeProcurementSalesCancel(notice.orderIds);
                    onClose();
                    return { success: true };
                  },
                  "Ukryto",
                  "Zapisywanie…",
                  { scope }
                )
              }
            >
              Zapoznałem się — ukryj
            </Button>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function SalesCancelledNoticeRow({
  notice,
  onOpen,
}: {
  notice: SalesCancelledNotice;
  onOpen: () => void;
}) {
  const firstLine = notice.lines[0];
  const extraLines = notice.lines.length - 1;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          panelNoticeTriggerBaseClass,
          notice.needsDisposition
            ? panelNoticeTriggerUrgentClass
            : panelNoticeTriggerDefaultClass
        )}
      >
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-medium text-slate-900">
            {notice.person}
            <span className="font-normal text-slate-500"> · {notice.supplierName}</span>
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{noticeCompactSubtitle(notice)}</p>
          {firstLine ? (
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {firstLine.symbol}
              {extraLines > 0 ? ` · +${extraLines}` : null}
            </p>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-600">
          {noticeActionLabel(notice)}
          <LinkChevron size={13} tone="muted" />
        </span>
      </button>
    </li>
  );
}

/** Rezygnacje handlowców — kompaktowa sekcja w kolejce Dziś. */
export function SalesCancelledDailyPanel({
  notices,
  isScopePending,
  run,
}: {
  notices: SalesCancelledNotice[];
  isScopePending: (scope: string) => boolean;
  run: DailyPanelRunFn;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeNotice = notices.find((n) => n.id === activeId) ?? null;
  const needsAction = useMemo(
    () => notices.some((n) => n.needsDisposition),
    [notices]
  );

  if (!notices.length) return null;

  return (
    <>
      <section id="rezygnacje" className={dailyPanelQueueShellClass("cancel")} aria-label="Rezygnacje handlowców">
        <DailyPanelSubsectionBar
          tone="cancel"
          title="Rezygnacje handlowców"
          count={notices.length}
          countUnit={{ one: "pozycja", few: "pozycje", many: "pozycji" }}
          compact
          description={
            needsAction
              ? "Handlowiec zrezygnował — kliknij i wybierz: na stan albo zwrot."
              : undefined
          }
        />
        <ul className={dailyPanelListBodyClass}>
          {notices.map((notice) => (
            <SalesCancelledNoticeRow
              key={notice.id}
              notice={notice}
              onOpen={() => setActiveId(notice.id)}
            />
          ))}
        </ul>
      </section>

      <SalesCancelledNoticeModal
        notice={activeNotice}
        open={activeId !== null}
        onClose={() => setActiveId(null)}
        isScopePending={isScopePending}
        run={run}
      />
    </>
  );
}

/** @deprecated Użyj SalesCancelledDailyPanel. */
export const SalesCancelledDailyCompact = SalesCancelledDailyPanel;
